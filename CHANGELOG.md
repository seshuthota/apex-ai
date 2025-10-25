# Changelog

All notable changes to Apex AI project will be documented in this file.

## [Unreleased] - 2025-10-25

### Added - Phase 1 & 2 Implementation

#### Foundation (Phase 1)
- **Database Schema**: Complete Prisma schema for NSE trading platform
  - 9 models: Model, Portfolio, Position, Trade, DecisionLog, PortfolioSnapshot, ModelConfig, MarketData, SystemLog
  - Enums: LLMProvider, TradeAction, TradeStatus, LogLevel
  - Starting capital: ₹100,000 per model
  - Watchlist: Top 10 Nifty 50 stocks (RELIANCE, TCS, INFY, etc.)
- **Project Structure**: Organized folder hierarchy with lib/, components/, prisma/
- **Dependencies**: All required packages installed
  - Database: `prisma`, `@prisma/client`
  - Validation: `zod`, `date-fns`
  - LLM SDKs: `@google/generative-ai`, `openai`, `@anthropic-ai/sdk`
  - OpenRouter: `@openrouter/ai-sdk-provider`, `ai`
  - Market Data: `kiteconnect`
  - Frontend: `recharts`, `socket.io-client`
- **Environment Setup**: `.env.example` with all required variables
- **Database Seed**: Script to create 4 initial trading models

#### LLM Integration (Phase 2)
- **Google Gemini Provider** (`lib/llm/providers/gemini.ts`)
  - Models: gemini-pro, gemini-1.5-flash
- **OpenAI Provider** (`lib/llm/providers/openai.ts`)
  - Models: gpt-4, gpt-4-turbo
- **Anthropic Claude Provider** (`lib/llm/providers/claude.ts`)
  - Models: claude-3-sonnet, claude-3-opus
- **OpenRouter Provider** (`lib/llm/providers/openrouter.ts`) ⭐ NEW
  - Unified access to 100+ models through single API
  - Variants: OPENROUTER_CLAUDE, OPENROUTER_GPT4, OPENROUTER_GEMINI, OPENROUTER_LLAMA, OPENROUTER_MISTRAL
  - Includes both SDK and direct fetch implementations
- **Prompt Builder** (`lib/llm/prompt-builder.ts`)
  - NSE-specific trading prompts
  - Indian market context (₹, NSE tickers, IST hours)
- **Response Parser** (`lib/llm/response-parser.ts`)
  - Zod schema validation
  - JSON extraction from markdown code blocks
  - Constraint validation helpers
- **Model Manager** (`lib/services/model-manager.ts`)
  - Orchestrates LLM calls for all providers
  - 3-attempt retry logic with exponential backoff
  - Automatic fallback to HOLD on failures
  - Decision logging to database

#### Documentation
- **SETUP.md**: Comprehensive setup guide
  - Environment configuration
  - API key instructions
  - Database setup commands
  - Development workflow
- **implementation-plan.md**: Complete 7-phase implementation plan
  - NSE market-focused
  - Detailed code examples
  - Budget estimates (₹7,650-28,300/mo)
- **lib/llm/providers/README.md**: LLM providers documentation
  - Comparison of all providers
  - Cost estimates
  - Usage examples
  - Best practices

### Changed
- Updated `.gitignore` to properly handle .env files while keeping .env.example
- Modified `package.json` to include database scripts (db:generate, db:migrate, db:seed, db:studio)
- Enhanced Prisma schema with comprehensive NSE trading models

### Configuration
- **Database**: Prisma Postgres (local development server)
- **Currency**: INR (₹)
- **Market**: NSE (National Stock Exchange of India)
- **Trading Hours**: 9:15 AM - 3:30 PM IST
- **Initial Capital**: ₹100,000 per model

## Project Stats

- **Total Files Created**: 15+
- **Lines of Code**: ~1,500+
- **Dependencies Installed**: 20+
- **Providers Supported**: 4 (Google, OpenAI, Anthropic, OpenRouter)
- **Models Available**: 11 variants
- **Database Tables**: 9

## Next Phase

**Phase 3: Market Data & Trading Engine** (In Progress)
- Data Service (Zerodha Kite Connect integration)
- Broker Service (order execution)
- Portfolio Calculator (P&L tracking)
- Trading Engine (main loop)
- Cron API (scheduled cycles)

## Git Commit Status

Ready to commit with message:
```
feat: implement Phase 1 & 2 - Foundation and LLM integration

- Add complete Prisma schema for NSE trading platform
- Implement LLM providers (Gemini, OpenAI, Claude, OpenRouter)
- Create prompt builder for NSE-specific trading
- Add response parser with Zod validation
- Implement Model Manager with retry logic
- Set up project structure and dependencies
- Add database seed script for initial models
- Create comprehensive documentation
```

## Contributors

- Seshu Thota
- factory-droid[bot]
