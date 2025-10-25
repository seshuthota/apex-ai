import { GoogleGenerativeAI } from '@google/generative-ai';

export async function callGemini(
  prompt: string,
  model: 'gemini-pro' | 'gemini-1.5-flash' = 'gemini-pro'
): Promise<string> {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const geminiModel = genAI.getGenerativeModel({ model });
  
  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
