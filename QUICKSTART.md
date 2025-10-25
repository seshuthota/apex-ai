# Quick Start Guide - Test Your Trading System

Get Apex AI running in 5 minutes! 🚀

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Git repository cloned

## Step 1: Install Dependencies

```bash
cd apex-ai
pnpm install
```

## Step 2: Set Up Environment

```bash
# Copy environment template
cp .env.example .env

# The default settings use mock services - no API keys needed!
```

## Step 3: Start Database

```bash
# Start Prisma development database
pnpm exec prisma dev

# In a new terminal, generate Prisma client
pnpm run db:generate
```

## Step 4: Seed Database

```bash
# Create initial trading models
pnpm run db:seed
```

Expected output:
```
🌱 Starting database seed...
✅ Created model: Gemini Pro Trader
✅ Created model: GPT-4 Trader
✅ Created model: Claude Sonnet Trader
✅ Created model: Llama 3.1 Trader (OpenRouter)
🎉 Database seed completed successfully!
```

## Step 5: Run First Trading Cycle

```bash
pnpm run test:trading
```

Expected output:
```
🧪 Starting Trading Engine Test

1️⃣  Checking database connection...
   ✅ Database connected

2️⃣  Checking for trading models...
   ✅ Found 4 models:
      - Gemini Pro Trader (GEMINI_PRO)
      - GPT-4 Trader (GPT4)
      - Claude Sonnet Trader (CLAUDE_SONNET)
      - Llama 3.1 Trader (OpenRouter) (OPENROUTER_LLAMA)

3️⃣  Portfolio states BEFORE trading:
   [Shows each model's cash and positions]

4️⃣  Running trading cycle...
   [Shows trading activity]

✅ Trading cycle completed!
```

## Step 6: View Results in Database

```bash
# Open Prisma Studio
pnpm run db:studio
```

This opens a web UI at `http://localhost:5555` where you can see:
- **Models** - Your 4 AI traders
- **Portfolios** - Cash and positions
- **Trades** - All executed trades
- **DecisionLogs** - AI reasoning for each decision
- **PortfolioSnapshots** - Historical performance

## Step 7: Start Dev Server

```bash
pnpm dev
```

Visit `http://localhost:3000` (frontend coming in Phase 4!)

---

## 🎯 What Just Happened?

1. ✅ Created 4 AI trading models
2. ✅ Each started with ₹100,000
3. ✅ Mock data service generated realistic NSE prices
4. ✅ Each AI made trading decisions
5. ✅ Trades were executed (simulated)
6. ✅ Portfolios updated
7. ✅ Performance tracked

## 🧪 Try Different Scenarios

### Simulate a Market Crash

Edit `scripts/test-trading.ts` and add before the trading cycle:

```typescript
// After: const engine = getTradingEngine();
const mockData = engine['dataService'];
if (mockData.simulateCrash) {
  mockData.simulateCrash(5); // 5% crash
}
```

### Run Multiple Cycles

```bash
# Run 3 trading cycles
pnpm run test:trading && pnpm run test:trading && pnpm run test:trading
```

### View Performance Over Time

```typescript
import { PortfolioCalculator } from './lib/services/portfolio-calculator';
import { getDataService } from './lib/services';

const calc = new PortfolioCalculator(getDataService());
const leaderboard = await calc.getLeaderboard();
console.table(leaderboard);
```

---

## 📊 Understanding the Output

### Portfolio State
```
Gemini Pro Trader:
   Cash: ₹95,000
   Positions: 2
      - 10 x RELIANCE @ ₹2,450.50
      - 5 x TCS @ ₹3,650.00
```

**Explanation**:
- Started with ₹100,000
- Bought 10 RELIANCE shares for ₹24,505
- Bought 5 TCS shares for ₹18,250
- Remaining cash: ₹57,245

### Trade Log
```
✅ Gemini Pro Trader: BUY 10 x RELIANCE @ ₹2,450.50
```

**Explanation**:
- ✅ = Successfully executed
- BUY = Purchase order
- 10 shares at ₹2,450.50 each
- Total: ₹24,505

### Decision Log
```
Reasoning: "Strong Q4 results announced by Reliance. 
Technical indicators show bullish momentum. 
Allocating 25% of portfolio to RELIANCE..."
```

**Explanation**: This is the AI's thought process for making the trade

---

## 🔧 Configuration Options

### Use Mock Services (Default)

```bash
# In .env
USE_MOCK_SERVICES="true"
```

**Advantages**:
- ✅ No API keys needed
- ✅ Instant testing
- ✅ Control market conditions
- ✅ Free to use

### Use Real APIs (Advanced)

```bash
# In .env
USE_MOCK_SERVICES="false"

# Add API keys
ZERODHA_API_KEY="your_key"
ZERODHA_ACCESS_TOKEN="your_token"
KITE_API_KEY="your_key"
KITE_ACCESS_TOKEN="your_token"
NEWS_API_KEY="your_key"
```

**Requirements**:
- Zerodha Kite Connect account (₹2,000/month)
- NewsAPI account (free tier available)
- LLM API keys (for real AI decisions)

---

## 🎓 Next Steps

### 1. Explore the Database
```bash
pnpm run db:studio
```

Look at:
- Decision logs - See AI reasoning
- Trades - View all transactions
- Portfolio snapshots - Performance over time

### 2. Test with Real LLMs

Add an LLM API key to `.env`:
```bash
GOOGLE_API_KEY="your_gemini_key"  # Free tier available
```

The next trading cycle will use real AI!

### 3. Run Scheduled Trading

```bash
# Start dev server
pnpm dev

# In another terminal, trigger via API
curl -X POST http://localhost:3000/api/trading/test
```

### 4. View Live Leaderboard (Coming in Phase 4)

Frontend UI with:
- Real-time leaderboard
- Performance charts
- Trade history
- Decision analysis

---

## 🐛 Common Issues

### "No models found"
```bash
pnpm run db:seed
```

### "Database connection failed"
```bash
pnpm exec prisma dev
# Wait for server to start, then try again
```

### "Prisma client not generated"
```bash
pnpm run db:generate
```

### "Port 3000 already in use"
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9
```

---

## 📚 Learn More

- **SETUP.md** - Complete setup guide
- **implementation-plan.md** - Full technical plan
- **PHASE3-SUMMARY.md** - Phase 3 details
- **lib/services/README.md** - Service documentation

---

## ✅ Success Checklist

- [ ] Dependencies installed
- [ ] Database started
- [ ] Database seeded (4 models created)
- [ ] First trading cycle completed
- [ ] Trades visible in database
- [ ] Decision logs created
- [ ] Portfolio snapshots recorded

**All checked?** You're ready to build the frontend! 🎨

---

## 🎉 Congratulations!

You now have a working AI trading competition platform with:
- ✅ 4 AI traders (Gemini, GPT-4, Claude, Llama)
- ✅ Realistic market simulation
- ✅ Automatic trading cycles
- ✅ Performance tracking
- ✅ Complete trade history

**Time to see them compete!** 🏆
