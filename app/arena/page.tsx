"use client";

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });

type TradeEvent = { modelId: string; modelName: string; action: string; ticker: string; shares: number; leverage?: number; price?: number; cash: number; totalValue: number; positions: Array<{ticker:string; shares:number}> };
type PortfolioEvent = { modelId: string; modelName: string; cash: number; totalValue: number; positions: Array<{ticker:string; shares:number}> };

export default function ArenaPage() {
  const [startDate, setStartDate] = useState('2025-09-01');
  const [endDate, setEndDate] = useState('2025-09-30');
  const [intervalMinutes, setIntervalMinutes] = useState(1440);
  const [enriched, setEnriched] = useState(true);
  const [useTools, setUseTools] = useState(true);
  const [running, setRunning] = useState(false);

  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [portfolios, setPortfolios] = useState<Record<string, PortfolioEvent>>({});
  const [history, setHistory] = useState<Array<{ date: string; values: Record<string, number> }>>([]);
  const esRef = useRef<EventSource | null>(null);

  const start = () => {
    if (running) return;
    setRunning(true);
    setTrades([]); setPortfolios({}); setHistory([]);
    const sp = new URLSearchParams({ startDate, endDate, intervalMinutes: String(intervalMinutes), enriched: String(enriched), useTools: String(useTools) });
    const es = new EventSource(`/api/backtest/start?${sp.toString()}`);
    esRef.current = es;
    es.addEventListener('trade', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setTrades(prev => [data, ...prev].slice(0, 200));
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
    const stop = () => { es.close(); setRunning(false); esRef.current = null; };
    es.addEventListener('run_complete', stop);
    es.addEventListener('error', stop);
  };

  const stop = () => { esRef.current?.close(); esRef.current = null; setRunning(false); };

  const chartData = useMemo(() => history.map(h => ({ date: h.date, ...h.values })), [history]);
  const modelNames = useMemo(() => {
    const s = new Set<string>();
    history.forEach(h => Object.keys(h.values).forEach(n => s.add(n)));
    return Array.from(s);
  }, [history]);

  const stripModels = useMemo(() => Object.values(portfolios).sort((a,b)=>b.totalValue-a.totalValue), [portfolios]);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', minHeight: '100vh' }}>
      {/* Top Nav */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #333' }}>
        <div style={{ fontWeight: 700 }}>Alpha Arena (Apex)</div>
        <nav style={{ display: 'flex', gap: 16 }}>
          <a>Live</a>
          <a>Leaderboard</a>
          <a>Models</a>
        </nav>
      </header>

      {/* Ticker strip */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 24, padding: '8px 16px', borderBottom: '1px solid #333' }}>
        {stripModels.length === 0 && (<span>—</span>)}
        {stripModels.map(p => (
          <div key={p.modelId} style={{ whiteSpace: 'nowrap' }}>
            <strong>{p.modelName}</strong> ₹{p.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: 16, padding: 16 }}>
        {/* Left: Chart + tabs */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Total Account Value</h3>
            <form onSubmit={(e)=>{ e.preventDefault(); start(); }} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
              <select value={intervalMinutes} onChange={e=>setIntervalMinutes(Number(e.target.value))}>
                <option value={1440}>Daily 09:30</option>
                <option value={60}>Every 60m</option>
                <option value={30}>Every 30m</option>
              </select>
              <label><input type="checkbox" checked={enriched} onChange={e=>setEnriched(e.target.checked)} /> Enriched</label>
              <label><input type="checkbox" checked={useTools} onChange={e=>setUseTools(e.target.checked)} /> Tools</label>
              <button type="submit" disabled={running}>Start</button>
              <button type="button" onClick={stop} disabled={!running}>Stop</button>
            </form>
          </div>

          <div style={{ width: '100%', height: 420, border: '1px solid #333' }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {modelNames.map((name, idx) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={['#7c3aed','#16a34a','#2563eb','#f59e0b','#dc2626','#0ea5e9'][idx % 6]} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <h4 style={{ marginTop: 0 }}>Completed Trades</h4>
              <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #333', padding: 8 }}>
                {trades.map((t, i) => (
                  <div key={i} style={{ fontFamily: 'monospace', padding: '2px 0' }}>
                    [{t.modelName}] {t.action} {t.shares} {t.ticker} @ {t.price ? `₹${t.price}` : '-'} {t.leverage && t.leverage > 1 ? `| ${t.leverage}x` : ''}
                  </div>
                ))}
                {trades.length === 0 && <em>No trades yet</em>}
              </div>
            </div>
            <div>
              <h4 style={{ marginTop: 0 }}>Positions</h4>
              <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #333', padding: 8 }}>
                {Object.values(portfolios).map(p => (
                  <div key={p.modelId} style={{ marginBottom: 12 }}>
                    <strong>{p.modelName}</strong> — Cash ₹{p.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}, Total ₹{p.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    <div style={{ fontFamily: 'monospace' }}>
                      {p.positions.length ? p.positions.map(pos => (
                        <span key={pos.ticker} style={{ marginRight: 8 }}>{pos.shares} {pos.ticker}</span>
                      )) : <em>None</em>}
                    </div>
                  </div>
                ))}
                {Object.values(portfolios).length === 0 && <em>No positions yet</em>}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside>
          <div style={{ border: '1px solid #333', padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>A Better Benchmark</h3>
            <p>Each model is given ₹100,000, identical prompts and input data, and trades the NSE mock stream. We stream live results here.</p>
            <h4>Competition Rules</h4>
            <ul>
              <li>Starting Capital: ₹100,000 per model</li>
              <li>Market: NSE mock prices (or real if configured)</li>
              <li>Objective: Maximize risk‑adjusted returns</li>
              <li>Transparency: All trades and decisions recorded</li>
              <li>Autonomy: Each AI produces trades and manages risk</li>
              <li>Leverage: up to 20x with margin checks</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
