-- CreateEnum
CREATE TYPE "LLMProvider" AS ENUM ('GEMINI_PRO', 'GEMINI_FLASH', 'GPT4', 'GPT4_TURBO', 'CLAUDE_SONNET', 'CLAUDE_OPUS', 'OPENROUTER_CLAUDE', 'OPENROUTER_GPT4', 'OPENROUTER_GEMINI', 'OPENROUTER_LLAMA', 'OPENROUTER_MISTRAL', 'OPENROUTER_MINIMAX', 'OPENROUTER_GEMINI_25_PRO', 'OPENROUTER_DEEPSEEK');

-- CreateEnum
CREATE TYPE "TradeAction" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'FILLED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "BacktestRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" "LLMProvider" NOT NULL,
    "logo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "cashBalance" DECIMAL(15,2) NOT NULL DEFAULT 100000,
    "initialValue" DECIMAL(15,2) NOT NULL DEFAULT 100000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "avgCost" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "backtestRunId" TEXT,
    "ticker" TEXT NOT NULL,
    "action" "TradeAction" NOT NULL,
    "shares" INTEGER NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "totalValue" DECIMAL(15,2) NOT NULL,
    "cashAfter" DECIMAL(15,2),
    "portfolioValueAfter" DECIMAL(15,2),
    "portfolioState" JSONB,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "brokerOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "backtestRunId" TEXT,
    "reasoning" TEXT NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "responseTokens" INTEGER,
    "tradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "backtestRunId" TEXT,
    "totalValue" DECIMAL(15,2) NOT NULL,
    "cashBalance" DECIMAL(15,2) NOT NULL,
    "positionsValue" DECIMAL(15,2) NOT NULL,
    "returnPct" DECIMAL(10,4) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1000,
    "maxPositionSize" DECIMAL(3,2) NOT NULL DEFAULT 0.3,
    "maxTradesPerDay" INTEGER NOT NULL DEFAULT 10,
    "watchlist" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketData" (
    "ticker" TEXT NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "change" DECIMAL(15,2) NOT NULL,
    "changePct" DECIMAL(10,4) NOT NULL,
    "volume" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketData_pkey" PRIMARY KEY ("ticker","timestamp")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "intervalMinutes" INTEGER NOT NULL,
    "enriched" BOOLEAN NOT NULL DEFAULT true,
    "useTools" BOOLEAN NOT NULL DEFAULT true,
    "status" "BacktestRunStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "tradingDays" INTEGER,
    "totalTrades" INTEGER,
    "durationMs" INTEGER,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRunModel" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "finalCash" DECIMAL(15,2) NOT NULL,
    "finalPositionsValue" DECIMAL(15,2) NOT NULL,
    "finalTotalValue" DECIMAL(15,2) NOT NULL,
    "returnPct" DECIMAL(10,4) NOT NULL,
    "rank" INTEGER,
    "finalPositions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestRunModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRunSnapshot" (
    "id" TEXT NOT NULL,
    "runModelId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalValue" DECIMAL(15,2) NOT NULL,
    "cash" DECIMAL(15,2),
    "positionsValue" DECIMAL(15,2),
    "returnPct" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestRunSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Model_name_key" ON "Model"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_modelId_key" ON "Portfolio"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_portfolioId_ticker_key" ON "Position"("portfolioId", "ticker");

-- CreateIndex
CREATE INDEX "Trade_modelId_createdAt_idx" ON "Trade"("modelId", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_backtestRunId_createdAt_idx" ON "Trade"("backtestRunId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionLog_modelId_createdAt_idx" ON "DecisionLog"("modelId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionLog_backtestRunId_createdAt_idx" ON "DecisionLog"("backtestRunId", "createdAt");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_portfolioId_timestamp_idx" ON "PortfolioSnapshot"("portfolioId", "timestamp");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_backtestRunId_timestamp_idx" ON "PortfolioSnapshot"("backtestRunId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ModelConfig_modelId_key" ON "ModelConfig"("modelId");

-- CreateIndex
CREATE INDEX "MarketData_ticker_idx" ON "MarketData"("ticker");

-- CreateIndex
CREATE INDEX "SystemLog_level_timestamp_idx" ON "SystemLog"("level", "timestamp");

-- CreateIndex
CREATE INDEX "BacktestRunModel_modelId_idx" ON "BacktestRunModel"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestRunModel_runId_modelId_key" ON "BacktestRunModel"("runId", "modelId");

-- CreateIndex
CREATE INDEX "BacktestRunSnapshot_runModelId_date_idx" ON "BacktestRunSnapshot"("runModelId", "date");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelConfig" ADD CONSTRAINT "ModelConfig_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRunModel" ADD CONSTRAINT "BacktestRunModel_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRunModel" ADD CONSTRAINT "BacktestRunModel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRunSnapshot" ADD CONSTRAINT "BacktestRunSnapshot_runModelId_fkey" FOREIGN KEY ("runModelId") REFERENCES "BacktestRunModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
