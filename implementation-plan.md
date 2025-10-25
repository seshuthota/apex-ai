# **Apex AI - LLM Trading Competition Platform**
## **Comprehensive Implementation Plan**

---

## **Executive Summary**

Apex AI is a competitive trading platform where different LLMs (Large Language Models) compete against each other in a simulated Indian stock market environment (NSE - National Stock Exchange). Each model manages its own portfolio, makes autonomous trading decisions, and competes on a live leaderboard. The system operates on scheduled trading cycles, integrating real market data, news feeds, and paper trading APIs.

**Key Innovation**: Rather than collaborative AI, this creates an arena where AI models compete, allowing comparison of different LLMs' trading strategies and decision-making capabilities in the Indian market context.

**Market Focus**: NSE (National Stock Exchange of India) - India's largest stock exchange with 1,600+ listed companies.

---

## **I. System Architecture**

### **1.1 Core Concepts**

- **Independent Traders**: Each LLM is an isolated competitor with its own portfolio
- **Isolated Portfolios**: Starting capital (e.g., ₹100,000), independent P&L tracking
- **Real-time Competition**: Live leaderboard ranking by portfolio performance
- **Scheduled Trading Cycles**: Automated "ticks" during NSE hours (9:15 AM - 3:30 PM IST)
- **Paper Trading**: All trades executed through paper trading APIs (no real money)

