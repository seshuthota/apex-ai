import OpenAI from 'openai';

export async function callOpenAI(
  prompt: string,
  model: 'gpt-4' | 'gpt-4-turbo' = 'gpt-4'
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const completion = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  
  return completion.choices[0].message.content || '';
}
