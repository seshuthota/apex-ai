import { NextResponse } from "next/server";
import type {
  BacktestRun,
  BacktestRunModel,
  BacktestRunSnapshot,
  Trade,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type RunDetailPayload = {
  run: ReturnType<typeof serializeRunDetail>;
  trades: Array<ReturnType<typeof serializeTrade>>;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId?: string }> },
) {
  const { runId } = await context.params;
  if (!runId) {
    return NextResponse.json(
      { error: "Run id is required" },
      { status: 400 },
    );
  }
  try {
    const run = await prisma.backtestRun.findUnique({
      where: { id: runId },
      include: {
        models: {
          orderBy: [
            { rank: "asc" },
            { finalTotalValue: "desc" },
          ],
          include: {
            snapshots: {
              orderBy: { date: "asc" },
            },
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 },
      );
    }

    const trades = await prisma.trade.findMany({
      where: { backtestRunId: runId },
      orderBy: [
        { executedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 500,
    });

    const payload: RunDetailPayload = {
      run: serializeRunDetail(run),
      trades: trades.map(serializeTrade),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[backtest.run.detail] Failed to load run", error);
    return NextResponse.json(
      { error: "Failed to load backtest run" },
      { status: 500 },
    );
  }
}

function serializeRunDetail(
  run: BacktestRun & {
    models: Array<
      BacktestRunModel & { snapshots: BacktestRunSnapshot[] }
    >;
  },
) {
  return {
    id: run.id,
    status: run.status,
    startDate: run.startDate.toISOString(),
    endDate: run.endDate.toISOString(),
    intervalMinutes: run.intervalMinutes,
    enriched: run.enriched,
    useTools: run.useTools,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    failedAt: run.failedAt?.toISOString() ?? null,
    failureReason: run.failureReason ?? null,
    tradingDays: run.tradingDays ?? null,
    totalTrades: run.totalTrades ?? null,
    durationMs: run.durationMs ?? null,
    models: run.models.map((model) => ({
      modelId: model.modelId,
      modelName: model.modelName,
      finalCash: Number(model.finalCash),
      finalPositionsValue: Number(model.finalPositionsValue),
      finalTotalValue: Number(model.finalTotalValue),
      returnPct: Number(model.returnPct),
      rank: model.rank,
      finalPositions: parsePositions(model.finalPositions),
      snapshots: model.snapshots.map((snapshot) => ({
        id: snapshot.id,
        date: snapshot.date.toISOString(),
        totalValue: Number(snapshot.totalValue),
        cash: snapshot.cash === null ? null : Number(snapshot.cash),
        positionsValue:
          snapshot.positionsValue === null
            ? null
            : Number(snapshot.positionsValue),
        returnPct:
          snapshot.returnPct === null ? null : Number(snapshot.returnPct),
      })),
    })),
  };
}

function serializeTrade(trade: Trade) {
  return {
    id: trade.id,
    modelId: trade.modelId,
    backtestRunId: trade.backtestRunId,
    ticker: trade.ticker,
    action: trade.action,
    shares: trade.shares,
    price: Number(trade.price),
    totalValue: Number(trade.totalValue),
    status: trade.status,
    brokerOrderId: trade.brokerOrderId,
    createdAt: trade.createdAt.toISOString(),
    executedAt: trade.executedAt?.toISOString() ?? null,
    cashAfter: trade.cashAfter === null ? null : Number(trade.cashAfter),
    portfolioValueAfter:
      trade.portfolioValueAfter === null
        ? null
        : Number(trade.portfolioValueAfter),
    portfolioState: trade.portfolioState,
  };
}

function parsePositions(
  positions: unknown,
): Array<{ ticker: string; shares: number }> {
  if (!Array.isArray(positions)) {
    return [];
  }

  return positions
    .map((entry) => {
      if (
        entry &&
        typeof entry === "object" &&
        "ticker" in entry &&
        "shares" in entry
      ) {
        const { ticker, shares } = entry as {
          ticker: unknown;
          shares: unknown;
        };

        if (typeof ticker === "string" && typeof shares === "number") {
          return { ticker, shares };
        }
      }
      return null;
    })
    .filter((value): value is { ticker: string; shares: number } => value !== null);
}