### **1.2 System Components**

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Leaderboard  │  │ Model Detail │  │  Admin Panel    │  │
│  │    Page      │  │    Page      │  │  (Controls)     │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket / API
┌────────────────────────┴────────────────────────────────────┐
│                  Backend Services (Next.js API)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Trading Engine (Cron Triggered)            │  │
│  │  • Model Manager  • Decision Validator               │  │
│  │  • Execution Engine  • Portfolio Calculator          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ Data Service │  │  LLM Service │  │ Broker Service│   │
│  │ (Market/News)│  │  (Providers) │  │ (Paper Trade) │   │
│  └──────────────┘  └──────────────┘  └───────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│              Database (PostgreSQL + Prisma)                 │
│  Models | Portfolios | Positions | Trades | DecisionLogs   │
│  PriceHistory | ModelConfigs | SystemLogs                   │
└─────────────────────────────────────────────────────────────┘
```

---

## **II. Database Schema**

### **2.1 Core Tables**

```prisma
// Model - Represents each LLM trader
model Model {
  id            String       @id @default(cuid())
  name          String       @unique // "AlphaWhale"
  displayName   String       // "Alpha Whale"
  provider      LLMProvider  // GEMINI_PRO, GPT4, CLAUDE_SONNET
  logo          String?      // URL to logo
  isActive      Boolean      @default(true)
  
  portfolio     Portfolio?
  trades        Trade[]
  decisions     DecisionLog[]
  config        ModelConfig?
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

enum LLMProvider {
  GEMINI_PRO
  GEMINI_FLASH
  GPT4
  GPT4_TURBO
  CLAUDE_SONNET
  CLAUDE_OPUS
}

// Portfolio - Current holdings and cash
model Portfolio {
  id            String     @id @default(cuid())
  modelId       String     @unique
  model         Model      @relation(fields: [modelId], references: [id])
  
  cashBalance   Decimal    @default(100000)
  initialValue  Decimal    @default(100000)
  
  positions     Position[]
  history       PortfolioSnapshot[]
  
  updatedAt     DateTime   @updatedAt
}

// Position - Individual stock holdings
model Position {
  id            String     @id @default(cuid())
  portfolioId   String
  portfolio     Portfolio  @relation(fields: [portfolioId], references: [id])
  
  ticker        String
  shares        Int
  avgCost       Decimal    // Average cost basis
  
  @@unique([portfolioId, ticker])
}

// Trade - Transaction history
model Trade {
  id            String     @id @default(cuid())
  modelId       String
  model         Model      @relation(fields: [modelId], references: [id])
  
  ticker        String
  action        TradeAction // BUY, SELL
  shares        Int
  price         Decimal
  totalValue    Decimal
  
  status        TradeStatus @default(PENDING)
  brokerOrderId String?
  
  createdAt     DateTime   @default(now())
  executedAt    DateTime?
}

enum TradeAction {
  BUY
  SELL
}

enum TradeStatus {
  PENDING
  FILLED
  REJECTED
  CANCELLED
}

// DecisionLog - LLM reasoning
model DecisionLog {
  id            String     @id @default(cuid())
  modelId       String
  model         Model      @relation(fields: [modelId], references: [id])
  
  reasoning     String     @db.Text
  rawResponse   String     @db.Text // Full LLM response
  promptTokens  Int?
  responseTokens Int?
  
  tradeId       String?    // Links to executed trade if any
  
  createdAt     DateTime   @default(now())
}

// PortfolioSnapshot - Historical valuations
model PortfolioSnapshot {
  id            String     @id @default(cuid())
  portfolioId   String
  portfolio     Portfolio  @relation(fields: [portfolioId], references: [id])
  
  totalValue    Decimal    // Cash + positions value
  cashBalance   Decimal
  positionsValue Decimal
  returnPct     Decimal    // % return from initial
  
  timestamp     DateTime   @default(now())
  
  @@index([portfolioId, timestamp])
}

// ModelConfig - Versioned prompt configurations
model ModelConfig {
  id            String     @id @default(cuid())
  modelId       String     @unique
  model         Model      @relation(fields: [modelId], references: [id])
  
  systemPrompt  String     @db.Text
  temperature   Decimal    @default(0.7)
  maxTokens     Int        @default(1000)
  
  // Risk limits
  maxPositionSize Decimal  @default(0.3) // Max 30% of portfolio
  maxTradesPerDay Int      @default(10)
  watchlist     String[]   // Array of tickers
  
  version       Int        @default(1)
  updatedAt     DateTime   @updatedAt
}

// MarketData - Cached price data
model MarketData {
  ticker        String
  price         Decimal
  change        Decimal
  changePct     Decimal
  volume        BigInt
  timestamp     DateTime
  
  @@id([ticker, timestamp])
  @@index([ticker])
}

// SystemLog - Operational monitoring
model SystemLog {
  id            String     @id @default(cuid())
  level         LogLevel   // INFO, WARN, ERROR
  message       String     @db.Text
  metadata      Json?
  timestamp     DateTime   @default(now())
  
  @@index([level, timestamp])
}

enum LogLevel {
  INFO
  WARN
  ERROR
}
```

---

## **III. Technology Stack**

### **3.1 Core Technologies**

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Framework | Next.js 14+ (App Router) | SSR, API routes, easy Vercel deployment |
| Language | TypeScript | Type safety, better developer experience |
| Database | PostgreSQL | ACID compliance, excellent for financial data |
| ORM | Prisma | Type-safe queries, migrations, great DX |
| Styling | Tailwind CSS | Rapid UI development, responsive design |
| Charts | Recharts | React-native, good for financial charts |
| Real-time | Socket.IO | WebSocket with fallbacks |

### **3.2 External Services (NSE/India Focused)**

| Service | Provider | Purpose | Free Tier / Cost |
|---------|----------|---------|------------------|
| LLM APIs | Google, OpenAI, Anthropic | Model inference | Yes (limited) |
| Market Data | Zerodha Kite Connect / Upstox API | Real-time NSE prices | ₹2,000/month |
| Market Data (Alt) | Yahoo Finance India | Free historical data | Free (limited) |
| News | Moneycontrol API / NewsAPI | Indian financial news | Varies |
| Paper Trading | Zerodha Kite Connect (Paper) | Simulated NSE order execution | ₹2,000/month |
| Hosting | Vercel | Deployment, cron jobs | Yes |
| Monitoring | Sentry | Error tracking | 5K events/mo |

### **3.3 Development Tools**

- **Package Manager**: pnpm (faster than npm)
- **Code Quality**: ESLint + Prettier
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Type Checking**: TypeScript strict mode
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions

---

## **IV. Detailed Implementation Phases**

### **Phase 1: Foundation & Setup (Week 1)**

#### **1.1 Project Initialization**
```bash
npx create-next-app@latest apex-ai --typescript --tailwind --app --eslint
cd apex-ai
pnpm add prisma @prisma/client
pnpm add zod date-fns
pnpm add kiteconnect  # Zerodha Kite Connect SDK
pnpm add -D @types/node
```

#### **1.2 Database Setup**
- Initialize Prisma: `npx prisma init`
- Define complete schema (see Section II)
- Create initial migration: `npx prisma migrate dev --name init`
- Generate Prisma Client: `npx prisma generate`

#### **1.3 Project Structure**
```
apex-ai/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   └── trigger-trades/route.ts
│   │   ├── models/
│   │   │   ├── route.ts (GET all models)
│   │   │   └── [id]/route.ts (GET specific model)
│   │   └── admin/
│   │       ├── models/route.ts (POST create model)
│   │       └── control/route.ts (pause/resume)
│   ├── models/
│   │   └── [id]/page.tsx
│   ├── admin/
│   │   └── page.tsx
│   ├── page.tsx (leaderboard)
│   └── layout.tsx
├── lib/
│   ├── db/
│   │   └── prisma.ts (singleton client)
│   ├── services/
│   │   ├── model-manager.ts
│   │   ├── trading-engine.ts
│   │   ├── portfolio-calculator.ts
│   │   ├── data-service.ts
│   │   └── broker-service.ts
│   ├── llm/
│   │   ├── providers/
│   │   │   ├── gemini.ts
│   │   │   ├── openai.ts
│   │   │   └── claude.ts
│   │   ├── prompt-builder.ts
│   │   └── response-parser.ts
│   ├── utils/
│   │   ├── validation.ts
│   │   └── logger.ts
│   └── types/
│       └── index.ts
├── components/
│   ├── leaderboard/
│   ├── model-detail/
│   └── ui/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── public/
    └── model-logos/
```

#### **1.4 Environment Configuration**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/apex_ai"

# LLM API Keys
GOOGLE_API_KEY=""
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# Indian Market Data APIs
ZERODHA_API_KEY=""
ZERODHA_API_SECRET=""
ZERODHA_ACCESS_TOKEN=""
UPSTOX_API_KEY=""
UPSTOX_API_SECRET=""
NEWS_API_KEY=""

# Broker (Zerodha Kite Connect for Paper Trading)
KITE_API_KEY=""
KITE_API_SECRET=""
KITE_ACCESS_TOKEN=""

# Cron Protection
CRON_SECRET=""

# App
NODE_ENV="development"
NEXT_PUBLIC_WS_URL="ws://localhost:3000"
```

#### **1.5 Deliverables**
- ✅ Next.js project initialized
- ✅ Database schema defined and migrated
- ✅ Folder structure established
- ✅ Environment variables configured

---

### **Phase 2: LLM Integration & Model Manager (Week 2)**

#### **2.1 LLM Provider Implementations**

**`lib/llm/providers/gemini.ts`**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function callGemini(
  prompt: string,
  model: 'gemini-pro' | 'gemini-flash' = 'gemini-pro'
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const geminiModel = genAI.getGenerativeModel({ model });
  
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}
```

**`lib/llm/providers/openai.ts`**
```typescript
import OpenAI from 'openai';

export async function callOpenAI(
  prompt: string,
  model: 'gpt-4' | 'gpt-4-turbo' = 'gpt-4'
): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const completion = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  
  return completion.choices[0].message.content || '';
}
```

**`lib/llm/providers/claude.ts`**
```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function callClaude(
  prompt: string,
  model: 'claude-3-sonnet-20240229' | 'claude-3-opus-20240229' = 'claude-3-sonnet-20240229'
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  
  const message = await anthropic.messages.create({
    model,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return message.content[0].type === 'text' ? message.content[0].text : '';
}
```

#### **2.2 Prompt Engineering**

**`lib/llm/prompt-builder.ts`**
```typescript
export function buildTradingPrompt(context: {
  modelName: string;
  cashBalance: number;
  positions: Array<{ ticker: string; shares: number }>;
  marketData: Array<{ ticker: string; price: number; change: number }>;
  news: Array<{ title: string; summary: string }>;
  watchlist: string[];
}): string {
  return `You are ${context.modelName}, an autonomous AI trader competing in a trading competition on the NSE (National Stock Exchange of India).

YOUR GOAL: Maximize your portfolio value to win the competition.

CURRENT PORTFOLIO:
- Cash: ₹${context.cashBalance.toFixed(2)}
- Positions: ${context.positions.length === 0 ? 'None' : context.positions.map(p => `${p.shares} shares of ${p.ticker}`).join(', ')}

MARKET DATA (NSE):
${context.marketData.map(d => `${d.ticker}: ₹${d.price.toFixed(2)} (${d.change > 0 ? '+' : ''}${d.change.toFixed(2)}%)`).join('\n')}

LATEST INDIAN MARKET NEWS:
${context.news.slice(0, 5).map((n, i) => `${i + 1}. ${n.title}`).join('\n')}

RULES:
1. You can only trade NSE stocks from the watchlist: ${context.watchlist.join(', ')}
2. You cannot short stocks (sell what you don't own)
3. You cannot exceed your cash balance when buying
4. Consider risk management - don't put all your money in one stock
5. Trading only allowed during NSE hours (9:15 AM - 3:30 PM IST)

AVAILABLE ACTIONS:
- BUY: Purchase shares of a stock
- SELL: Sell shares you currently own
- HOLD: Make no trade this cycle

RESPOND WITH EXACTLY THIS JSON FORMAT (no other text):
{
  "action": "BUY" | "SELL" | "HOLD",
  "ticker": "RELIANCE",
  "shares": 10,
  "reasoning": "Your strategic analysis here (2-3 sentences max)"
}

If action is HOLD, set ticker to null and shares to 0.

Make your decision now:`;
}
```

#### **2.3 Response Parser with Validation**

**`lib/llm/response-parser.ts`**
```typescript
import { z } from 'zod';

const TradeDecisionSchema = z.object({
  action: z.enum(['BUY', 'SELL', 'HOLD']),
  ticker: z.string().nullable(),
  shares: z.number().int().nonnegative(),
  reasoning: z.string(),
});

export type TradeDecision = z.infer<typeof TradeDecisionSchema>;

export function parseTradeDecision(rawResponse: string): TradeDecision {
  // Extract JSON from markdown code blocks if present
  let jsonStr = rawResponse.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    return TradeDecisionSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Invalid trade decision format: ${error}`);
  }
}
```

#### **2.4 Model Manager Service**

**`lib/services/model-manager.ts`**
```typescript
import { prisma } from '@/lib/db/prisma';
import { callGemini } from '@/lib/llm/providers/gemini';
import { callOpenAI } from '@/lib/llm/providers/openai';
import { callClaude } from '@/lib/llm/providers/claude';
import { buildTradingPrompt } from '@/lib/llm/prompt-builder';
import { parseTradeDecision, TradeDecision } from '@/lib/llm/response-parser';

export class ModelManager {
  async getModelDecision(modelId: string): Promise<{
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
    
    if (!model) throw new Error(`Model ${modelId} not found`);
    
    // Gather context data
    const marketData = await this.getMarketData(model.config!.watchlist);
    const news = await this.getNews();
    
    // Build prompt
    const prompt = buildTradingPrompt({
      modelName: model.displayName,
      cashBalance: model.portfolio!.cashBalance.toNumber(),
      positions: model.portfolio!.positions.map(p => ({
        ticker: p.ticker,
        shares: p.shares,
      })),
      marketData,
      news,
      watchlist: model.config!.watchlist,
    });
    
    // Call appropriate LLM
    let rawResponse: string;
    switch (model.provider) {
      case 'GEMINI_PRO':
        rawResponse = await callGemini(prompt, 'gemini-pro');
        break;
      case 'GPT4':
        rawResponse = await callOpenAI(prompt, 'gpt-4');
        break;
      case 'CLAUDE_SONNET':
        rawResponse = await callClaude(prompt, 'claude-3-sonnet-20240229');
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
  }
  
  private async getMarketData(tickers: string[]) {
    // Implementation in Phase 3
    return [];
  }
  
  private async getNews() {
    // Implementation in Phase 3
    return [];
  }
}
```

#### **2.5 Deliverables**
- ✅ All 3 LLM providers integrated
- ✅ Prompt template created and tested
- ✅ Response parser with Zod validation
- ✅ Model Manager service implemented
- ✅ Decision logging functional

---

### **Phase 3: Market Data & Trading Engine (Week 3-4)**

#### **3.1 Data Service Integration**

**`lib/services/data-service.ts`**
```typescript
import { prisma } from '@/lib/db/prisma';
import { KiteConnect } from 'kiteconnect';

interface MarketDataPoint {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
}

export class DataService {
  private kite: KiteConnect;
  private newsApiKey: string;
  
  constructor() {
    // Initialize Zerodha Kite Connect
    this.kite = new KiteConnect({
      api_key: process.env.ZERODHA_API_KEY!,
    });
    this.kite.setAccessToken(process.env.ZERODHA_ACCESS_TOKEN!);
    this.newsApiKey = process.env.NEWS_API_KEY!;
  }
  
  async getMarketData(tickers: string[]): Promise<MarketDataPoint[]> {
    const results: MarketDataPoint[] = [];
    
    try {
      // Convert NSE tickers to Kite instrument tokens
      // Example: RELIANCE -> NSE:RELIANCE
      const instruments = tickers.map(ticker => `NSE:${ticker}`);
      
      // Fetch quotes from Kite Connect
      const quotes = await this.kite.getQuote(instruments);
      
      for (const ticker of tickers) {
        const instrumentKey = `NSE:${ticker}`;
        const quote = quotes[instrumentKey];
        
        if (quote && quote.last_price) {
          const change = quote.last_price - quote.ohlc.open;
          const changePct = (change / quote.ohlc.open) * 100;
          
          results.push({
            ticker,
            price: quote.last_price,
            change,
            changePct,
            volume: quote.volume,
          });
          
          // Cache in database
          await prisma.marketData.create({
            data: {
              ticker,
              price: quote.last_price,
              change,
              changePct,
              volume: quote.volume,
              timestamp: new Date(),
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch market data from Kite:', error);
      
      // Fallback to Yahoo Finance India
      for (const ticker of tickers) {
        try {
          const response = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.NS?interval=1d&range=2d`
          );
          const data = await response.json();
          
          if (data.chart && data.chart.result[0]) {
            const result = data.chart.result[0];
            const quote = result.meta;
            const prevClose = quote.previousClose;
            const currentPrice = quote.regularMarketPrice;
            
            results.push({
              ticker,
              price: currentPrice,
              change: currentPrice - prevClose,
              changePct: ((currentPrice - prevClose) / prevClose) * 100,
              volume: result.indicators.quote[0].volume[0] || 0,
            });
          }
        } catch (fallbackError) {
          console.error(`Failed to fetch data for ${ticker} from fallback:`, fallbackError);
        }
      }
    }
    
    return results;
  }
  
  async getNews(limit: number = 10): Promise<Array<{ title: string; summary: string }>> {
    try {
      // Fetch Indian business news from NewsAPI
      const response = await fetch(
        `https://newsapi.org/v2/top-headlines?country=in&category=business&language=en&apiKey=${this.newsApiKey}`
      );
      const data = await response.json();
      
      return data.articles.slice(0, limit).map((article: any) => ({
        title: article.title,
        summary: article.description || article.title,
      }));
    } catch (error) {
      console.error('Failed to fetch news:', error);
      return [];
    }
  }
}
```

#### **3.2 Broker Service (Alpaca Paper Trading)**

**`lib/services/broker-service.ts`**
```typescript
import { KiteConnect } from 'kiteconnect';

