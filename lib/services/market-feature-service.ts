import type { MarketDataPoint } from '@/lib/types';

type HistoryPoint = { price: number; timestamp: number; volume?: number };

export class MarketFeatureService {
  private history: Map<string, HistoryPoint[]> = new Map();
  private maxLen: number;

  constructor(maxLen: number = 200) {
    this.maxLen = maxLen;
  }

  update(tickers: string[], points: MarketDataPoint[]) {
    const byTicker = new Map(points.map(p => [p.ticker, p]));
    const now = Date.now();
    for (const t of tickers) {
      const p = byTicker.get(t);
      if (!p) continue;
      const arr = this.history.get(t) || [];
      arr.push({ price: p.price, timestamp: now, volume: p.volume });
      if (arr.length > this.maxLen) arr.shift();
      this.history.set(t, arr);
    }
  }

  getHistory(ticker: string, lastN: number = 30): HistoryPoint[] {
    const arr = this.history.get(ticker) || [];
    return arr.slice(Math.max(0, arr.length - lastN));
  }

  getIndicatorsSnapshot(tickers: string[]): Array<{
    ticker: string;
    price: number;
    changePct?: number;
    volume: number;
    return5d?: number;
    sma20?: number;
    sma50?: number;
    rsi14?: number;
    volatility20?: number; // stdev of returns %
    atr20?: number; // proxy based on avg abs return * price
  }> {
    const out: any[] = [];
    for (const t of tickers) {
      const arr = this.history.get(t) || [];
      const n = arr.length;
      if (n === 0) {
        out.push({ ticker: t, price: 0, volume: 0 });
        continue;
      }
      const price = arr[n - 1].price;
      const volume = arr[n - 1].volume || 0;
      const prev = n > 1 ? arr[n - 2].price : undefined;
      const changePct = prev ? ((price - prev) / prev) * 100 : undefined;
      const returns = [] as number[]; // percent returns
      for (let i = 1; i < n; i++) {
        const r = (arr[i].price - arr[i - 1].price) / arr[i - 1].price;
        returns.push(r * 100);
      }
      const sma = (k: number) => {
        if (n < k) return undefined;
        let s = 0;
        for (let i = n - k; i < n; i++) s += arr[i].price;
        return s / k;
      };
      const return5d = n > 5 ? ((price / arr[n - 6].price) - 1) * 100 : undefined;
      const sma20 = sma(20);
      const sma50 = sma(50);
      const rsi14 = this.computeRSI(returns, 14);
      const volatility20 = this.std(returns.slice(Math.max(0, returns.length - 20)));
      const atr20 = this.avgAbs(returns.slice(Math.max(0, returns.length - 20))) * (price / 100); // proxy

      out.push({ ticker: t, price, changePct, volume, return5d, sma20, sma50, rsi14, volatility20, atr20 });
    }
    return out;
  }

  private computeRSI(returnsPct: number[], period: number): number | undefined {
    if (returnsPct.length < period) return undefined;
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = returnsPct.length - period; i < returnsPct.length; i++) {
      const r = returnsPct[i];
      if (r >= 0) gains.push(r); else losses.push(-r);
    }
    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0.00001;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0.00001;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private std(data: number[]): number | undefined {
    if (data.length === 0) return undefined;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const v = data.reduce((s, x) => s + (x - mean) * (x - mean), 0) / data.length;
    return Math.sqrt(v);
  }

  private avgAbs(data: number[]): number {
    if (data.length === 0) return 0;
    return data.reduce((s, x) => s + Math.abs(x), 0) / data.length;
  }
}
