"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });

type PortfolioEvent = { modelId: string; modelName: string; cash: number; totalValue: number; positions: Array<{ticker:string; shares:number}> };
type TradeEvent = { modelId: string; modelName: string; action: string; ticker: string; shares: number; leverage?: number; price?: number; cash: number; totalValue: number; positions: Array<{ticker:string; shares:number}> };

export default function BacktestDashboardPage() {
  const [startDate, setStartDate] = useState('2025-09-01');
  const [endDate, setEndDate] = useState('2025-09-30');
  const [interval, setInterval] = useState(1440);
  const [enriched, setEnriched] = useState(true);
  const [useTools, setUseTools] = useState(true);
  const [running, setRunning] = useState(false);
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [portfolios, setPortfolios] = useState<Record<string, PortfolioEvent>>({});
  const [history, setHistory] = useState<Array<{date: string; values: Record<string, number>}>>([]);
  const esRef = useRef<EventSource | null>(null);

  const startRun = () => {
    if (running) return;
    setRunning(true);
    setTrades([]);
    setPortfolios({});
    setHistory([]);
    const params = new URLSearchParams({ startDate, endDate, intervalMinutes: String(interval), enriched: String(enriched), useTools: String(useTools) });
    const es = new EventSource(`/api/backtest/start?${params.toString()}`);
    esRef.current = es;
    es.addEventListener('run_started', () => {});
    es.addEventListener('trade', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setTrades(prev => [{...data}, ...prev].slice(0, 200));
      setPortfolios(prev => ({ ...prev, [data.modelId]: { modelId: data.modelId, modelName: data.modelName, cash: data.cash, totalValue: data.totalValue, positions: data.positions } }));
    });
    es.addEventListener('portfolio', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setPortfolios(prev => ({ ...prev, [data.modelId]: data }));
    });
    es.addEventListener('eod_summary', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const row: Record<string, number> = {};
      for (const p of data.portfolios) row[p.modelName] = p.totalValue;
      setHistory(prev => [...prev, { date: data.dateISO, values: row }]);
    });
    const stop = () => { setRunning(false); es.close(); esRef.current = null; };
    es.addEventListener('run_complete', stop);
    es.addEventListener('error', stop);
  };

  const stopRun = () => { esRef.current?.close(); esRef.current = null; setRunning(false); };

  const chartData = useMemo(() => {
    return history.map(h => ({ date: h.date, ...h.values }));
  }, [history]);

  const modelNames = useMemo(() => {
    const names = new Set<string>();
    history.forEach(h => Object.keys(h.values).forEach(n => names.add(n)));
    return Array.from(names);
  }, [history]);

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <h1>Backtest Dashboard</h1>
      <form onSubmit={(e) => { e.preventDefault(); startRun(); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label>Start: <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label>End: <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
        <label>Interval:
          <select value={interval} onChange={e => setInterval(Number(e.target.value))}>
            <option value={1440}>Daily 09:30</option>
            <option value={60}>Every 60 min</option>
            <option value={30}>Every 30 min</option>
          </select>
        </label>
        <label><input type="checkbox" checked={enriched} onChange={e => setEnriched(e.target.checked)} /> Enriched data</label>
        <label><input type="checkbox" checked={useTools} onChange={e => setUseTools(e.target.checked)} /> Analysis tools</label>
        <button type="submit" disabled={running}>Start</button>
        <button type="button" onClick={stopRun} disabled={!running}>Stop</button>
      </form>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>Trades</h3>
          <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
            {trades.map((t, i) => (
              <div key={i} style={{ fontFamily: 'monospace' }}>
                [{t.modelName}] {t.action} {t.shares} {t.ticker} @ {t.price ? `₹${t.price}` : '-'} {t.leverage && t.leverage > 1 ? `| ${t.leverage}x` : ''}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Leaderboard</h3>
          <ul>
            {Object.values(portfolios).sort((a,b)=>b.totalValue-a.totalValue).map(p => (
              <li key={p.modelId}>{p.modelName}: ₹{p.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h3>Performance</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {modelNames.map((name, idx) => (
                <Line key={name} type="monotone" dataKey={name} stroke={['#2563eb','#16a34a','#dc2626','#f59e0b'][idx % 4]} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h3>Portfolios</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {Object.values(portfolios).map(p => (
            <div key={p.modelId} style={{ border: '1px solid #eee', padding: 8 }}>
              <strong>{p.modelName}</strong>
              <div>Cash: ₹{p.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })} | Total: ₹{p.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div>
                {p.positions.length ? p.positions.map(pos => (
                  <span key={pos.ticker} style={{ marginRight: 8 }}>{pos.shares} {pos.ticker}</span>
                )) : <em>None</em>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