export class BrokerService {
  private kite: KiteConnect;
  
  constructor() {
    this.kite = new KiteConnect({
      api_key: process.env.KITE_API_KEY!,
    });
    this.kite.setAccessToken(process.env.KITE_ACCESS_TOKEN!);
  }
  
  async submitOrder(params: {
    ticker: string;
    action: 'BUY' | 'SELL';
    shares: number;
  }): Promise<{
    orderId: string;
    status: string;
    filledPrice?: number;
  }> {
    try {
      // Place order on NSE through Kite Connect
      const orderParams = {
        exchange: 'NSE',
        tradingsymbol: params.ticker,
        transaction_type: params.action,
        quantity: params.shares,
        order_type: 'MARKET',
        product: 'CNC', // Cash and Carry for delivery
        variety: 'regular',
      };
      
      const orderId = await this.kite.placeOrder('regular', orderParams);
      
      // Wait for fill
      await this.waitForFill(orderId);
      
      // Get order details
      const orders = await this.kite.getOrders();
      const filledOrder = orders.find((o: any) => o.order_id === orderId);
      
      return {
        orderId: orderId,
        status: filledOrder?.status || 'UNKNOWN',
        filledPrice: filledOrder?.average_price || 0,
      };
    } catch (error) {
      console.error('Order submission failed:', error);
      throw error;
    }
  }
  
