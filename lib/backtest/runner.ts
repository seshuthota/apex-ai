import { PrismaClient } from '@prisma/client';
import { addDays, format, isWeekend, parseISO } from 'date-fns';
import { getDataService, getTradingEngine } from '@/lib/services';
import { PortfolioCalculator } from '@/lib/services/portfolio-calculator';
import type { EventPublisher } from '@/lib/backtest/publisher';

const prisma = new PrismaClient();

export interface BacktestParams {
  startDate: string;
  endDate: string;
  intervalMinutes: number; // 1440 for daily
  enriched?: boolean;
  useTools?: boolean;
}

type PortfolioSummary = {
  modelId: string;
  modelName: string;
  cash: number;
  positionsValue: number;
  totalValue: number;
  returnPct: number;
  positions: Array<{ ticker: string; shares: number }>;
};

interface RunExecutionOptions {
  signal?: AbortSignal;
  onRunCreated?: (runId: string) => void;
}

export async function runBacktestLive(
  params: BacktestParams,
  publisher: EventPublisher,
  options: RunExecutionOptions = {},
): Promise<string> {
  const { startDate, endDate, intervalMinutes, enriched = true, useTools = true } = params;
  const { signal, onRunCreated } = options;
  const cyclesPerDay = intervalMinutes < 1440 ? Math.floor(375 / intervalMinutes) : 1;

  const engine = getTradingEngine();
  engine.setPublisher(publisher);
  const dataService = getDataService();
  const calc = new PortfolioCalculator(dataService);

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const plannedTradingDays = countTradingDays(start, end);
  const runStartTimestamp = Date.now();

  const runRecord = await prisma.backtestRun.create({
    data: {
      startDate: start,
      endDate: end,
      intervalMinutes,
      enriched,
      useTools,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  engine.setRunContext(runRecord.id);
  onRunCreated?.(runRecord.id);

  const models = await prisma.model.findMany({ select: { id: true, displayName: true } });
  publisher.publish('run_started', { runId: runRecord.id, status: 'RUNNING', params, models });

  let aborted = false;
  const abortHandler = () => {
    aborted = true;
  };
  signal?.addEventListener('abort', abortHandler, { once: true });

  let current = start;
  let tradingDaysProcessed = 0;
  let lastPortfolios: PortfolioSummary[] = [];

  try {
    while (current <= end) {
      if (aborted) break;

      if (isWeekend(current)) {
        current = addDays(current, 1);
        continue;
      }

      tradingDaysProcessed++;
      const dateStr = format(current, 'yyyy-MM-dd');

      for (let cycle = 1; cycle <= cyclesPerDay; cycle++) {
        if (aborted) break;

        const cycleTime = 9 * 60 + 30 + (cycle - 1) * intervalMinutes;
        const hours = Math.floor(cycleTime / 60);
        const minutes = cycleTime % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
        const simulatedTime = new Date(`${dateStr}T${timeStr}`);

        publisher.publish('cycle_started', {
          runId: runRecord.id,
          dateISO: dateStr,
          timeISO: timeStr,
          cycleIndex: cycle,
        });

        await engine.executeTradingCycle({ simulatedTime });
      }

      if (aborted) break;

      const modelsAfter = await prisma.model.findMany({
        where: { isActive: true },
        include: { portfolio: { include: { positions: true } } },
      });

      const portfolios: PortfolioSummary[] = [];
      for (const m of modelsAfter) {
        if (!m.portfolio) continue;
        const valuation = await calc.calculateTotalValue(m.portfolio.id);
        const initialValue = Number(m.portfolio.initialValue || 100000);
        portfolios.push({
          modelId: m.id,
          modelName: m.displayName,
          cash: valuation.cashBalance,
          positionsValue: valuation.positionsValue,
          totalValue: valuation.totalValue,
          returnPct: ((valuation.totalValue - initialValue) / initialValue) * 100,
          positions: m.portfolio.positions.map(position => ({
            ticker: position.ticker,
            shares: position.shares,
          })),
        });
      }

      lastPortfolios = portfolios;
      const summaryDate = parseISO(dateStr);
      const summaryTimestamp = new Date(summaryDate);
      summaryTimestamp.setHours(23, 59, 59, 0);

      await prisma.$transaction(async tx => {
        for (const summary of portfolios) {
          const runModel = await tx.backtestRunModel.upsert({
            where: {
              runId_modelId: {
                runId: runRecord.id,
                modelId: summary.modelId,
              },
            },
            update: {
              modelName: summary.modelName,
              finalCash: summary.cash,
              finalPositionsValue: summary.positionsValue,
              finalTotalValue: summary.totalValue,
              returnPct: summary.returnPct,
              finalPositions: summary.positions,
            },
            create: {
              runId: runRecord.id,
              modelId: summary.modelId,
              modelName: summary.modelName,
              finalCash: summary.cash,
              finalPositionsValue: summary.positionsValue,
              finalTotalValue: summary.totalValue,
              returnPct: summary.returnPct,
              finalPositions: summary.positions,
            },
          });

          await tx.backtestRunSnapshot.create({
            data: {
              runModelId: runModel.id,
              date: summaryDate,
              totalValue: summary.totalValue,
              cash: summary.cash,
              positionsValue: summary.positionsValue,
              returnPct: summary.returnPct,
            },
          });
        }
      });

      const tradesCount = await prisma.trade.count({
        where: {
          backtestRunId: runRecord.id,
          createdAt: {
            gte: new Date(`${dateStr}T00:00:00`),
            lt: new Date(`${dateStr}T23:59:59`),
          },
        },
      });

      publisher.publish('eod_summary', {
        runId: runRecord.id,
        dateISO: dateStr,
        timestamp: summaryTimestamp.toISOString(),
        tradesCount,
        portfolios,
      });

      current = addDays(current, 1);
    }

    const totalTrades = await prisma.trade.count({
      where: { backtestRunId: runRecord.id },
    });
    const durationMs = Date.now() - runStartTimestamp;

    if (aborted) {
      await prisma.backtestRun.update({
        where: { id: runRecord.id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          failureReason: 'Run cancelled by client',
          tradingDays: tradingDaysProcessed,
          totalTrades,
          durationMs,
        },
      });

      publisher.publish('run_complete', {
        runId: runRecord.id,
        status: 'CANCELLED',
        summary: {
          tradingDays: tradingDaysProcessed,
          plannedTradingDays,
          dateRange: { start: startDate, end: endDate },
          totalTrades,
        },
      });

      return runRecord.id;
    }

    if (lastPortfolios.length > 0) {
      const ranked = [...lastPortfolios].sort((a, b) => b.totalValue - a.totalValue);
      let rank = 1;
      for (const entry of ranked) {
        await prisma.backtestRunModel.update({
          where: {
            runId_modelId: {
              runId: runRecord.id,
              modelId: entry.modelId,
            },
          },
          data: { rank: rank++ },
        });
      }
    }

    await prisma.backtestRun.update({
      where: { id: runRecord.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        tradingDays: tradingDaysProcessed,
        totalTrades,
        durationMs,
      },
    });

    publisher.publish('run_complete', {
      runId: runRecord.id,
      status: 'COMPLETED',
      summary: {
        tradingDays: tradingDaysProcessed,
        plannedTradingDays,
        dateRange: { start: startDate, end: endDate },
        totalTrades,
      },
    });

    return runRecord.id;
  } catch (error) {
    const totalTrades = await prisma.trade.count({
      where: { backtestRunId: runRecord.id },
    });
    await prisma.backtestRun.update({
      where: { id: runRecord.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        tradingDays: tradingDaysProcessed,
        totalTrades,
        durationMs: Date.now() - runStartTimestamp,
      },
    });
    publisher.publish('run_complete', {
      runId: runRecord.id,
      status: 'FAILED',
      summary: {
        tradingDays: tradingDaysProcessed,
        plannedTradingDays,
        dateRange: { start: startDate, end: endDate },
        totalTrades,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    signal?.removeEventListener('abort', abortHandler);
    engine.setRunContext(undefined);
  }
}

function countTradingDays(start: Date, end: Date): number {
  let d = start; let n = 0;
  while (d <= end) { if (!isWeekend(d)) n++; d = addDays(d, 1); }
  return n;
}
