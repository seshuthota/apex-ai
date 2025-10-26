import type { ReactNode } from "react";

export type TradeEvent = {
  runId?: string;
  modelId: string;
  modelName: string;
  action: string;
  ticker: string;
  shares: number;
  leverage?: number;
  price?: number;
  cash: number;
  totalValue: number;
  positions?: Array<{ ticker: string; shares: number }>;
  timestamp?: string;
};

export type PortfolioEvent = {
  runId?: string;
  modelId: string;
  modelName: string;
  cash: number;
  totalValue: number;
  positions: Array<{ ticker: string; shares: number }>;
};

export type HistoryPoint = {
  date: string;
  values: Record<string, number>;
};

export type ModelMeta = {
  id: string;
  name: string;
  color: string;
  icon: ReactNode;
};

export type BacktestRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type RunModelSummary = {
  modelId: string;
  modelName: string;
  finalCash: number;
  finalPositionsValue: number;
  finalTotalValue: number;
  returnPct: number;
  rank: number | null;
  finalPositions: Array<{ ticker: string; shares: number }>;
};

export type RunSummary = {
  id: string;
  status: BacktestRunStatus;
  startDate: string;
  endDate: string;
  intervalMinutes: number;
  enriched: boolean;
  useTools: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  tradingDays: number | null;
  totalTrades: number | null;
  durationMs: number | null;
  models: RunModelSummary[];
};

export type RunSnapshot = {
  id: string;
  date: string;
  totalValue: number;
  cash: number | null;
  positionsValue: number | null;
  returnPct: number | null;
};

export type RunModelDetail = RunModelSummary & {
  snapshots: RunSnapshot[];
};

export type RunDetail = Omit<RunSummary, "models"> & {
  models: RunModelDetail[];
};

export type RunTrade = {
  id: string;
  modelId: string;
  backtestRunId: string | null;
  ticker: string;
  action: string;
  shares: number;
  price: number;
  totalValue: number;
  status: string;
  brokerOrderId: string | null;
  createdAt: string;
  executedAt: string | null;
  cashAfter: number | null;
  portfolioValueAfter: number | null;
  portfolioState: unknown;
};