  private async waitForFill(orderId: string, maxWait: number = 30000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const orders = await this.kite.getOrders();
      const order = orders.find((o: any) => o.order_id === orderId);
      
      if (!order) throw new Error(`Order ${orderId} not found`);
      
      if (order.status === 'COMPLETE') return;
      if (order.status === 'REJECTED' || order.status === 'CANCELLED') {
        throw new Error(`Order ${orderId} was ${order.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Order ${orderId} did not fill within ${maxWait}ms`);
  }
  
  async getCurrentPrice(ticker: string): Promise<number> {
    try {
      const quote = await this.kite.getQuote([`NSE:${ticker}`]);
      return quote[`NSE:${ticker}`]?.last_price || 0;
    } catch (error) {
      console.error(`Failed to get price for ${ticker}:`, error);
      throw error;
    }
  }
}
```

#### **3.3 Portfolio Calculator**

**`lib/services/portfolio-calculator.ts`**
```typescript
import { prisma } from '@/lib/db/prisma';
import { BrokerService } from './broker-service';

export class PortfolioCalculator {
  private brokerService: BrokerService;
  
  constructor() {
    this.brokerService = new BrokerService();
  }
  
  async calculateTotalValue(portfolioId: string): Promise<{
    totalValue: number;
    cashBalance: number;
    positionsValue: number;
    returnPct: number;
  }> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });
    
    if (!portfolio) throw new Error(`Portfolio ${portfolioId} not found`);
    
    let positionsValue = 0;
    
    for (const position of portfolio.positions) {
      const currentPrice = await this.brokerService.getCurrentPrice(position.ticker);
      positionsValue += currentPrice * position.shares;
    }
    
    const cashBalance = portfolio.cashBalance.toNumber();
    const totalValue = cashBalance + positionsValue;
    const returnPct = ((totalValue - portfolio.initialValue.toNumber()) / portfolio.initialValue.toNumber()) * 100;
    
    return {
      totalValue,
      cashBalance,
      positionsValue,
      returnPct,
    };
  }
  
  async createSnapshot(portfolioId: string): Promise<void> {
    const values = await this.calculateTotalValue(portfolioId);
    
    await prisma.portfolioSnapshot.create({
      data: {
        portfolioId,
        totalValue: values.totalValue,
        cashBalance: values.cashBalance,
        positionsValue: values.positionsValue,
        returnPct: values.returnPct,
      },
    });
  }
}
```

#### **3.4 Trading Engine**

**`lib/services/trading-engine.ts`**
```typescript
import { prisma } from '@/lib/db/prisma';
import { ModelManager } from './model-manager';
import { BrokerService } from './broker-service';
import { PortfolioCalculator } from './portfolio-calculator';
import { TradeDecision } from '@/lib/llm/response-parser';

export class TradingEngine {
  private modelManager: ModelManager;
  private brokerService: BrokerService;
  private portfolioCalc: PortfolioCalculator;
  
  constructor() {
    this.modelManager = new ModelManager();
    this.brokerService = new BrokerService();
    this.portfolioCalc = new PortfolioCalculator();
  }
  
  async executeTradingCycle(): Promise<void> {
    const activeModels = await prisma.model.findMany({
      where: { isActive: true },
      include: { portfolio: { include: { positions: true } } },
    });
    
    console.log(`Starting trading cycle for ${activeModels.length} models`);
    
    for (const model of activeModels) {
      try {
        await this.processModel(model.id);
      } catch (error) {
        console.error(`Error processing model ${model.name}:`, error);
        await this.logError(model.id, error);
      }
    }
    
    console.log('Trading cycle completed');
  }
  
  private async processModel(modelId: string): Promise<void> {
    // Get LLM decision
    const { decision, rawResponse } = await this.modelManager.getModelDecision(modelId);
    
    // Validate decision
    const validation = await this.validateDecision(modelId, decision);
    if (!validation.isValid) {
      console.warn(`Invalid decision for ${modelId}: ${validation.reason}`);
      return;
    }
    
    // Execute trade
    if (decision.action !== 'HOLD') {
      await this.executeTrade(modelId, decision);
    }
    
    // Update portfolio snapshot
    const portfolio = await prisma.portfolio.findUnique({
      where: { modelId },
    });
    await this.portfolioCalc.createSnapshot(portfolio!.id);
  }
  
