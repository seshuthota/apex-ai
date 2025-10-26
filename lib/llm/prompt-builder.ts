import type { MarketDataPoint } from '@/lib/types';

interface TradingPromptContext {
  modelName: string;
  cashBalance: number;
  positions: Array<{ ticker: string; shares: number }>;
  marketData: MarketDataPoint[];
  watchlist: string[];
  marketTableLines?: string[]; // Optional enriched market table lines
}

export function buildTradingPrompt(
  context: TradingPromptContext,
  validationFeedback?: string,
  previousDecision?: any
): string {
  let feedbackSection = '';
  
  if (validationFeedback && previousDecision) {
    feedbackSection = `

⚠️ PREVIOUS DECISION WAS REJECTED:
Your previous decision: ${previousDecision.action} ${previousDecision.shares} shares of ${previousDecision.ticker}
Rejection reason: ${validationFeedback}

Please provide a REVISED decision that addresses this issue. Consider:
- Reducing position size to stay within risk limits (max 30% of portfolio)
- Choosing a different stock
- Or deciding to HOLD if no good opportunities exist

`;
  }

  return `You are ${context.modelName}, an autonomous AI trader competing in a trading competition on the NSE (National Stock Exchange of India).

YOUR GOAL: Maximize your portfolio value to win the competition.

CURRENT PORTFOLIO:
- Cash: ₹${context.cashBalance.toFixed(2)}
- Positions: ${context.positions.length === 0 ? 'None' : context.positions.map(p => `${p.shares} shares of ${p.ticker}`).join(', ')}
${feedbackSection}
MARKET DATA (NSE):
${context.marketTableLines && context.marketTableLines.length > 0
    ? context.marketTableLines.join('\n')
    : context.marketData.map(d => `${d.ticker}: ₹${d.price.toFixed(2)} (${d.change > 0 ? '+' : ''}${d.change.toFixed(2)}%)`).join('\n')}

RULES:
1. You can only trade NSE stocks from the watchlist: ${context.watchlist.join(', ')}
2. You cannot short stocks (sell what you don't own)
3. Leverage is allowed up to 20x (optional). If you use leverage, your total exposure must stay within your leverage limit. Negative cash means borrowed funds.
4. Consider risk management - don't put all your money in one stock
5. Trading only allowed during NSE hours (9:15 AM - 3:30 PM IST)
6. Maximum position size: 30% of total portfolio value per stock

AVAILABLE ACTIONS:
- BUY: Purchase shares of a stock
- SELL: Sell shares you currently own
- HOLD: Make no trade this cycle

TOOL PROTOCOL (optional first round):
You may FIRST request additional analysis before deciding by returning ONLY this JSON:
{
  "type": "request_data",
  "tickers": ["TCS", "INFY"],
  "metrics": ["history_30d", "indicators"]
}

Otherwise, respond directly with FINAL decision in exactly this JSON (no other text):
{
  "action": "BUY" | "SELL" | "HOLD",
  "ticker": "RELIANCE",
  "shares": 10,
  "reasoning": "Your strategic analysis here (2-3 sentences max)",
  "leverage": 1 | 5 | 10 | 20 // optional; default 1
}

If action is HOLD, set ticker to null and shares to 0.

Make your decision now:`;
}
