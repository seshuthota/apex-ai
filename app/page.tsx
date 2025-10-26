"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArenaHeader,
  CompetitionSidebar,
  ModelSummary,
  PerformanceChart,
  PositionsPanel,
  RunControls,
  TickerStrip,
  TradeFeed,
} from "@/components/arena";
import { MODEL_META, getModelMeta } from "@/components/arena/modelMeta";
import type {
  HistoryPoint,
  PortfolioEvent,
  RunDetail,
  RunSummary,
  RunTrade,
  TradeEvent,
} from "@/components/arena/types";

const BASELINE_CAPITAL = 100_000;
const BASELINE_TIMESTAMP = Date.UTC(2025, 0, 1);
const MAX_TRADES = 200;

type ChartDatum = { date: number } & Record<string, number>;

const ensureModelIdentity = <T extends { modelId?: string; modelName?: string }>(
  payload: T,
) => {
  const fallbackId = payload.modelId || payload.modelName || "unknown-model";
  const fallbackName = payload.modelName || payload.modelId || "Unknown Model";
  return { id: fallbackId, name: fallbackName };
};

export default function HomePage() {
  const [startDate, setStartDate] = useState("2025-09-01");
  const [endDate, setEndDate] = useState("2025-09-30");
  const [intervalMinutes, setIntervalMinutes] = useState(1440);
  const [enriched, setEnriched] = useState(true);
  const [useTools, setUseTools] = useState(true);
  const [mode, setMode] = useState<"currency" | "percent">("currency");
  const [running, setRunning] = useState(false);

  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [portfolios, setPortfolios] = useState<Record<string, PortfolioEvent>>({});
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [runDetailLoading, setRunDetailLoading] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const lastValuesRef = useRef<Map<string, number>>(new Map());

  const resetRunState = useCallback(() => {
    setTrades([]);
    setPortfolios({});
    setHistory([]);
    lastValuesRef.current = new Map();
  }, []);

  const stop = useCallback((preserveData = false) => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
    setCurrentRunId(null);
    currentRunIdRef.current = null;
    if (!preserveData) {
      resetRunState();
    }
  }, [resetRunState]);

  const fetchRunHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const response = await fetch("/api/backtest/runs?limit=12");
      if (!response.ok) {
        throw new Error(`Failed to load runs (${response.status})`);
      }
      const payload = await response.json();
      setRunHistory(Array.isArray(payload.runs) ? payload.runs : []);
    } catch (error) {
      console.error("Failed to load run history", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadRunDetail = useCallback(
    async (runId: string) => {
      try {
        setRunDetailLoading(true);
        const response = await fetch(`/api/backtest/runs/${runId}`);
        if (!response.ok) {
          throw new Error(`Failed to load run detail (${response.status})`);
        }
        const payload: { run: RunDetail; trades: RunTrade[] } = await response.json();
        const run = payload.run;

        const portfolioMap: Record<string, PortfolioEvent> = {};
        run.models.forEach((model) => {
          portfolioMap[model.modelId] = {
            runId: run.id,
            modelId: model.modelId,
            modelName: model.modelName,
            cash: model.finalCash,
            totalValue: model.finalTotalValue,
            positions: model.finalPositions ?? [],
          };
        });

        const modelNameMap = new Map(
          run.models.map((model) => [model.modelId, model.modelName]),
        );

        const mappedTrades: TradeEvent[] = payload.trades
          .map((trade) => {
            const state = (trade.portfolioState ?? {}) as {
              positions?: Array<{ ticker: string; shares: number }>;
            };
            const positions = Array.isArray(state.positions)
              ? state.positions.filter(
                  (pos): pos is { ticker: string; shares: number } =>
                    typeof pos.ticker === "string" && typeof pos.shares === "number",
                )
              : [];
            const timestamp = trade.executedAt ?? trade.createdAt;
            return {
              runId: trade.backtestRunId ?? undefined,
              modelId: trade.modelId,
              modelName: modelNameMap.get(trade.modelId) ?? trade.modelId,
              action: trade.action,
              ticker: trade.ticker,
              shares: trade.shares,
              price: trade.price,
              cash:
                trade.cashAfter ??
                portfolioMap[trade.modelId]?.cash ??
                0,
              totalValue:
                trade.portfolioValueAfter ??
                portfolioMap[trade.modelId]?.totalValue ??
                trade.totalValue,
              positions,
              timestamp,
            };
          })
          .sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
          })
          .slice(0, MAX_TRADES);

        setSelectedRunId(run.id);
        setPortfolios(portfolioMap);
        const baselineDate = new Date(run.startDate);
        baselineDate.setHours(9, 30, 0, 0);
        const timeline = new Map<number, Record<string, number>>();
        const lastValues = new Map<string, number>();

        const recordPoint = (time: number, modelId: string, value: number) => {
          lastValues.set(modelId, value);
          const existing = timeline.get(time) ?? {};
          const merged: Record<string, number> = { ...existing };
          lastValues.forEach((val, id) => {
            merged[id] = val;
          });
          timeline.set(time, merged);
        };

        run.models.forEach((model) => {
          recordPoint(baselineDate.getTime(), model.modelId, BASELINE_CAPITAL);
        });

        const snapshotEvents = run.models
          .flatMap((model) =>
            model.snapshots.map((snapshot) => ({
              time: new Date(snapshot.date).getTime(),
              modelId: model.modelId,
              value: Number(snapshot.totalValue),
            })),
          )
          .sort((a, b) => a.time - b.time);

        snapshotEvents.forEach((event) => {
          recordPoint(event.time, event.modelId, event.value);
        });

        const nextHistory: HistoryPoint[] = Array.from(timeline.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([time, values]) => ({
            date: new Date(time).toISOString(),
            values,
          }));

        setHistory(nextHistory);
        lastValuesRef.current = lastValues;
        setTrades(mappedTrades);
      } catch (error) {
        console.error("Failed to load run detail", error);
      } finally {
        setRunDetailLoading(false);
      }
    },
    [],
  );

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    void fetchRunHistory();
  }, [fetchRunHistory]);
  useEffect(() => {
    currentRunIdRef.current = currentRunId;
  }, [currentRunId]);

  const updateHistoryPoint = useCallback(
    (timestamp: string | undefined, modelId: string, value: number) => {
      if (!timestamp) return;
      const parsed = Date.parse(timestamp);
      if (Number.isNaN(parsed)) return;
      const normalizedTimestamp = new Date(parsed).toISOString();
      const lastValues = lastValuesRef.current;
      lastValues.set(modelId, value);
      const snapshotValues: Record<string, number> = {};
      lastValues.forEach((val, id) => {
        snapshotValues[id] = val;
      });
      setHistory((previous) => {
        const index = previous.findIndex((entry) => entry.date === normalizedTimestamp);
        if (index >= 0) {
          const next = previous.slice();
          next[index] = {
            date: normalizedTimestamp,
            values: snapshotValues,
          };
          return next;
        }
        const next = [...previous, { date: normalizedTimestamp, values: snapshotValues }];
        next.sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        return next;
      });
    },
    [],
  );

  const handleStart = () => {
    if (running) {
      return;
    }

    stop();
    setSelectedRunId(null);
    setRunDetailLoading(false);
    setRunning(true);

    const params = new URLSearchParams({
      startDate,
      endDate,
      intervalMinutes: String(intervalMinutes),
      enriched: String(enriched),
      useTools: String(useTools),
    });

    const source = new EventSource(`/api/backtest/start?${params.toString()}`);
    esRef.current = source;

    source.addEventListener("run_started", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.runId && typeof payload.runId === "string") {
          setCurrentRunId(payload.runId);
          currentRunIdRef.current = payload.runId;
          setSelectedRunId(payload.runId);
          void fetchRunHistory();
        }
        lastValuesRef.current = new Map();
        const baselineTimestamp = payload?.params?.startDate
          ? `${payload.params.startDate}T09:30:00Z`
          : new Date().toISOString();
        if (Array.isArray(payload?.models)) {
          payload.models.forEach((model: { id: string }) => {
            lastValuesRef.current.set(model.id, BASELINE_CAPITAL);
            updateHistoryPoint(baselineTimestamp, model.id, BASELINE_CAPITAL);
          });
        }
      } catch (error) {
        console.error("Failed to parse run_started event", error);
      }
    });

    source.addEventListener("trade", (event: MessageEvent) => {
      const raw = JSON.parse(event.data);
      const activeRunId = currentRunIdRef.current;
      if (raw.runId && activeRunId && raw.runId !== activeRunId) {
        return;
      }
      const identity = ensureModelIdentity(raw);
      const normalized: TradeEvent = {
        ...raw,
        modelId: identity.id,
        modelName: identity.name,
      };

      setTrades((previous) => [normalized, ...previous].slice(0, MAX_TRADES));
      setPortfolios((previous) => {
        const existing = previous[identity.id];
        return {
          ...previous,
          [identity.id]: {
            runId: raw.runId ?? existing?.runId ?? activeRunId ?? undefined,
            modelId: identity.id,
            modelName: identity.name,
            cash: normalized.cash,
            totalValue: normalized.totalValue,
            positions: normalized.positions ?? existing?.positions ?? [],
          },
        };
      });
      updateHistoryPoint(raw.timestamp, identity.id, normalized.totalValue);
    });

    source.addEventListener("portfolio", (event: MessageEvent) => {
      const raw = JSON.parse(event.data);
      const activeRunId = currentRunIdRef.current;
      if (raw.runId && activeRunId && raw.runId !== activeRunId) {
        return;
      }
      const identity = ensureModelIdentity(raw);
      const normalized: PortfolioEvent = {
        ...raw,
        modelId: identity.id,
        modelName: identity.name,
        runId: raw.runId ?? activeRunId ?? undefined,
        positions: raw.positions ?? [],
      };
      setPortfolios((previous) => ({
        ...previous,
        [identity.id]: normalized,
      }));
      updateHistoryPoint(raw.timestamp, identity.id, normalized.totalValue);
    });

    source.addEventListener("eod_summary", (event: MessageEvent) => {
      const raw = JSON.parse(event.data);
      const activeRunId = currentRunIdRef.current;
      if (raw.runId && activeRunId && raw.runId !== activeRunId) {
        return;
      }
      raw.portfolios.forEach((portfolio: PortfolioEvent) => {
        const identity = ensureModelIdentity(portfolio);
        updateHistoryPoint(
          raw.timestamp ?? `${raw.dateISO}T23:59:59Z`,
          identity.id,
          portfolio.totalValue,
        );
      });
      setPortfolios((previous) => {
        const next = { ...previous };
        raw.portfolios.forEach((portfolio: PortfolioEvent) => {
          const identity = ensureModelIdentity(portfolio);
          next[identity.id] = {
            runId: raw.runId ?? activeRunId ?? undefined,
            modelId: identity.id,
            modelName: identity.name,
            cash: portfolio.cash,
            totalValue: portfolio.totalValue,
            positions: portfolio.positions ?? [],
          };
        });
        return next;
      });
    });

    source.addEventListener("run_complete", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const runId =
          payload?.runId && typeof payload.runId === "string"
            ? payload.runId
            : currentRunIdRef.current;
        stop(true);
        setSelectedRunId(runId ?? null);
        void fetchRunHistory();
        if (runId) {
          void loadRunDetail(runId);
        }
      } catch (error) {
        console.error("Failed to process run_complete event", error);
        stop(true);
      }
    });

    source.addEventListener("error", (event: MessageEvent) => {
      let runId: string | null = currentRunIdRef.current;
      try {
        if (event.data) {
          const payload = JSON.parse(event.data);
          if (payload?.runId && typeof payload.runId === "string") {
            runId = payload.runId;
          }
        }
      } catch (error) {
        console.error("Failed to parse error event payload", error);
      }
      stop();
      setSelectedRunId(runId);
      void fetchRunHistory();
      if (runId) {
        void loadRunDetail(runId);
      }
    });
  };

  const handleSelectRun = useCallback(
    (runId: string) => {
      if (running && currentRunIdRef.current && runId !== currentRunIdRef.current) {
        return;
      }
      setSelectedRunId(runId);
      if (running && currentRunIdRef.current === runId) {
        return;
      }
      void loadRunDetail(runId);
    },
    [loadRunDetail, running],
  );

  const chartData = useMemo<ChartDatum[]>(() => {
    return history
      .map((entry) => {
        const timestamp = new Date(entry.date).getTime();
        const row: ChartDatum = {
          date: Number.isFinite(timestamp) ? timestamp : BASELINE_TIMESTAMP,
        };
        Object.entries(entry.values).forEach(([modelId, value]) => {
          row[modelId] = value;
        });
        return row;
      })
      .sort((a, b) => a.date - b.date);
  }, [history]);

  const portfolioList = useMemo(
    () =>
      Object.values(portfolios).sort(
        (a, b) => b.totalValue - a.totalValue,
      ),
    [portfolios],
  );

  const modelIds = useMemo(() => {
    const ids = new Set<string>();
    portfolioList.forEach((portfolio) => ids.add(portfolio.modelId));
    history.forEach((entry) =>
      Object.keys(entry.values).forEach((id) => ids.add(id)),
    );
    trades.forEach((trade) => ids.add(trade.modelId));

    if (ids.size === 0) {
      Object.keys(MODEL_META).forEach((id) => ids.add(id));
    }

    return Array.from(ids);
  }, [portfolioList, history, trades]);

  const latestFromHistory = useMemo(() => {
    const map = new Map<string, number>();
    history.forEach((entry) => {
      Object.entries(entry.values).forEach(([id, value]) => {
        map.set(id, value);
      });
    });
    return map;
  }, [history]);

  const seriesMeta = useMemo(
    () =>
      modelIds.map((id) => {
        const portfolio = portfolios[id];
        const name = portfolio?.modelName ?? MODEL_META[id]?.name ?? id;
        const meta = getModelMeta(id, name);
        const latestValue =
          portfolio?.totalValue ?? latestFromHistory.get(id) ?? BASELINE_CAPITAL;
        return {
          id,
          name: meta.name,
          color: meta.color,
          icon: meta.icon,
          value: latestValue,
        };
      }),
    [modelIds, portfolios, latestFromHistory],
  );

  const resolvedChartData = useMemo(() => {
    if (chartData.length > 0) return chartData;
    const parsedEnd = Date.parse(endDate);
    const parsedStart = Date.parse(startDate);
    const fallbackDate = Number.isFinite(parsedEnd)
      ? parsedEnd
      : Number.isFinite(parsedStart)
        ? parsedStart
        : BASELINE_TIMESTAMP;
    const baselineRow: ChartDatum = { date: fallbackDate };
    modelIds.forEach((id) => {
      baselineRow[id] = BASELINE_CAPITAL;
    });
    return [baselineRow];
  }, [chartData, modelIds, startDate, endDate]);

  const percentChartData = useMemo(() => {
    if (resolvedChartData.length === 0) return resolvedChartData;
    const baselines = new Map<string, number>();

    // Determine baseline per model from earliest available values
    for (const row of resolvedChartData) {
      modelIds.forEach((id) => {
        if (!baselines.has(id) && typeof row[id] === "number") {
          baselines.set(id, row[id] as number);
        }
      });
      if (baselines.size === modelIds.length) {
        break;
      }
    }

    return resolvedChartData.map((row) => {
      const entry: ChartDatum = { date: row.date };
      modelIds.forEach((id) => {
        const value = row[id];
        if (typeof value === "number") {
          const baselineValue = baselines.get(id) ?? BASELINE_CAPITAL;
          const pct = baselineValue === 0 ? 0 : ((value - baselineValue) / baselineValue) * 100;
          entry[id] = Number.isFinite(pct) ? pct : 0;
        }
      });
      return entry;
    });
  }, [resolvedChartData, modelIds]);

  const tickerItems = useMemo(
    () =>
      portfolioList.map((portfolio) => {
        const meta = getModelMeta(portfolio.modelId, portfolio.modelName);
        return {
          id: portfolio.modelId,
          label: meta.name,
          value: portfolio.totalValue,
          icon: meta.icon,
          color: meta.color,
        };
      }),
    [portfolioList],
  );

  const summaryRows = useMemo(() => {
    const seen = new Set<string>();
    return seriesMeta
      .map((meta) => {
        const key = `${meta.name}-${meta.color}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          id: meta.id,
          name: meta.name,
          value: meta.value ?? BASELINE_CAPITAL,
          color: meta.color,
          icon: meta.icon,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [seriesMeta]);

  const chartSeriesData = mode === "currency" ? resolvedChartData : percentChartData;

  const handleStop = () => {
    stop();
    setSelectedRunId(null);
    void fetchRunHistory();
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-zinc-100">
      <ArenaHeader />
      <TickerStrip items={tickerItems} />
      <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6">
        <section className="rounded-lg border border-white/10 bg-[#181818] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Configure &amp; Stream Backtests
              </h2>
              <p className="text-xs text-zinc-500">
                Select the period, cadence, and tool settings to benchmark each model.
              </p>
            </div>
            <RunControls
              startDate={startDate}
              endDate={endDate}
              intervalMinutes={intervalMinutes}
              enriched={enriched}
              useTools={useTools}
              running={running}
              onChange={(updates) => {
                if (updates.startDate !== undefined) setStartDate(updates.startDate);
                if (updates.endDate !== undefined) setEndDate(updates.endDate);
                if (updates.intervalMinutes !== undefined)
                  setIntervalMinutes(updates.intervalMinutes);
                if (updates.enriched !== undefined) setEnriched(updates.enriched);
                if (updates.useTools !== undefined) setUseTools(updates.useTools);
              }}
              onStart={handleStart}
              onStop={handleStop}
            />
          </div>
          <div className="mt-6 rounded-t-lg border border-white/10 bg-[#151515] p-4">
            <PerformanceChart
              data={chartSeriesData}
              series={seriesMeta}
              mode={mode}
              onModeChange={setMode}
              baseline={mode === "currency" ? BASELINE_CAPITAL : 0}
            />
          </div>
          <ModelSummary rows={summaryRows} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[7fr_3fr]">
          <div className="flex flex-col gap-6">
            <TradeFeed trades={trades} />
            <PositionsPanel portfolios={portfolioList} />
          </div>
          <CompetitionSidebar
            runs={runHistory}
            selectedRunId={selectedRunId}
            currentRunId={currentRunId}
            loadingHistory={historyLoading}
            loadingDetail={runDetailLoading}
            running={running}
            onSelectRun={handleSelectRun}
            onRefresh={() => {
              void fetchRunHistory();
            }}
          />
        </section>
      </main>
    </div>
  );
}
