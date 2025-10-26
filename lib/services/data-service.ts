/**
 * Data Service - Real Implementation
 * 
 * Fetches real market data from:
 * 1. Zerodha Kite Connect (primary)
 * 2. Yahoo Finance India (fallback)
 * 
 * Also fetches Indian business news from NewsAPI
 */

import { KiteConnect } from 'kiteconnect';
import { prisma } from '@/lib/db/prisma';
import type { MarketDataPoint, NewsArticle } from '@/lib/types';

const ZERODHA_API_KEY =
  process.env.ZERODHA_API_KEY ?? process.env.KITE_API_KEY ?? '';
const ZERODHA_ACCESS_TOKEN =
  process.env.ZERODHA_ACCESS_TOKEN ?? process.env.KITE_ACCESS_TOKEN ?? '';

export class DataService {
  private kite: KiteConnect | null = null;
  private newsApiKey: string;

  constructor() {
    // Initialize Kite Connect if credentials are available
    if (ZERODHA_API_KEY && ZERODHA_ACCESS_TOKEN) {
      this.kite = new KiteConnect({
        api_key: ZERODHA_API_KEY,
      });
      this.kite.setAccessToken(ZERODHA_ACCESS_TOKEN);
      console.log('✅ Kite Connect initialized using ZERODHA_* credentials');
    } else {
      console.warn(
        '⚠️ Zerodha Kite Connect credentials not configured (expected ZERODHA_API_KEY and ZERODHA_ACCESS_TOKEN). Falling back to Yahoo Finance.',
      );
    }

    this.newsApiKey = process.env.NEWS_API_KEY || '';
    if (!this.newsApiKey) {
      console.warn('⚠️ NEWS_API_KEY not configured');
    }
  }

  /**
   * Fetch market data for given tickers
   * Tries Kite Connect first, falls back to Yahoo Finance
   */
  async getMarketData(tickers: string[]): Promise<MarketDataPoint[]> {
    // Try Kite Connect first
    if (this.kite) {
      try {
        const kiteData = await this.fetchFromKite(tickers);
        if (kiteData.length > 0) {
          // Cache successful data
          await this.cacheMarketData(kiteData);
          return kiteData;
        }
      } catch (error) {
        console.error('Kite Connect error, falling back to Yahoo Finance:', error);
      }
    }

    // Fallback to Yahoo Finance
    try {
      const yahooData = await this.fetchFromYahoo(tickers);
      if (yahooData.length > 0) {
        await this.cacheMarketData(yahooData);
        return yahooData;
      }
    } catch (error) {
      console.error('Yahoo Finance error:', error);
    }

    // Last resort: return cached data if available
    const cachedData = await this.getCachedData(tickers);
    if (cachedData.length > 0) {
      console.warn('⚠️ Using cached market data');
      return cachedData;
    }

    throw new Error('Failed to fetch market data from all sources');
  }

  /**
   * Fetch data from Zerodha Kite Connect
   */
  private async fetchFromKite(tickers: string[]): Promise<MarketDataPoint[]> {
    if (!this.kite) throw new Error('Kite Connect not initialized');

    const results: MarketDataPoint[] = [];
    
    // Convert NSE tickers to Kite format (NSE:SYMBOL)
    const instruments = tickers.map(ticker => `NSE:${ticker}`);
    
    // Fetch quotes
    const quotes = await this.kite.getQuote(instruments);
    
    for (const ticker of tickers) {
      const instrumentKey = `NSE:${ticker}`;
      const quote = quotes[instrumentKey];
      
      if (quote && quote.last_price) {
        const change = quote.last_price - quote.ohlc.open;
        const changePct = (change / quote.ohlc.open) * 100;
        
        results.push({
          ticker,
          price: quote.last_price,
          change,
          changePct,
          volume: quote.volume || 0,
        });
      }
    }
    
    console.log(`✅ Fetched ${results.length} stocks from Kite Connect`);
    return results;
  }

