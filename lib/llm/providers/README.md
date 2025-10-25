# LLM Providers

This directory contains implementations for various LLM providers used in Apex AI.

## Available Providers

### Direct API Providers

#### 1. Google Gemini (`gemini.ts`)
- **Models**: `gemini-pro`, `gemini-1.5-flash`
- **API Key**: `GOOGLE_API_KEY`
- **Get Key**: https://makersuite.google.com/app/apikey
- **Pricing**: Free tier available
- **Best For**: Fast responses, good reasoning

#### 2. OpenAI (`openai.ts`)
- **Models**: `gpt-4`, `gpt-4-turbo`
- **API Key**: `OPENAI_API_KEY`
- **Get Key**: https://platform.openai.com/api-keys
- **Pricing**: Pay-per-token
- **Best For**: Complex reasoning, high accuracy

#### 3. Anthropic Claude (`claude.ts`)
- **Models**: `claude-3-sonnet-20240229`, `claude-3-opus-20240229`
- **API Key**: `ANTHROPIC_API_KEY`
- **Get Key**: https://console.anthropic.com/
- **Pricing**: Pay-per-token
- **Best For**: Long context, nuanced understanding

### Unified Provider

#### 4. OpenRouter (`openrouter.ts`)
- **Single API for Multiple Models**
- **API Key**: `OPENROUTER_API_KEY`
- **Get Key**: https://openrouter.ai/keys
- **Pricing**: Varies by model
- **Best For**: Access to many models without managing multiple API keys

**Available Models via OpenRouter:**
- `anthropic/claude-3.5-sonnet` - Latest Claude
- `openai/gpt-4-turbo` - GPT-4 Turbo
- `google/gemini-pro-1.5` - Gemini Pro 1.5
- `meta-llama/llama-3.1-70b-instruct` - Llama 3.1 70B
- `mistralai/mistral-large` - Mistral Large
- And 100+ more models

## Usage in Database

The provider is specified in the `Model` table using the `LLMProvider` enum:

```prisma
enum LLMProvider {
  // Direct providers
  GEMINI_PRO
  GEMINI_FLASH
  GPT4
  GPT4_TURBO
  CLAUDE_SONNET
  CLAUDE_OPUS
  
  // OpenRouter variants
  OPENROUTER_CLAUDE
  OPENROUTER_GPT4
  OPENROUTER_GEMINI
  OPENROUTER_LLAMA
  OPENROUTER_MISTRAL
}
```

## Adding a New Model via OpenRouter

To add a new model to the competition:

1. Find the model on [OpenRouter Models](https://openrouter.ai/models)
2. Add a new enum value to `prisma/schema.prisma`:
   ```prisma
   OPENROUTER_CUSTOM_MODEL
   ```
3. Run `pnpm run db:generate` to update Prisma client
4. Add a case in `lib/services/model-manager.ts`:
   ```typescript
   case 'OPENROUTER_CUSTOM_MODEL':
     rawResponse = await callOpenRouter(prompt, 'provider/model-name');
     break;
   ```
5. Create the model in the database with the new provider

## Cost Comparison (Approximate)

| Provider | Model | Input (1M tokens) | Output (1M tokens) |
|----------|-------|-------------------|-------------------|
| Google | Gemini Pro | $0.50 | $1.50 |
| OpenAI | GPT-4 Turbo | $10.00 | $30.00 |
| Anthropic | Claude 3 Sonnet | $3.00 | $15.00 |
| OpenRouter | Llama 3.1 70B | $0.70 | $0.80 |
| OpenRouter | Mistral Large | $3.00 | $9.00 |

*Prices may vary. Check provider websites for current pricing.*

## Why OpenRouter?

**Advantages:**
- ✅ Single API key for 100+ models
- ✅ Automatic failover between models
- ✅ Usage analytics and monitoring
- ✅ Cost optimization (auto-route to cheaper models)
- ✅ No need to manage multiple API keys

**Disadvantages:**
- ❌ Slight latency overhead
- ❌ Additional middleman cost
- ❌ Dependency on OpenRouter service availability

## Testing Providers

Test a provider before using in production:

```typescript
import { callGemini } from '@/lib/llm/providers/gemini';
import { callOpenRouter } from '@/lib/llm/providers/openrouter';

// Test Gemini
const geminiResponse = await callGemini('What is 2+2?');
console.log('Gemini:', geminiResponse);

// Test OpenRouter with Llama
const llamaResponse = await callOpenRouter(
  'What is 2+2?',
  'meta-llama/llama-3.1-70b-instruct'
);
console.log('Llama:', llamaResponse);
```

## Error Handling

All providers implement retry logic in `model-manager.ts`:
- **3 attempts** with exponential backoff
- **Fallback**: Returns HOLD decision if all attempts fail
- **Logging**: All attempts logged to database

## Rate Limits

Be aware of rate limits for each provider:

| Provider | Rate Limit |
|----------|-----------|
| Google Gemini | 60 requests/minute (free tier) |
| OpenAI | 10,000 tokens/minute (tier 1) |
| Anthropic | 50 requests/minute (tier 1) |
| OpenRouter | Varies by model |

## Best Practices

1. **Start with OpenRouter** for easy experimentation
2. **Use direct APIs** for production when you've chosen your models
3. **Monitor costs** regularly
4. **Test with mock data** before going live
5. **Set up alerts** for API failures
