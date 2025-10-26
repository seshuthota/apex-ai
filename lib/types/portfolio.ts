// Portfolio-related types

export interface PortfolioValuation {
  totalValue: number;
  cashBalance: number;
  positionsValue: number;
  returnPct: number;
}

export interface BrokerOrderResult {
  orderId: string;
  status: string;
  filledPrice?: number;
}

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
