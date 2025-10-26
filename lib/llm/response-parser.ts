import { z } from 'zod';
import { TradeDecisionSchema, type TradeDecision } from '@/lib/types/trading';

export function parseTradeDecision(rawResponse: string): TradeDecision {
  // Extract JSON from markdown code blocks if present
  let jsonStr = rawResponse.trim();
  
  // Try to extract JSON from markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  // Try to find JSON object in the response
  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    jsonStr = jsonObjectMatch[0];
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    const result = TradeDecisionSchema.parse(parsed);
    return { ...result, leverage: result.leverage ?? 1 };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid trade decision format: ${error.issues.map((e) => e.message).join(', ')}`
      );
    }
    throw new Error(`Failed to parse JSON response: ${error}`);
  }
}

// Tool-aware union
const RequestDataSchema = z.object({
  type: z.literal('request_data'),
  tickers: z.array(z.string()).min(1),
  metrics: z.array(z.enum(['history_30d', 'indicators'])).min(1),
});

const DecisionEnvelopeSchema = z.object({
  type: z.literal('decision'),
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  ticker: z.string().nullable(),
  shares: z.number().int().nonnegative(),
  reasoning: z.string(),
  leverage: z.number().int().min(1).max(20).optional(),
});

export function parseToolAwareResponse(rawResponse: string):
  | { type: 'request_data'; tickers: string[]; metrics: Array<'history_30d' | 'indicators'> }
  | { type: 'decision'; decision: TradeDecision }
  | null {
  let jsonStr = rawResponse.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) jsonStr = jsonMatch[1];
  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) jsonStr = jsonObjectMatch[0];
  try {
    const parsed = JSON.parse(jsonStr);
    // Try request first
    const req = RequestDataSchema.safeParse(parsed);
    if (req.success) return req.data;
    // Then decision envelope
    const dec = DecisionEnvelopeSchema.safeParse(parsed);
    if (dec.success) {
      const d = TradeDecisionSchema.parse({
        action: dec.data.action,
        ticker: dec.data.ticker,
        shares: dec.data.shares,
        reasoning: dec.data.reasoning,
        leverage: dec.data.leverage,
      });
      return { type: 'decision', decision: { ...d, leverage: d.leverage ?? 1 } };
    }
    return null;
  } catch {
    return null;
  }
}

// Helper function to validate decision against portfolio constraints
export function validateDecisionConstraints(
  decision: TradeDecision,
  constraints: {
    availableCash: number;
    currentPrice: number;
    ownedShares: number;
    watchlist: string[];
  }
): { isValid: boolean; reason?: string } {
  // HOLD is always valid
  if (decision.action === 'HOLD') {
    return { isValid: true };
  }
  
  // Check if ticker is provided
  if (!decision.ticker) {
    return { isValid: false, reason: 'Ticker is required for BUY/SELL actions' };
  }
  
  // Check if ticker is in watchlist
  if (!constraints.watchlist.includes(decision.ticker)) {
    return { isValid: false, reason: `Ticker ${decision.ticker} is not in the watchlist` };
  }
  
  // Validate BUY
  if (decision.action === 'BUY') {
    const totalCost = constraints.currentPrice * decision.shares;
    if (totalCost > constraints.availableCash) {
      return { isValid: false, reason: 'Insufficient cash for this purchase' };
    }
  }
  
  // Validate SELL
  if (decision.action === 'SELL') {
    if (decision.shares > constraints.ownedShares) {
      return { isValid: false, reason: 'Cannot sell more shares than owned' };
    }
    if (constraints.ownedShares === 0) {
      return { isValid: false, reason: 'No shares to sell' };
    }
  }
  
  return { isValid: true };
}
