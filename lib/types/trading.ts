import { z } from 'zod';

export const TradeDecisionSchema = z.object({
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  ticker: z.string().nullable(),
  shares: z.number().int().nonnegative(),
  reasoning: z.string(),
  leverage: z.number().int().min(1).max(20).optional(),
});

export type TradeDecision = z.infer<typeof TradeDecisionSchema>;
