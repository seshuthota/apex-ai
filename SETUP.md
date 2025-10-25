# Apex AI - Setup Guide

## Project Overview

Apex AI is an LLM trading competition platform where different AI models (Gemini, GPT-4, Claude) compete against each other in the Indian stock market (NSE). Each model autonomously makes trading decisions, and their performance is displayed on a live leaderboard.

## What We've Built So Far

### ✅ Phase 1: Foundation & Setup (COMPLETED)
- **Database Schema**: Complete PostgreSQL schema with Prisma ORM
  - Models, Portfolios, Positions, Trades
  - Decision Logs, Portfolio Snapshots
  - Model Configurations, Market Data, System Logs
- **Project Structure**: Organized folder hierarchy
- **Dependencies**: All required packages installed
  - Prisma, Zod, date-fns, recharts, socket.io-client
  - kiteconnect, @google/generative-ai, openai, @anthropic-ai/sdk

### ✅ Phase 2: LLM Integration & Model Manager (COMPLETED)
- **LLM Providers**: 
  - `lib/llm/providers/gemini.ts` - Google Gemini integration
  - `lib/llm/providers/openai.ts` - OpenAI GPT-4 integration
  - `lib/llm/providers/claude.ts` - Anthropic Claude integration
- **Prompt Engineering**: 
  - `lib/llm/prompt-builder.ts` - NSE-specific trading prompts
- **Response Parsing**: 
  - `lib/llm/response-parser.ts` - Zod validation & JSON extraction
- **Model Manager**: 
  - `lib/services/model-manager.ts` - Orchestrates LLM calls with retry logic

## Current Project Structure

```
apex-ai/
├── app/                    # Next.js app directory
├── lib/
│   ├── db/
│   │   └── prisma.ts      # Prisma client singleton
│   ├── llm/
│   │   ├── providers/
│   │   │   ├── gemini.ts
│   │   │   ├── openai.ts
│   │   │   └── claude.ts
│   │   ├── prompt-builder.ts
│   │   └── response-parser.ts
│   ├── services/
│   │   └── model-manager.ts
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   └── utils/
├── components/            # React components (to be built)
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seeding script
├── .env                  # Environment variables
├── .env.example          # Environment variables template
└── implementation-plan.md # Complete implementation plan
```

## Next Steps

### Immediate Tasks (Phase 3 - In Progress)

1. **Data Service** - Create `lib/services/data-service.ts`
   - Integrate Zerodha Kite Connect for NSE data
   - Add Yahoo Finance fallback
   - Implement news fetching

2. **Broker Service** - Create `lib/services/broker-service.ts`
   - Zerodha Kite Connect integration
   - Order placement and tracking
   - Paper trading support

3. **Portfolio Calculator** - Create `lib/services/portfolio-calculator.ts`
   - Calculate total portfolio value
   - Track P&L and returns
   - Create portfolio snapshots

4. **Trading Engine** - Create `lib/services/trading-engine.ts`
   - Main trading loop
   - Decision validation
   - Trade execution
   - Error handling

5. **Cron API** - Create `app/api/cron/trigger-trades/route.ts`
   - Scheduled trading cycles
   - Protected endpoint

## Environment Setup

### Required Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
# Database (Prisma Postgres - already configured)
DATABASE_URL="prisma+postgres://localhost:51213/..."

# LLM API Keys (get from respective providers)
GOOGLE_API_KEY=""           # From https://makersuite.google.com/app/apikey
OPENAI_API_KEY=""           # From https://platform.openai.com/api-keys
ANTHROPIC_API_KEY=""        # From https://console.anthropic.com/

# Indian Market Data (Zerodha Kite Connect)
ZERODHA_API_KEY=""          # From https://kite.trade
ZERODHA_API_SECRET=""
ZERODHA_ACCESS_TOKEN=""

# Cron Protection
CRON_SECRET=""              # Generate a random string

# App Configuration
NODE_ENV="development"
NEXT_PUBLIC_WS_URL="ws://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Getting API Keys

