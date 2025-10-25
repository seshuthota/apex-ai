import Anthropic from '@anthropic-ai/sdk';

export async function callClaude(
  prompt: string,
  model: 'claude-3-sonnet-20240229' | 'claude-3-opus-20240229' = 'claude-3-sonnet-20240229'
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  
  const message = await anthropic.messages.create({
    model,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  
  const content = message.content[0];
  return content.type === 'text' ? content.text : '';
}
