import type { MarketDataPoint, NewsArticle } from './market';
import type { BrokerOrderResult } from './portfolio';

export interface IDataService {
  getMarketData(tickers: string[]): Promise<MarketDataPoint[]>;
  getCurrentPrice(ticker: string): Promise<number>;
  getNews?(limit?: number): Promise<NewsArticle[]>;
  isMarketOpen?(): boolean;
  getCurrentISTTime?(): Date;
}

export interface IBrokerService {
  submitOrder(params: { ticker: string; action: 'BUY' | 'SELL'; shares: number }): Promise<BrokerOrderResult>;
  getCurrentPrice(ticker: string): Promise<number>;
  getOrderStatus?(orderId: string): Promise<string>;
  cancelOrder?(orderId: string, variety?: string): Promise<void>;
  isAvailable?(): boolean;
}
