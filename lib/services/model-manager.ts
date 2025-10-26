import { prisma } from '@/lib/db/prisma';
import { callGemini } from '@/lib/llm/providers/gemini';
import { callOpenAI } from '@/lib/llm/providers/openai';
import { callClaude } from '@/lib/llm/providers/claude';
import { callOpenRouter } from '@/lib/llm/providers/openrouter';
import { buildTradingPrompt } from '@/lib/llm/prompt-builder';
import { parseTradeDecision, parseToolAwareResponse } from '@/lib/llm/response-parser';
import type { MarketDataPoint, TradeDecision } from '@/lib/types';
import { MarketFeatureService } from '@/lib/services/market-feature-service';
import type { EventPublisher } from '@/lib/backtest/publisher';

export class ModelManager {
  private features: MarketFeatureService;
  private publisher?: EventPublisher;

  constructor() {
    this.features = new MarketFeatureService();
  }

  setPublisher(p?: EventPublisher) {
    this.publisher = p;
  }
  async getModelDecision(
    modelId: string,
    marketData: MarketDataPoint[],
    validationFeedback?: string,
    previousDecision?: TradeDecision
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
    
    const useEnriched = (process.env.BACKTEST_ENRICHED_MARKET_DATA ?? 'true') === 'true';
    const useTools = (process.env.BACKTEST_USE_ANALYSIS_TOOLS ?? 'true') === 'true';

    // Update and compute enriched snapshot
    let marketTableLines: string[] | undefined = undefined;
    if (useEnriched) {
      this.features.update(model.config.watchlist, marketData);
      const snapshot = this.features.getIndicatorsSnapshot(model.config.watchlist);
      // Build compact table rows
      const header = 'Ticker'.padEnd(12) + 'Price'.padStart(8) + '   ' + 'Chg%'.padStart(6) + '   ' + 'Vol'.padStart(7) + '   ' + 'SMA20'.padStart(8) + '   ' + 'SMA50'.padStart(8) + '   ' + 'RSI14'.padStart(7) + '   ' + 'Vol20'.padStart(7);
      const sep = '-'.repeat(header.length);
      const rows = snapshot.map(r => {
        return (
          String(r.ticker).padEnd(12) +
          (`₹${Number(r.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`).padStart(8) + '   ' +
          (`${(r.changePct ?? 0) >= 0 ? '+' : ''}${(r.changePct ?? 0).toFixed(1)}%`).padStart(6) + '   ' +
          (`${Math.round(r.volume / 100000) / 10}M`).padStart(7) + '   ' +
          (r.sma20 ? `₹${Math.round(r.sma20)}`.padStart(8) : '-'.padStart(8)) + '   ' +
          (r.sma50 ? `₹${Math.round(r.sma50)}`.padStart(8) : '-'.padStart(8)) + '   ' +
          (r.rsi14 ? `${r.rsi14.toFixed(1)}`.padStart(7) : '-'.padStart(7)) + '   ' +
          (r.volatility20 ? `${r.volatility20.toFixed(1)}%`.padStart(7) : '-'.padStart(7))
        );
      });
      marketTableLines = ['WATCHLIST:', header, sep, ...rows];
    }

    // Build prompt (with optional feedback)
    let prompt = buildTradingPrompt(
      {
        modelName: model.displayName,
        cashBalance: Number(model.portfolio.cashBalance),
        positions: model.portfolio.positions.map(p => ({ ticker: p.ticker, shares: p.shares })),
        marketData,
        watchlist: model.config.watchlist,
        marketTableLines,
      },
      validationFeedback,
      previousDecision
    );
    
    // Call appropriate LLM with retry logic
    let rawResponse: string;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        // First call (may request analysis tools)
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
          case 'OPENROUTER_CLAUDE':
            rawResponse = await callOpenRouter(prompt, 'anthropic/claude-3.5-sonnet');
            break;
          case 'OPENROUTER_GPT4':
            rawResponse = await callOpenRouter(prompt, 'openai/gpt-4-turbo');
            break;
          case 'OPENROUTER_GEMINI':
            rawResponse = await callOpenRouter(prompt, 'google/gemini-pro-1.5');
            break;
          case 'OPENROUTER_LLAMA':
            rawResponse = await callOpenRouter(prompt, 'meta-llama/llama-3.1-70b-instruct');
            break;
          case 'OPENROUTER_MISTRAL':
            rawResponse = await callOpenRouter(prompt, 'mistralai/mistral-large');
            break;
          case 'OPENROUTER_MINIMAX':
            rawResponse = await callOpenRouter(prompt, 'minimax/minimax-m2:free');
            break;
          case 'OPENROUTER_GEMINI_25_PRO':
            rawResponse = await callOpenRouter(prompt, 'google/gemini-2.5-pro');
            break;
          case 'OPENROUTER_DEEPSEEK':
            rawResponse = await callOpenRouter(prompt, 'deepseek/deepseek-chat-v3.1:free');
            break;
          default:
            throw new Error(`Unknown provider: ${model.provider}`);
        }
        
