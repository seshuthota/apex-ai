"use client";

import { useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const ReferenceLine = dynamic(() => import('recharts').then(m => m.ReferenceLine), { ssr: false });

type ChartRow = { date: string } & Record<string, number | string>;
type LatestDotProps = { cx?: number; cy?: number; index?: number };

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

  const chartData = useMemo<ChartRow[]>(() => {
    return history.map(h => ({ date: h.date, ...h.values }));
  }, [history]);

  const modelNames = useMemo(() => {
    const names = new Set<string>();
    history.forEach(h => Object.keys(h.values).forEach(n => names.add(n)));
    return Array.from(names);
  }, [history]);

  const lineColors = ['#7c3aed', '#16a34a', '#2563eb', '#f59e0b', '#dc2626', '#0ea5e9'];

  const formatCurrency = useCallback((value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, []);

  const latestPoints = useMemo(() => {
    const result: Record<string, { index: number; value: number; label: string }> = {};
    chartData.forEach((row, idx) => {
      modelNames.forEach(name => {
        const maybeValue = row[name];
        if (typeof maybeValue === 'number' && !Number.isNaN(maybeValue)) {
          result[name] = { index: idx, value: maybeValue, label: formatCurrency(maybeValue) };
        }
      });
    });
    return result;
  }, [chartData, modelNames, formatCurrency]);

  const baselineValue = useMemo(() => {
    if (!chartData.length || modelNames.length === 0) return undefined;
    const firstRow = chartData[0];
    const firstValue = firstRow[modelNames[0]];
    return typeof firstValue === 'number' ? firstValue : undefined;
  }, [chartData, modelNames]);

  const renderLatestDot = useCallback((name: string, color: string) => {
    const DotComponent = (props: LatestDotProps) => {
      const latest = latestPoints[name];
      if (!latest || props.index !== latest.index) return null;
      const { cx, cy } = props;
      if (typeof cx !== 'number' || typeof cy !== 'number') return null;

      const label = latest.label;
      const paddingX = 8;
      const boxHeight = 24;
      const textWidth = Math.max(label.length, 4) * 7;
      const boxWidth = textWidth + paddingX * 2;
      const boxX = cx + 10;
      const boxY = cy - boxHeight / 2;

      return (
        <g>
          <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={color} strokeWidth={2} />
          <rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} rx={6} ry={6} fill={color} />
          <text x={boxX + paddingX} y={cy} dominantBaseline="middle" fill="#fff" fontSize={12} fontWeight={600} textAnchor="start">
            {label}
          </text>
        </g>
      );
    };
    DotComponent.displayName = `${name}LatestDot`;
    return DotComponent;
  }, [latestPoints]);

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
            <LineChart data={chartData} margin={{ left: 20, right: 160, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#4b5563', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#d1d5db' }} />
              <YAxis stroke="#9ca3af" tick={{ fill: '#4b5563', fontSize: 12 }} width={80} tickLine={false} axisLine={{ stroke: '#d1d5db' }} />
              <Tooltip formatter={(value: unknown) => (typeof value === 'number' ? formatCurrency(value) : value)} labelFormatter={(label) => label} />
              <Legend />
              {baselineValue !== undefined && (
                <ReferenceLine
                  y={baselineValue}
                  stroke="#9ca3af"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                  label={{
                    value: `Start ${formatCurrency(baselineValue)}`,
                    position: 'insideRight',
                    fill: '#6b7280',
                    fontSize: 11,
                  }}
                />
              )}
              {modelNames.map((name, idx) => {
                const color = lineColors[idx % lineColors.length];
                return (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={color}
                    strokeWidth={2}
                    dot={renderLatestDot(name, color)}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                );
              })}
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
