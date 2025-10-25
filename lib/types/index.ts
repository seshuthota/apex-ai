// Apex AI - Type Definitions

// Trade Decision from LLM
export interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  ticker: string | null;
  shares: number;
  reasoning: string;
}

// Market Data Point
export interface MarketDataPoint {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
}

// News Article
export interface NewsArticle {
  title: string;
  summary: string;
  source?: string;
  publishedAt?: Date;
}

// Portfolio Valuation
export interface PortfolioValuation {
  totalValue: number;
  cashBalance: number;
  positionsValue: number;
  returnPct: number;
}

// Broker Order Result
export interface BrokerOrderResult {
  orderId: string;
  status: string;
  filledPrice?: number;
}

// Model with calculated values for leaderboard
export interface LeaderboardModel {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  logo?: string | null;
  totalValue: number;
  returnPct: number;
  rank?: number;
}
