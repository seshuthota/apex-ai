import { prisma } from '@/lib/db/prisma';
import { callGemini } from '@/lib/llm/providers/gemini';
import { callOpenAI } from '@/lib/llm/providers/openai';
import { callClaude } from '@/lib/llm/providers/claude';
import { buildTradingPrompt } from '@/lib/llm/prompt-builder';
import { parseTradeDecision, type TradeDecision } from '@/lib/llm/response-parser';
import type { MarketDataPoint, NewsArticle } from '@/lib/types';

export class ModelManager {
  async getModelDecision(
    modelId: string,
    marketData: MarketDataPoint[],
    news: NewsArticle[]
  ): Promise<{
    decision: TradeDecision;
    rawResponse: string;
    promptTokens?: number;
    responseTokens?: number;
  }> {
    // Load model and config
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: {
        config: true,
        portfolio: {
          include: { positions: true },
        },
      },
    });
    
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    if (!model.config) {
      throw new Error(`Model ${modelId} has no configuration`);
    }
    
    if (!model.portfolio) {
      throw new Error(`Model ${modelId} has no portfolio`);
    }
    
    // Build prompt
    const prompt = buildTradingPrompt({
      modelName: model.displayName,
      cashBalance: Number(model.portfolio.cashBalance),
      positions: model.portfolio.positions.map(p => ({
        ticker: p.ticker,
        shares: p.shares,
      })),
      marketData,
      news,
      watchlist: model.config.watchlist,
    });
    
    // Call appropriate LLM with retry logic
    let rawResponse: string;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        switch (model.provider) {
          case 'GEMINI_PRO':
            rawResponse = await callGemini(prompt, 'gemini-pro');
            break;
          case 'GEMINI_FLASH':
            rawResponse = await callGemini(prompt, 'gemini-1.5-flash');
            break;
          case 'GPT4':
            rawResponse = await callOpenAI(prompt, 'gpt-4');
            break;
          case 'GPT4_TURBO':
            rawResponse = await callOpenAI(prompt, 'gpt-4-turbo');
            break;
          case 'CLAUDE_SONNET':
            rawResponse = await callClaude(prompt, 'claude-3-sonnet-20240229');
            break;
          case 'CLAUDE_OPUS':
            rawResponse = await callClaude(prompt, 'claude-3-opus-20240229');
            break;
          default:
            throw new Error(`Unknown provider: ${model.provider}`);
        }
        
        // Parse and validate response
        const decision = parseTradeDecision(rawResponse);
        
        // Log decision
        await prisma.decisionLog.create({
          data: {
            modelId,
            reasoning: decision.reasoning,
            rawResponse,
          },
        });
        
        return { decision, rawResponse };
      } catch (error) {
        retryCount++;
        console.error(`Attempt ${retryCount} failed for model ${model.name}:`, error);
        
        if (retryCount >= maxRetries) {
          // Log the failed attempt
          await prisma.decisionLog.create({
            data: {
              modelId,
              reasoning: `Failed after ${maxRetries} attempts`,
              rawResponse: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          
          // Return HOLD decision as fallback
          return {
            decision: {
              action: 'HOLD',
              ticker: null,
              shares: 0,
              reasoning: `Failed to get valid decision after ${maxRetries} attempts`,
            },
            rawResponse: error instanceof Error ? error.message : 'Unknown error',
          };
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      }
    }
    
    // This should never be reached due to the return in the catch block
    throw new Error('Unexpected error in getModelDecision');
  }
}