  private async validateDecision(
    modelId: string,
    decision: TradeDecision
  ): Promise<{ isValid: boolean; reason?: string }> {
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: {
        portfolio: { include: { positions: true } },
        config: true,
      },
    });
    
    if (!model) return { isValid: false, reason: 'Model not found' };
    
    // HOLD is always valid
    if (decision.action === 'HOLD') {
      return { isValid: true };
    }
    
    // Check ticker is in watchlist
    if (!decision.ticker || !model.config!.watchlist.includes(decision.ticker)) {
      return { isValid: false, reason: 'Ticker not in watchlist' };
    }
    
    // Validate BUY
    if (decision.action === 'BUY') {
      const currentPrice = await this.brokerService.getCurrentPrice(decision.ticker);
      const totalCost = currentPrice * decision.shares;
      
      if (totalCost > model.portfolio!.cashBalance.toNumber()) {
        return { isValid: false, reason: 'Insufficient cash' };
      }
      
      // Check position size limit
      const portfolioValue = await this.portfolioCalc.calculateTotalValue(model.portfolio!.id);
      const positionPct = totalCost / portfolioValue.totalValue;
      
      if (positionPct > model.config!.maxPositionSize.toNumber()) {
        return { isValid: false, reason: 'Position size exceeds limit' };
      }
    }
    
    // Validate SELL
    if (decision.action === 'SELL') {
      const position = model.portfolio!.positions.find(p => p.ticker === decision.ticker);
      
      if (!position) {
        return { isValid: false, reason: 'No position to sell' };
      }
      
      if (position.shares < decision.shares) {
        return { isValid: false, reason: 'Insufficient shares' };
      }
    }
    
    return { isValid: true };
  }
  
  private async executeTrade(modelId: string, decision: TradeDecision): Promise<void> {
    // Create trade record
    const trade = await prisma.trade.create({
      data: {
        modelId,
        ticker: decision.ticker!,
        action: decision.action,
        shares: decision.shares,
        price: 0, // Will update after fill
        totalValue: 0,
        status: 'PENDING',
      },
    });
    
    try {
      // Submit to broker
      const result = await this.brokerService.submitOrder({
        ticker: decision.ticker!,
        action: decision.action,
        shares: decision.shares,
      });
      
      // Update trade record
      await prisma.trade.update({
        where: { id: trade.id },
        data: {
          price: result.filledPrice,
          totalValue: result.filledPrice! * decision.shares,
          status: 'FILLED',
          brokerOrderId: result.orderId,
          executedAt: new Date(),
        },
      });
      
      // Update portfolio
      await this.updatePortfolio(modelId, decision, result.filledPrice!);
      
    } catch (error) {
      // Mark trade as rejected
      await prisma.trade.update({
        where: { id: trade.id },
        data: { status: 'REJECTED' },
      });
      throw error;
    }
  }
  
  private async updatePortfolio(
    modelId: string,
    decision: TradeDecision,
    filledPrice: number
  ): Promise<void> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { modelId },
      include: { positions: true },
    });
    
    if (!portfolio) throw new Error('Portfolio not found');
    
    const totalValue = filledPrice * decision.shares;
    
    if (decision.action === 'BUY') {
      // Deduct cash
      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: {
          cashBalance: { decrement: totalValue },
        },
      });
      
      // Update or create position
      const existingPosition = portfolio.positions.find(p => p.ticker === decision.ticker);
      
      if (existingPosition) {
        const newShares = existingPosition.shares + decision.shares;
        const newAvgCost = (
          (existingPosition.avgCost.toNumber() * existingPosition.shares) +
          (filledPrice * decision.shares)
        ) / newShares;
        
        await prisma.position.update({
          where: { id: existingPosition.id },
          data: {
            shares: newShares,
            avgCost: newAvgCost,
          },
        });
      } else {
        await prisma.position.create({
          data: {
            portfolioId: portfolio.id,
            ticker: decision.ticker!,
            shares: decision.shares,
            avgCost: filledPrice,
          },
        });
      }
    }
    
    if (decision.action === 'SELL') {
      // Add cash
      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: {
          cashBalance: { increment: totalValue },
        },
      });
      
      // Update or remove position
      const position = portfolio.positions.find(p => p.ticker === decision.ticker);
      
      if (position!.shares === decision.shares) {
        // Sell entire position
        await prisma.position.delete({
          where: { id: position!.id },
        });
      } else {
        // Partial sell
        await prisma.position.update({
          where: { id: position!.id },
          data: {
            shares: { decrement: decision.shares },
          },
        });
      }
    }
  }
  
  private async logError(modelId: string, error: any): Promise<void> {
    await prisma.systemLog.create({
      data: {
        level: 'ERROR',
        message: `Trading error for model ${modelId}`,
        metadata: {
          error: error.message,
          stack: error.stack,
        },
      },
    });
  }
}
```

#### **3.5 Cron Job API Route**

**`app/api/cron/trigger-trades/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { TradingEngine } from '@/lib/services/trading-engine';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const engine = new TradingEngine();
    await engine.executeTradingCycle();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Trading cycle failed:', error);
    return NextResponse.json(
      { error: 'Trading cycle failed', details: error.message },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 minutes for Vercel Pro
```

#### **3.6 Vercel Cron Configuration**

**`vercel.json`**
```json
{
  "crons": [
    {
      "path": "/api/cron/trigger-trades",
      "schedule": "*/30 9-15 * * 1-5"
    }
  ]
}
```

**Note**: This cron schedule runs every 30 minutes between 9 AM - 3 PM IST, Monday-Friday (NSE trading hours). You may need to adjust based on your server timezone.

#### **3.7 Deliverables**
- ✅ Market data integration (Polygon)
- ✅ News API integration
- ✅ Broker service with Alpaca
- ✅ Portfolio calculator with snapshots
- ✅ Complete trading engine
- ✅ Decision validation logic
- ✅ Cron job API route
- ✅ Error handling and logging

---

### **Phase 4: Frontend - Leaderboard & Dashboard (Week 5-6)**

#### **4.1 Leaderboard Page**

**`app/page.tsx`**
```typescript
import { prisma } from '@/lib/db/prisma';
import { PortfolioCalculator } from '@/lib/services/portfolio-calculator';
import LeaderboardCard from '@/components/leaderboard/LeaderboardCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LeaderboardPage() {
  const models = await prisma.model.findMany({
    include: {
      portfolio: {
        include: {
          positions: true,
          history: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      },
    },
  });
  
  // Calculate current values
  const portfolioCalc = new PortfolioCalculator();
  const modelsWithValues = await Promise.all(
    models.map(async (model) => {
      const values = await portfolioCalc.calculateTotalValue(model.portfolio!.id);
      return {
        id: model.id,
        name: model.displayName,
        provider: model.provider,
        logo: model.logo,
        totalValue: values.totalValue,
        returnPct: values.returnPct,
      };
    })
  );
  
  // Sort by total value
  modelsWithValues.sort((a, b) => b.totalValue - a.totalValue);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Apex AI Leaderboard</h1>
      
      <div className="grid gap-4">
        {modelsWithValues.map((model, index) => (
          <LeaderboardCard
            key={model.id}
            rank={index + 1}
            model={model}
          />
        ))}
      </div>
    </div>
  );
}
```

**`components/leaderboard/LeaderboardCard.tsx`**
```typescript
'use client';

import Link from 'next/link';
import Image from 'next/image';

interface LeaderboardCardProps {
  rank: number;
  model: {
    id: string;
    name: string;
    provider: string;
    logo?: string | null;
    totalValue: number;
    returnPct: number;
  };
}