#### 1. Zerodha Kite Connect
- Visit [https://kite.trade](https://kite.trade)
- Create a developer account
- Subscribe to Historical + Live market data (₹2,000/month)
- Generate API key and secret
- Note: Access token expires daily and needs refresh

#### 2. Google Gemini
- Visit [https://makersuite.google.com](https://makersuite.google.com)
- Create API key (free tier available)

#### 3. OpenAI
- Visit [https://platform.openai.com](https://platform.openai.com)
- Create API key (pay-per-use)

#### 4. Anthropic Claude
- Visit [https://console.anthropic.com](https://console.anthropic.com)
- Create API key (pay-per-use)

## Database Setup

### Initialize Database

```bash
# Start Prisma development database
pnpm exec prisma dev

# Generate Prisma client
pnpm run db:generate

# Run migrations
pnpm run db:migrate

# Seed initial data (3 trading models)
pnpm run db:seed
```

### View Database

```bash
# Open Prisma Studio to view/edit data
pnpm run db:studio
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Database commands
pnpm run db:generate    # Generate Prisma client
pnpm run db:migrate     # Run migrations
pnpm run db:seed        # Seed database
pnpm run db:studio      # Open database GUI

# Lint
pnpm lint

# Build for production
pnpm build
pnpm start
```

## Testing the LLM Integration

Once you have API keys configured, you can test the LLM integration:

```typescript
// Example test script (create in scripts/test-llm.ts)
import { ModelManager } from '@/lib/services/model-manager';

const manager = new ModelManager();

const mockMarketData = [
  { ticker: 'RELIANCE', price: 2450.50, change: 25.30, changePct: 1.04, volume: 5000000 },
  { ticker: 'TCS', price: 3650.00, change: -15.50, changePct: -0.42, volume: 2000000 },
];

const mockNews = [
  { title: 'Reliance Industries announces strong Q4 results', summary: '...' },
  { title: 'IT sector sees growth in exports', summary: '...' },
];

// Test with a model ID from your database
const result = await manager.getModelDecision('model-id', mockMarketData, mockNews);
console.log(result);
```

## Architecture Highlights

### Database Schema (NSE-focused)
- **Starting Capital**: ₹100,000 per model
- **Watchlist**: Top 10 Nifty 50 stocks
- **Trading Hours**: 9:15 AM - 3:30 PM IST
- **Currency**: INR (₹)

### LLM Decision Flow
1. Load model configuration and portfolio
2. Gather market data from Kite Connect
3. Fetch latest Indian business news
4. Build NSE-specific trading prompt
5. Call appropriate LLM API
6. Parse and validate JSON response
7. Log decision and reasoning
8. Return trade decision

### Error Handling
- **Retry Logic**: 3 attempts with exponential backoff
- **Fallback**: Returns HOLD if all attempts fail
- **Logging**: All decisions logged to database
- **Validation**: Zod schema validation for responses

## Project Status

**Completed:**
- ✅ Database schema and setup
- ✅ LLM provider integrations (Gemini, GPT-4, Claude)
- ✅ Prompt engineering for NSE trading
- ✅ Response parsing and validation
- ✅ Model Manager with retry logic

**In Progress:**
- 🔄 Data Service (Kite Connect integration)
- 🔄 Broker Service (order execution)
- 🔄 Portfolio Calculator
- 🔄 Trading Engine
- 🔄 Cron API routes

**TODO:**
- ⏳ Frontend (Leaderboard page)
- ⏳ Frontend (Model detail page with charts)
- ⏳ Admin dashboard
- ⏳ Real-time WebSocket updates
- ⏳ Testing & deployment

## Troubleshooting

### Database Connection Issues
If you see `Can't reach database server`, ensure Prisma dev is running:
```bash
pnpm exec prisma dev
```

### API Key Errors
Make sure all required API keys are set in `.env` file.

### TypeScript Errors
Regenerate Prisma client:
```bash
pnpm run db:generate
```

## Contributing

This project follows the implementation plan in `implementation-plan.md`. 

Current focus: **Phase 3 - Market Data & Trading Engine**

## License

Private project - All rights reserved