  /**
   * Fetch data from Yahoo Finance (fallback)
   */
  private async fetchFromYahoo(tickers: string[]): Promise<MarketDataPoint[]> {
    const results: MarketDataPoint[] = [];
    
    for (const ticker of tickers) {
      try {
        // Yahoo Finance uses .NS suffix for NSE stocks
        const symbol = `${ticker}.NS`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        
        if (!response.ok) {
          console.warn(`Yahoo Finance error for ${ticker}: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        if (data.chart && data.chart.result && data.chart.result[0]) {
          const result = data.chart.result[0];
          const quote = result.meta;
          const prevClose = quote.previousClose || quote.chartPreviousClose;
          const currentPrice = quote.regularMarketPrice;
          
          if (currentPrice && prevClose) {
            const change = currentPrice - prevClose;
            const changePct = (change / prevClose) * 100;
            
            results.push({
              ticker,
              price: currentPrice,
              change,
              changePct,
              volume: result.indicators?.quote?.[0]?.volume?.[0] || 0,
            });
          }
        }
      } catch (error) {
        console.error(`Failed to fetch ${ticker} from Yahoo Finance:`, error);
      }
    }
    
    console.log(`✅ Fetched ${results.length} stocks from Yahoo Finance`);
    return results;
  }

  /**
   * Get current price for a single ticker (used by broker service)
   */
  async getCurrentPrice(ticker: string): Promise<number> {
    const data = await this.getMarketData([ticker]);
    if (data.length === 0) {
      throw new Error(`Failed to get price for ${ticker}`);
    }
    return data[0].price;
  }

  /**
   * Fetch Indian business news
   */
  async getNews(limit: number = 10): Promise<NewsArticle[]> {
    if (!this.newsApiKey) {
      console.warn('⚠️ NEWS_API_KEY not configured, returning empty news');
      return [];
    }

    try {
      // Fetch Indian business news
      const url = `https://newsapi.org/v2/top-headlines?country=in&category=business&language=en&pageSize=${limit}&apiKey=${this.newsApiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`NewsAPI error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      
      if (data.status === 'ok' && data.articles) {
        const articles = data.articles.map((article: any) => ({
          title: article.title,
          summary: article.description || article.title,
          source: article.source?.name,
          publishedAt: article.publishedAt ? new Date(article.publishedAt) : undefined,
        }));
        
        console.log(`✅ Fetched ${articles.length} news articles`);
        return articles;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch news:', error);
      return [];
    }
  }

  /**
   * Cache market data in database
   */
  private async cacheMarketData(data: MarketDataPoint[]): Promise<void> {
    try {
      const timestamp = new Date();
      
      for (const point of data) {
        await prisma.marketData.create({
          data: {
            ticker: point.ticker,
            price: point.price,
            change: point.change,
            changePct: point.changePct,
            volume: point.volume,
            timestamp,
          },
        });
      }
    } catch (error) {
      console.error('Failed to cache market data:', error);
    }
  }

  /**
   * Get cached market data (fallback when APIs fail)
   */
  private async getCachedData(tickers: string[]): Promise<MarketDataPoint[]> {
    const results: MarketDataPoint[] = [];
    
    for (const ticker of tickers) {
      // Get most recent cached data (within last 1 hour)
      const cached = await prisma.marketData.findFirst({
        where: {
          ticker,
          timestamp: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last 1 hour
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });
      
      if (cached) {
        results.push({
          ticker: cached.ticker,
          price: Number(cached.price),
          change: Number(cached.change),
          changePct: Number(cached.changePct),
          volume: Number(cached.volume),
        });
      }
    }
    
    return results;
  }

  /**
   * Check if market is open (NSE trading hours: 9:15 AM - 3:30 PM IST)
   */
  isMarketOpen(): boolean {
    const now = new Date();
    
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const day = istTime.getUTCDay(); // 0 = Sunday, 6 = Saturday
    
    // Check if it's a weekend
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Check if within trading hours (9:15 AM - 3:30 PM)
    const currentMinutes = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM
    
    return currentMinutes >= marketOpen && currentMinutes <= marketClose;
  }

  /**
   * Get current IST time
   */
  getCurrentISTTime(): Date {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset);
  }
}
