// Market-related types

export interface MarketDataPoint {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
}

export interface NewsArticle {
  title: string;
  summary: string;
  source?: string;
  publishedAt?: Date;
}
