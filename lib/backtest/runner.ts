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

export async function runBacktestLive(params: BacktestParams, publisher: EventPublisher) {
  const { startDate, endDate, intervalMinutes } = params;
  const cyclesPerDay = intervalMinutes < 1440 ? Math.floor(375 / intervalMinutes) : 1;

  const engine = getTradingEngine();
  // @ts-ignore expose via method if available
  if (typeof (engine as any).setPublisher === 'function') {
    (engine as any).setPublisher(publisher);
  }
  const dataService = getDataService();
  const calc = new PortfolioCalculator(dataService);

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const models = await prisma.model.findMany({ select: { id: true, displayName: true } });
  publisher.publish('run_started', { params, models });

  let current = start;
  while (current <= end) {
    if (isWeekend(current)) {
      current = addDays(current, 1);
      continue;
    }
    const dateStr = format(current, 'yyyy-MM-dd');
    for (let cycle = 1; cycle <= cyclesPerDay; cycle++) {
      const cycleTime = 9 * 60 + 30 + (cycle - 1) * intervalMinutes;
      const hours = Math.floor(cycleTime / 60);
      const minutes = cycleTime % 60;
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      const simulatedTime = new Date(`${dateStr}T${timeStr}`);
      publisher.publish('cycle_started', { dateISO: dateStr, timeISO: timeStr, cycleIndex: cycle });
      await engine.executeTradingCycle({ simulatedTime });
    }

    // End of day summary
    const modelsAfter = await prisma.model.findMany({
      where: { isActive: true },
      include: { portfolio: { include: { positions: true } } },
    });
    const portfolios: any[] = [];
    for (const m of modelsAfter) {
      if (!m.portfolio) continue;
      const v = await calc.calculateTotalValue(m.portfolio.id);
      const initialValue = Number(m.portfolio.initialValue || 100000);
      portfolios.push({
        modelId: m.id,
        modelName: m.displayName,
        cash: v.cashBalance,
        positionsValue: v.positionsValue,
        totalValue: v.totalValue,
        returnPct: ((v.totalValue - initialValue) / initialValue) * 100,
      });
    }
    const tradesCount = await prisma.trade.count({
      where: {
        createdAt: {
          gte: new Date(`${dateStr}T00:00:00`),
          lt: new Date(`${dateStr}T23:59:59`),
        },
      },
    });
    publisher.publish('eod_summary', { dateISO: dateStr, tradesCount, portfolios });

    current = addDays(current, 1);
  }

  // Final summary
  const tradingDays = countTradingDays(start, end);
  const totalTrades = await prisma.trade.count({
    where: {
      createdAt: { gte: new Date(`${format(start, 'yyyy-MM-dd')}T00:00:00`), lt: new Date(`${format(end, 'yyyy-MM-dd')}T23:59:59`) },
    },
  });
  publisher.publish('run_complete', {
    summary: {
      tradingDays,
      dateRange: { start: startDate, end: endDate },
      totalTrades,
    },
  });
}

function countTradingDays(start: Date, end: Date): number {
  let d = start; let n = 0;
  while (d <= end) { if (!isWeekend(d)) n++; d = addDays(d, 1); }
  return n;
}