export default function LeaderboardCard({ rank, model }: LeaderboardCardProps) {
  const isPositive = model.returnPct >= 0;
  
  return (
    <Link href={`/models/${model.id}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 flex items-center gap-6">
        {/* Rank */}
        <div className="text-4xl font-bold text-gray-300 w-16 text-center">
          #{rank}
        </div>
        
        {/* Logo */}
        <div className="w-16 h-16 relative">
          {model.logo ? (
            <Image
              src={model.logo}
              alt={model.name}
              fill
              className="object-contain rounded-full"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {model.name[0]}
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1">
          <h3 className="text-2xl font-bold">{model.name}</h3>
          <p className="text-gray-500">{model.provider.replace('_', ' ')}</p>
        </div>
        
        {/* Performance */}
        <div className="text-right">
          <div className="text-3xl font-bold">
            ₹{model.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-lg font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{model.returnPct.toFixed(2)}%
          </div>
        </div>
      </div>
    </Link>
  );
}
```

#### **4.2 Model Detail Page**

**`app/models/[id]/page.tsx`**
```typescript
import { prisma } from '@/lib/db/prisma';
import { notFound } from 'next/navigation';
import PerformanceChart from '@/components/model-detail/PerformanceChart';
import PositionsTable from '@/components/model-detail/PositionsTable';
import TradesTable from '@/components/model-detail/TradesTable';
import DecisionLogs from '@/components/model-detail/DecisionLogs';

export default async function ModelDetailPage({ params }: { params: { id: string } }) {
  const model = await prisma.model.findUnique({
    where: { id: params.id },
    include: {
      portfolio: {
        include: {
          positions: true,
          history: {
            orderBy: { timestamp: 'asc' },
          },
        },
      },
      trades: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      decisions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      config: true,
    },
  });
  
  if (!model) notFound();
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{model.displayName}</h1>
        <p className="text-gray-600">{model.provider.replace('_', ' ')}</p>
      </div>
      
      {/* Performance Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Portfolio Performance</h2>
        <PerformanceChart data={model.portfolio!.history} />
      </div>
      
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          {/* Tab Navigation - implement with client component */}
        </div>
        
        <div className="p-6">
          {/* Current Positions */}
          <section className="mb-8">
            <h3 className="text-xl font-bold mb-4">Current Positions</h3>
            <PositionsTable positions={model.portfolio!.positions} />
          </section>
          
          {/* Recent Trades */}
          <section className="mb-8">
            <h3 className="text-xl font-bold mb-4">Recent Trades</h3>
            <TradesTable trades={model.trades} />
          </section>
          
          {/* Decision Logs */}
          <section>
            <h3 className="text-xl font-bold mb-4">Decision Logs</h3>
            <DecisionLogs decisions={model.decisions} />
          </section>
        </div>
      </div>
    </div>
  );
}
```

**`components/model-detail/PerformanceChart.tsx`**
```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface PerformanceChartProps {
  data: Array<{
    timestamp: Date;
    totalValue: number;
  }>;
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  const chartData = data.map(snapshot => ({
    timestamp: snapshot.timestamp.getTime(),
    value: Number(snapshot.totalValue),
  }));
  
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(ts) => format(new Date(ts), 'MMM d')}
        />
        <YAxis
          tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`}
        />
        <Tooltip
          labelFormatter={(ts) => format(new Date(ts), 'PPpp')}
          formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Portfolio Value']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#8884d8"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

#### **4.3 Real-time Updates with WebSocket**

**`lib/websocket/server.ts`** (separate Node.js server or Next.js custom server)
```typescript
import { Server } from 'socket.io';

const io = new Server(3001, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL,
  },
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

export function broadcastPortfolioUpdate(data: any) {
  io.emit('portfolio_updated', data);
}

export function broadcastTradeExecution(data: any) {
  io.emit('trade_executed', data);
}
```

**`components/providers/WebSocketProvider.tsx`**
```typescript
'use client';

import { createContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const WebSocketContext = createContext<Socket | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_WS_URL!);
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
    };
  }, []);
  
  return (
    <WebSocketContext.Provider value={socket}>
      {children}
    </WebSocketContext.Provider>
  );
}
```

#### **4.4 Deliverables**
- ✅ Leaderboard page with model cards
- ✅ Model detail page with charts
- ✅ Performance chart component (Recharts)
- ✅ Positions and trades tables
- ✅ Decision logs display
- ✅ WebSocket integration for live updates
- ✅ Responsive design (mobile-friendly)

---

### **Phase 5: Admin Panel & Controls (Week 6)**

#### **5.1 Admin Dashboard**

**`app/admin/page.tsx`**
```typescript
import { prisma } from '@/lib/db/prisma';
import CreateModelForm from '@/components/admin/CreateModelForm';
import ModelControls from '@/components/admin/ModelControls';
import SystemStats from '@/components/admin/SystemStats';

export default async function AdminPage() {
  const models = await prisma.model.findMany({
    include: {
      portfolio: true,
      _count: {
        select: { trades: true },
      },
    },
  });
  
  const stats = await prisma.systemLog.groupBy({
    by: ['level'],
    _count: true,
    where: {
      timestamp: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
      },
    },
  });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      
      {/* System Stats */}
      <SystemStats stats={stats} />
      
      {/* Create New Model */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Create New Model</h2>
        <CreateModelForm />
      </div>
      
      {/* Model Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Model Controls</h2>
        <ModelControls models={models} />
      </div>
    </div>
  );
}
```

#### **5.2 API Routes**

**`app/api/admin/models/route.ts`**
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: Request) {
  const body = await request.json();
  
  try {
    const model = await prisma.model.create({
      data: {
        name: body.name,
        displayName: body.displayName,
        provider: body.provider,
        logo: body.logo,
        portfolio: {
          create: {
            cashBalance: 10000,
            initialValue: 10000,
          },
        },
        config: {
          create: {
            systemPrompt: body.systemPrompt || getDefaultPrompt(),
            temperature: 0.7,
            maxTokens: 1000,
            maxPositionSize: 0.3,
            maxTradesPerDay: 10,
            watchlist: body.watchlist || ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT'],
          },
        },
      },
    });
    
    return NextResponse.json(model);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getDefaultPrompt(): string {
  // Return the default system prompt template
  return '...';
}
```

#### **5.3 Deliverables**
- ✅ Admin dashboard page
- ✅ Model creation form
- ✅ Model pause/resume controls
- ✅ System statistics display
- ✅ Error logs viewer

---

### **Phase 6: Testing & Optimization (Week 7)**

#### **6.1 Unit Tests**

**`lib/llm/__tests__/response-parser.test.ts`**
```typescript
import { describe, it, expect } from 'vitest';
import { parseTradeDecision } from '../response-parser';

describe('parseTradeDecision', () => {
  it('should parse valid BUY decision', () => {
    const response = JSON.stringify({
      action: 'BUY',
      ticker: 'AAPL',
      shares: 10,
      reasoning: 'Strong earnings report',
    });
    
    const result = parseTradeDecision(response);
    expect(result.action).toBe('BUY');
    expect(result.ticker).toBe('AAPL');
    expect(result.shares).toBe(10);
  });
  
  it('should parse decision from markdown code block', () => {
    const response = '```json\n{"action":"HOLD","ticker":null,"shares":0,"reasoning":"Market uncertain"}\n```';
    const result = parseTradeDecision(response);
    expect(result.action).toBe('HOLD');
  });
  
  it('should throw on invalid JSON', () => {
    expect(() => parseTradeDecision('invalid json')).toThrow();
  });
});
```

#### **6.2 Integration Tests**

**`lib/services/__tests__/trading-engine.test.ts`**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TradingEngine } from '../trading-engine';
import { prisma } from '@/lib/db/prisma';

describe('TradingEngine', () => {
  beforeEach(async () => {
    // Clean database
    await prisma.trade.deleteMany();
    await prisma.position.deleteMany();
    // ... setup test data
  });
  
  it('should execute full trading cycle', async () => {
    const engine = new TradingEngine();
    await engine.executeTradingCycle();
    
    // Verify trades were created
    const trades = await prisma.trade.findMany();
    expect(trades.length).toBeGreaterThan(0);
  });
});
```

#### **6.3 Load Testing**

Test with multiple models running simultaneously to ensure system can handle concurrent LLM API calls.

#### **6.4 Performance Optimizations**

1. **Database Indexing**
   - Add indexes on frequently queried columns
   - Optimize joins with proper relations

2. **Caching**
   - Cache market data for 1 minute
   - Cache news data for 5 minutes
   - Use Redis for distributed caching

3. **API Rate Limiting**
   - Implement exponential backoff for LLM APIs
   - Queue system for broker API calls

4. **Frontend Optimization**
   - Implement lazy loading for charts
   - Use React.memo for expensive components
   - Optimize images with Next.js Image component

#### **6.5 Deliverables**
- ✅ Unit test suite (80%+ coverage)
- ✅ Integration tests for critical paths
- ✅ Load testing results
- ✅ Performance optimization implemented
- ✅ Error monitoring configured (Sentry)

---

### **Phase 7: Deployment & Monitoring (Week 7)**

#### **7.1 Environment Configuration**

**Production Environment Variables**
```env
# Database
DATABASE_URL="postgresql://..."

# LLM APIs
GOOGLE_API_KEY="..."
OPENAI_API_KEY="..."
ANTHROPIC_API_KEY="..."

# Indian Market Data APIs
ZERODHA_API_KEY="..."
ZERODHA_API_SECRET="..."
ZERODHA_ACCESS_TOKEN="..."
NEWS_API_KEY="..."

# Broker (Zerodha Kite Connect)
KITE_API_KEY="..."
KITE_API_SECRET="..."
KITE_ACCESS_TOKEN="..."

# Security
CRON_SECRET="..."
NEXTAUTH_SECRET="..."

# Monitoring
SENTRY_DSN="..."
```

#### **7.2 Vercel Deployment**

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel --prod

# Configure environment variables
vercel env add DATABASE_URL production
vercel env add GOOGLE_API_KEY production
# ... add all environment variables
```

#### **7.3 Database Migration**

```bash
# Push schema to production database
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

#### **7.4 Monitoring Setup**

**Sentry Integration**
```typescript
// app/layout.tsx
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

**Health Check Endpoint**
```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    broker: await checkBroker(),
    llm: await checkLLM(),
  };
  
  const isHealthy = Object.values(checks).every(c => c.status === 'ok');
  
  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503,
  });
}
```

#### **7.5 Deliverables**
- ✅ Production deployment on Vercel
- ✅ Database hosted and configured
- ✅ Cron jobs scheduled and tested
- ✅ Monitoring and alerting configured
- ✅ Health check endpoints
- ✅ Documentation for operations

---

## **V. Risk Mitigation Strategies**

### **5.1 LLM API Failures**
- **Retry Logic**: 3 attempts with exponential backoff
- **Fallback Responses**: Default to HOLD on repeated failures
- **Circuit Breaker**: Temporarily disable model after 5 consecutive failures

### **5.2 Broker API Issues**
- **Mock Mode**: Development mode with simulated fills
- **Order Timeout**: Cancel orders that don't fill within 30 seconds
- **Duplicate Protection**: Check for recent identical orders

### **5.3 Data Quality**
- **Stale Data Detection**: Reject market data older than 15 minutes
- **Price Anomaly Detection**: Flag prices that change >20% in one cycle
- **News Relevance**: Filter for financial keywords

### **5.4 System Reliability**
- **Transaction Rollback**: Atomic portfolio updates
- **Audit Logging**: All trades logged before execution
- **Manual Override**: Admin can pause individual models

---

## **VI. Post-Launch Roadmap**

### **Phase 8: Enhancements (Month 2)**
- [ ] Backtesting engine with historical data
- [ ] Model personality customization (risk tolerance)
- [ ] Advanced charting (candlesticks, indicators)
- [ ] Email notifications for major trades
- [ ] Public API for external integrations

### **Phase 9: Advanced Features (Month 3)**
- [ ] Multi-asset support (crypto, ETFs)
- [ ] Tournament mode (time-limited competitions)
- [ ] Social features (model following, comments)
- [ ] Advanced analytics dashboard
- [ ] Model ensemble strategies

### **Phase 10: Scale (Month 4+)**
- [ ] Support 50+ concurrent models
- [ ] Options trading support
- [ ] Machine learning for prompt optimization
- [ ] Community-submitted models
- [ ] Monetization (premium features)

---

## **VII. Success Metrics**

### **Technical KPIs**
- Trading cycle completion time: < 2 minutes
- API success rate: > 99%
- Database query time: < 100ms average
- Frontend page load: < 1 second
- WebSocket latency: < 200ms

### **Business KPIs**
- Number of active models: 5+ at launch
- Trading cycles per day: 24 (hourly)
- User engagement: 1000+ page views/day
- Model performance variance: > 5% spread in leaderboard
- System uptime: > 99.5%

---

## **VIII. Budget Estimate**

### **Monthly Operating Costs**

| Service | Tier | Cost |
|---------|------|------|
| Vercel Pro | Production | ₹1,650/mo (~$20) |
| PostgreSQL (Supabase) | Free → Pro | ₹0-2,000/mo |
| LLM APIs | Pay-per-use | ₹4,000-16,500/mo |
| Zerodha Kite Connect | Live + Historical | ₹2,000/mo |
| NewsAPI | Developer | ₹0-4,000/mo |
| Sentry | Team | ₹0-2,150/mo |
| **Total** | | **₹7,650-28,300/mo** (~$90-340/mo) |

### **Development Time**
- Full-time: 7 weeks (~280 hours)
- Part-time (20h/week): 14 weeks

---

## **IX. NSE/India-Specific Considerations**

### **9.1 Trading Hours & Holidays**
- **NSE Trading Hours**: 9:15 AM - 3:30 PM IST (Monday-Friday)
- **Pre-market**: 9:00 AM - 9:15 AM (optional for advanced features)
- **Post-market**: 3:30 PM - 4:00 PM (optional)
- **Market Holidays**: NSE observes ~15 holidays per year (Diwali, Holi, Republic Day, etc.)
- **Cron Consideration**: Schedule trades only during market hours, implement holiday calendar

### **9.2 Zerodha Kite Connect Setup**
1. **Create Developer Account**: Visit [Kite Connect](https://kite.trade)
2. **Subscribe to APIs**: Historical + Live market data (₹2,000/month)
3. **Generate API Key**: Get your API key and secret
4. **Access Token Generation**: 
   - Initial login requires manual authorization
   - Token expires daily, needs refresh
   - Implement token refresh mechanism

**Token Refresh Pattern:**
```typescript
// Store refresh token in database
async function refreshKiteToken() {
  const kite = new KiteConnect({ api_key: process.env.KITE_API_KEY! });
  const response = await kite.generateSession(request_token, api_secret);
  // Store response.access_token in env or database
}
```

### **9.3 NSE Stock Ticker Format**
- **NSE Format**: Simple company symbol (e.g., `RELIANCE`, `TCS`, `INFY`)
- **Yahoo Finance**: Add `.NS` suffix (e.g., `RELIANCE.NS`)
- **Kite Connect**: Prefix with exchange (e.g., `NSE:RELIANCE`)
- **Ensure Consistency**: Normalize tickers across all services

### **9.4 Popular NSE Stocks for Watchlist**

**Nifty 50 Top Stocks:**
- **IT**: TCS, INFOSYS, WIPRO, HCLTECH, TECHM
- **Banking**: HDFCBANK, ICICIBANK, SBIN, KOTAKBANK, AXISBANK
- **Energy**: RELIANCE, ONGC, BPCL, IOC
- **Auto**: TATAMOTORS, M&M, BAJAJ-AUTO, MARUTI
- **FMCG**: ITC, HINDUNILVR, NESTLEIND
- **Pharma**: SUNPHARMA, DRREDDY, CIPLA
- **Telecom**: BHARTIARTL, JIO (when listed)
- **Infrastructure**: LT, ULTRACEMCO, ADANIPORTS

### **9.5 Regulatory Considerations (SEBI)**
- **Paper Trading Only**: Ensure clear disclaimer that system uses paper trading
- **No Real Money**: Never handle real money or user funds
- **Compliance**: Follow SEBI guidelines for algo trading platforms
- **Disclaimers**: Add clear disclaimers about AI-generated trades

### **9.6 Indian News Sources**
- **Moneycontrol**: Leading Indian financial news
- **Economic Times**: Business newspaper
- **Business Standard**: Financial news
- **LiveMint**: Financial journalism
- **NewsAPI with `country=in&category=business`**: Free tier available

### **9.7 Currency & Localization**
- **Currency Symbol**: ₹ (INR)
- **Number Format**: Indian numbering (lakhs, crores)
- **Date Format**: DD/MM/YYYY common in India
- **Timezone**: IST (UTC+5:30)

**Example Formatting:**
```typescript
// Format currency in Indian style
const formatINR = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Output: ₹10,00,000 (10 lakhs)
```

### **9.8 Latency & Performance**
- **API Rate Limits**: Kite Connect has rate limits (~3 requests/second)
- **Market Data Delay**: Real-time data vs 15-minute delayed data
- **Server Location**: Consider hosting in Indian data centers (Mumbai) for lower latency
- **Vercel Regions**: Use Mumbai region for better performance

### **9.9 Alternative Data Providers**
If Zerodha Kite Connect is too expensive or unavailable:

1. **Upstox API**: Similar to Kite, ₹1,500-2,000/month
2. **Angel One API**: SmartAPI for algo trading
3. **Yahoo Finance**: Free but limited and unofficial
4. **Alpha Vantage**: Limited Indian stock support
5. **NSE Official Website**: Delayed data, free

### **9.10 Testing Without Real API**
For development without paying for APIs:

```typescript
// Mock broker service for testing
export class MockBrokerService {
  async submitOrder(params: any) {
    // Simulate order execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      orderId: 'MOCK-' + Date.now(),
      status: 'COMPLETE',
      filledPrice: Math.random() * 1000 + 1000, // Random price
    };
  }
  
  async getCurrentPrice(ticker: string) {
    // Return mock price based on ticker
    const mockPrices = {
      'RELIANCE': 2450.50,
      'TCS': 3650.00,
      'INFY': 1520.25,
      // ... more mocks
    };
    return mockPrices[ticker] || 1000;
  }
}
```

---

## **X. Conclusion**

This implementation plan provides a comprehensive roadmap for building Apex AI focused on Indian markets (NSE) from concept to production. The phased approach ensures steady progress with clear milestones, while the modular architecture allows for future enhancements without major refactoring.

**Key Success Factors:**
1. **Robust Error Handling**: LLMs are unpredictable - plan for failures
2. **NSE Trading Hours**: Respect market hours and holidays
3. **Kite Connect Integration**: Properly handle token refresh and rate limits
4. **Comprehensive Testing**: Financial systems require high reliability
5. **Indian Market Context**: Use NSE tickers, INR currency, and local news sources
6. **Scalable Architecture**: Design for growth from day one
7. **Clear Monitoring**: Visibility into system health is critical
8. **Iterative Development**: Launch with core features, enhance based on usage

**Indian Market Advantages:**
- **Growing Retail Participation**: Increasing number of retail investors
- **Strong Tech Infrastructure**: Robust trading platforms (Zerodha, Upstox)
- **Nifty 50 Liquidity**: Highly liquid large-cap stocks
- **AI Interest**: Growing interest in AI/ML in finance in India

The system is designed to be extensible, allowing easy addition of new LLM providers, data sources, and trading strategies. With proper execution of this plan, Apex AI will provide a fascinating platform for comparing AI decision-making capabilities in the Indian stock market context.

---

**Ready to build? Start with Phase 1 and let's create something amazing! 🚀**

**Pro Tip**: Start with mock data services and gradually integrate real APIs as you validate the trading logic. This saves costs during development while ensuring the system works correctly before going live with real market data.