        // Parse tool-aware response; fallback to trade decision
        let decision: TradeDecision | undefined;
        const parsed = parseToolAwareResponse(rawResponse);

        if (parsed && parsed.type === 'request_data' && useTools) {
          const tickers = parsed.tickers.filter(t => model.config!.watchlist.includes(t));
          const metrics = parsed.metrics;
          if (tickers.length > 0) {
            this.publisher?.publish('analyze', { modelId: model.id, tickers, metrics });

            const blocks: string[] = [];
            if (metrics.includes('history_30d')) {
              for (const t of tickers) {
                const hist = this.features.getHistory(t, 30);
                const series = hist.map(h => Math.round(h.price)).join(', ');
                blocks.push(`- ${t} history_30d (close): ${series}`);
              }
            }
            if (metrics.includes('indicators')) {
              const snap = this.features.getIndicatorsSnapshot(tickers);
              for (const r of snap) {
                blocks.push(`- ${r.ticker} indicators: SMA20=${r.sma20 ? Math.round(r.sma20) : '-'}, SMA50=${r.sma50 ? Math.round(r.sma50) : '-'}, RSI14=${r.rsi14 ? r.rsi14.toFixed(1) : '-'}, Vol20=${r.volatility20 ? r.volatility20.toFixed(1) + '%' : '-'}`);
              }
            }

            const analysisAppendix = `\n\nADDITIONAL ANALYSIS RESULTS:\n${blocks.join('\n')}\n\nBased on all information above, respond with FINAL decision only in this JSON format:\n{\n  "type": "decision",\n  "action": "BUY" | "SELL" | "HOLD",\n  "ticker": "RELIANCE" | null,\n  "shares": 10,\n  "reasoning": "2-3 sentences"\n}`;

            // Second call with analysis appendix
            let secondResp: string;
            switch (model.provider) {
              case 'GEMINI_PRO':
                secondResp = await callGemini(prompt + analysisAppendix, 'gemini-pro');
                break;
              case 'GEMINI_FLASH':
                secondResp = await callGemini(prompt + analysisAppendix, 'gemini-1.5-flash');
                break;
              case 'GPT4':
                secondResp = await callOpenAI(prompt + analysisAppendix, 'gpt-4');
                break;
              case 'GPT4_TURBO':
                secondResp = await callOpenAI(prompt + analysisAppendix, 'gpt-4-turbo');
                break;
              case 'CLAUDE_SONNET':
                secondResp = await callClaude(prompt + analysisAppendix, 'claude-3-sonnet-20240229');
                break;
              case 'CLAUDE_OPUS':
                secondResp = await callClaude(prompt + analysisAppendix, 'claude-3-opus-20240229');
                break;
              case 'OPENROUTER_CLAUDE':
                secondResp = await callOpenRouter(prompt + analysisAppendix, 'anthropic/claude-3.5-sonnet');
                break;
              case 'OPENROUTER_GPT4':
                secondResp = await callOpenRouter(prompt + analysisAppendix, 'openai/gpt-4-turbo');
                break;
              case 'OPENROUTER_GEMINI':
                secondResp = await callOpenRouter(prompt + analysisAppendix, 'google/gemini-pro-1.5');
                break;
              case 'OPENROUTER_LLAMA':
                secondResp = await callOpenRouter(prompt + analysisAppendix, 'meta-llama/llama-3.1-70b-instruct');
                break;
              case 'OPENROUTER_MISTRAL':
                secondResp = await callOpenRouter(prompt + analysisAppendix, 'mistralai/mistral-large');
                break;
              case 'OPENROUTER_MINIMAX':
                secondResp = await callOpenRouter(prompt + analysisAppendix, 'minimax/minimax-m2:free');
                break;
              case 'OPENROUTER_GEMINI_25_PRO':
                secondResp = await callOpenRouter(prompt + analysisAppendix, 'google/gemini-2.5-pro');
                break;
              case 'OPENROUTER_DEEPSEEK':
                secondResp = await callOpenRouter(prompt + analysisAppendix, 'deepseek/deepseek-chat-v3.1:free');
                break;
              default:
                throw new Error(`Unknown provider: ${model.provider}`);
            }

            // Parse final decision from second response
            const parsed2 = parseToolAwareResponse(secondResp);
            if (parsed2 && parsed2.type === 'decision') {
              decision = parsed2.decision;
              rawResponse = secondResp;
            } else {
              // Fallback legacy parser
              decision = parseTradeDecision(secondResp);
              rawResponse = secondResp;
            }
          }
        }

        // If not using tools or parsed decision not set, fallback to trade parsing
        if (!decision) {
          decision = parseTradeDecision(rawResponse);
        }
        
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
