/**
 * Mock Data Service
 * 
 * Used for development and testing without API keys.
 * Returns realistic NSE market data and Indian news.
 */

import type { MarketDataPoint, NewsArticle } from '@/lib/types';

// Mock NSE stock prices (realistic ranges)
const mockPrices: Record<string, { base: number; volatility: number }> = {
  RELIANCE: { base: 2450, volatility: 50 },
  TCS: { base: 3650, volatility: 40 },
  INFY: { base: 1520, volatility: 30 },
  HDFCBANK: { base: 1640, volatility: 25 },
  ICICIBANK: { base: 1050, volatility: 20 },
  SBIN: { base: 610, volatility: 15 },
  BHARTIARTL: { base: 1550, volatility: 30 },
  ITC: { base: 445, volatility: 10 },
  KOTAKBANK: { base: 1750, volatility: 35 },
  LT: { base: 3500, volatility: 60 },
};

// Mock Indian business news headlines
const mockNewsHeadlines = [
  {
    title: 'Reliance Industries reports strong Q4 results, beats estimates',
    summary: 'RIL posts highest-ever quarterly profit driven by retail and telecom growth',
  },
  {
    title: 'Indian IT sector sees 15% growth in exports this quarter',
    summary: 'TCS and Infosys lead the charge with strong digital transformation deals',
  },
  {
    title: 'HDFC Bank announces merger completion, becomes largest private bank',
    summary: 'Combined entity now has over ₹20 lakh crore in assets',
  },
  {
    title: 'Nifty 50 crosses 22,000 mark on strong FII inflows',
    summary: 'Foreign institutional investors pour $2 billion into Indian equities',
  },
  {
    title: 'SEBI announces new regulations for algo trading platforms',
    summary: 'New guidelines aim to improve market transparency and investor protection',
  },
  {
    title: 'India\'s GDP growth projected at 7.5% for FY2024-25',
    summary: 'Strong consumption and investment drive economic expansion',
  },
  {
    title: 'Bharti Airtel 5G rollout reaches 100 cities across India',
    summary: 'Telecom giant reports 50% increase in data consumption',
  },
  {
    title: 'ITC plans major expansion in FMCG and hotel businesses',
    summary: 'Diversification strategy to reduce tobacco dependency',
  },
];

export class MockDataService {
  private priceHistory: Map<string, number> = new Map();

  constructor() {
    // Initialize with base prices
    Object.entries(mockPrices).forEach(([ticker, { base }]) => {
      this.priceHistory.set(ticker, base);
    });
  }

  async getMarketData(tickers: string[]): Promise<MarketDataPoint[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const results: MarketDataPoint[] = [];

    for (const ticker of tickers) {
      const config = mockPrices[ticker];
      if (!config) {
        console.warn(`Mock data not available for ${ticker}`);
        continue;
      }

      const previousPrice = this.priceHistory.get(ticker) || config.base;
      
      // Generate realistic price movement (random walk)
      const changePercent = (Math.random() - 0.5) * 4; // -2% to +2%
      const change = previousPrice * (changePercent / 100);
      const newPrice = previousPrice + change;
      
      // Add some volatility
      const volatilityChange = (Math.random() - 0.5) * (config.volatility / 10);
      const finalPrice = Math.max(newPrice + volatilityChange, config.base * 0.8); // Don't go below 80% of base

      // Store for next iteration
      this.priceHistory.set(ticker, finalPrice);

      // Generate realistic volume (in lakhs)
      const baseVolume = 5000000; // 50 lakh shares
      const volume = Math.floor(baseVolume * (0.5 + Math.random()));

      results.push({
        ticker,
        price: Number(finalPrice.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePct: Number(changePercent.toFixed(2)),
        volume,
      });
    }

    console.log(`📊 Mock market data fetched for ${tickers.length} stocks`);
    return results;
  }

  async getNews(limit: number = 10): Promise<NewsArticle[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Shuffle and return random news
    const shuffled = [...mockNewsHeadlines].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(limit, mockNewsHeadlines.length));

    console.log(`📰 Mock news fetched: ${selected.length} articles`);
    return selected;
  }

  async getCurrentPrice(ticker: string): Promise<number> {
    const config = mockPrices[ticker];
    if (!config) {
      throw new Error(`Mock price not available for ${ticker}`);
    }

    return this.priceHistory.get(ticker) || config.base;
  }

  /**
   * Reset prices to base values (useful for testing)
   */
  resetPrices(): void {
    Object.entries(mockPrices).forEach(([ticker, { base }]) => {
      this.priceHistory.set(ticker, base);
    });
    console.log('🔄 Mock prices reset to base values');
  }

  /**
   * Simulate a market crash (for testing)
   */
  simulateCrash(percentage: number = 5): void {
    this.priceHistory.forEach((price, ticker) => {
      const newPrice = price * (1 - percentage / 100);
      this.priceHistory.set(ticker, newPrice);
    });
    console.log(`📉 Simulated ${percentage}% market crash`);
  }

  /**
   * Simulate a market rally (for testing)
   */
  simulateRally(percentage: number = 5): void {
    this.priceHistory.forEach((price, ticker) => {
      const newPrice = price * (1 + percentage / 100);
      this.priceHistory.set(ticker, newPrice);
    });
    console.log(`📈 Simulated ${percentage}% market rally`);
  }
}
