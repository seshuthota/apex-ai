import { NextRequest, NextResponse } from "next/server";
import type { BacktestRun, BacktestRunModel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type SerializedRun = ReturnType<typeof serializeRun>;

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    Math.max(Number.parseInt(limitParam ?? "10", 10) || 10, 1),
    MAX_LIMIT,
  );

  try {
    const runs = await prisma.backtestRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        models: {
          orderBy: [
            { rank: "asc" },
            { finalTotalValue: "desc" },
          ],
        },
      },
    });

    const payload: SerializedRun[] = runs.map(serializeRun);
    return NextResponse.json({ runs: payload });
  } catch (error) {
    console.error("[backtest.runs] Failed to fetch runs", error);
    return NextResponse.json(
      { error: "Failed to load backtest runs" },
      { status: 500 },
    );
  }
}

function serializeRun(run: BacktestRun & { models: BacktestRunModel[] }) {
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
    })),
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
