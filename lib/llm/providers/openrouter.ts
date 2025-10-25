import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

/**
 * OpenRouter Provider
 * 
 * OpenRouter provides unified access to multiple LLM models through a single API.
 * Supported models include GPT-4, Claude, Gemini, Llama, Mistral, and more.
 * 
 * Popular models for trading:
 * - google/gemini-pro-1.5
 * - anthropic/claude-3.5-sonnet
 * - openai/gpt-4-turbo
 * - meta-llama/llama-3.1-70b-instruct
 * - mistralai/mistral-large
 */

export async function callOpenRouter(
  prompt: string,
  model: string = 'anthropic/claude-3.5-sonnet'
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  try {
    const { text } = await generateText({
      model: openrouter.chat(model),
      prompt,
      temperature: 0.7,
      maxTokens: 1000,
    });

    return text;
  } catch (error) {
    console.error('OpenRouter API error:', error);
    throw new Error(`OpenRouter API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Alternative implementation using direct fetch API
 * Useful if ai-sdk-provider has issues
 */
export async function callOpenRouterDirect(
  prompt: string,
  model: string = 'anthropic/claude-3.5-sonnet'
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Apex AI Trading Platform',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content || '';
}
