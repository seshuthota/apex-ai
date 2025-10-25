# Services Documentation

This directory contains all the backend services for Apex AI trading platform.

## Architecture Overview

```
┌─────────────────────┐
│  Trading Engine     │  ← Main orchestrator
│  (trading-engine.ts)│
└──────────┬──────────┘
           │
           ├─────────────────────────────────┐
           │                                 │
    ┌──────▼──────┐                  ┌──────▼──────┐
    │ Data Service│                  │Broker Service│
    └──────┬──────┘                  └──────┬───────┘
           │                                │
    ┌──────▼──────┐                  ┌──────▼───────┐
    │ Market Data │                  │  Trade       │
    │ News        │                  │  Execution   │
    └─────────────┘                  └──────────────┘
           │
    ┌──────▼──────────┐
    │ Model Manager   │
    │ (LLM decisions) │
    └──────┬──────────┘
           │
    ┌──────▼───────────┐
    │Portfolio Calc    │
    │(P&L tracking)    │
    └──────────────────┘
```

## Services

### 1. Trading Engine (`trading-engine.ts`)

**Purpose**: Main orchestrator that executes the trading cycle.

**Flow**:
1. Check if market is open
2. Fetch market data and news
3. Get LLM decisions for each model
4. Validate decisions
5. Execute trades
6. Update portfolios
7. Create snapshots

**Usage**:
```typescript
import { getTradingEngine } from '@/lib/services';

const engine = getTradingEngine();
const result = await engine.executeTradingCycle();
```

### 2. Data Service (`data-service.ts` / `data-service.mock.ts`)

**Purpose**: Fetch market data and news.

**Real Implementation**:
- Primary: Zerodha Kite Connect
- Fallback: Yahoo Finance India
- Cache: PostgreSQL

**Mock Implementation**:
- Generates realistic NSE price movements
- Mock Indian business news
- Simulates market volatility

**Usage**:
```typescript
import { getDataService } from '@/lib/services';

const dataService = getDataService();
const marketData = await dataService.getMarketData(['RELIANCE', 'TCS']);
const news = await dataService.getNews(10);
```

### 3. Broker Service (`broker-service.ts` / `broker-service.mock.ts`)

**Purpose**: Execute trades on NSE.

**Real Implementation**:
- Zerodha Kite Connect API
- Paper trading support
- Order status tracking

**Mock Implementation**:
- Simulates order execution
- Realistic delays and prices
- 95% success rate

**Usage**:
```typescript
import { getBrokerService } from '@/lib/services';

const broker = getBrokerService();
const result = await broker.submitOrder({
  ticker: 'RELIANCE',
  action: 'BUY',
  shares: 10,
});
```

### 4. Portfolio Calculator (`portfolio-calculator.ts`)

**Purpose**: Calculate portfolio valuations and track performance.

**Features**:
- Total value calculation
- P&L tracking
- Performance history
- Position analysis
- Leaderboard generation

**Usage**:
```typescript
import { PortfolioCalculator } from '@/lib/services/portfolio-calculator';
import { getDataService } from '@/lib/services';

const calc = new PortfolioCalculator(getDataService());
const valuation = await calc.calculateTotalValue(portfolioId);
await calc.createSnapshot(portfolioId);
```

### 5. Model Manager (`model-manager.ts`)

**Purpose**: Get trading decisions from LLMs.

**Features**:
- Supports multiple LLM providers
- 3-attempt retry logic
- Exponential backoff
- Decision logging
- Automatic fallback to HOLD

**Usage**:
```typescript
import { ModelManager } from '@/lib/services/model-manager';

const manager = new ModelManager();
const { decision } = await manager.getModelDecision(
  modelId,
  marketData,
  news
);
```

## Service Factory (`index.ts`)

**Purpose**: Provide appropriate services based on configuration.

**Logic**:
```
USE_MOCK_SERVICES = true  → Mock services
ZERODHA_API_KEY missing   → Mock services
Otherwise                 → Real services
```

**Usage**:
```typescript
import { getTradingEngine, getDataService, getBrokerService } from '@/lib/services';

// Automatically uses mock or real based on config
const engine = getTradingEngine();
const dataService = getDataService();
const broker = getBrokerService();
```

## Mock vs Real Services

### When to Use Mock Services

✅ **Development** - Test without API keys  
✅ **Testing** - Predictable, repeatable results  
✅ **Debugging** - Control market conditions  
✅ **Demo** - Show functionality without real data  

### When to Use Real Services

✅ **Production** - Live trading with real data  
✅ **Backtesting** - Historical data analysis  
✅ **Integration Testing** - Verify API connections  

## Configuration

### Environment Variables

```bash
# Use mock services (default for development)
USE_MOCK_SERVICES="true"

# Required for real services
ZERODHA_API_KEY="..."
ZERODHA_ACCESS_TOKEN="..."
KITE_API_KEY="..."
KITE_ACCESS_TOKEN="..."
NEWS_API_KEY="..."
```

### Auto-Detection

If `ZERODHA_API_KEY` or `KITE_API_KEY` is missing, the system automatically uses mock services.

## Testing

### Test Trading Cycle

```bash
# Test with mock services
curl -X POST http://localhost:3000/api/trading/test

# Test with real services (if configured)
curl -X POST http://localhost:3000/api/trading/test \
  -H "Content-Type: application/json" \
  -d '{"forceReal": true}'
```

### Manual Execution

```typescript
// scripts/test-trading.ts
import { getTradingEngine } from '@/lib/services';

async function main() {
  process.env.USE_MOCK_SERVICES = 'true';
  
  const engine = getTradingEngine();
  const result = await engine.executeTradingCycle();
  
  console.log(result);
}

main();
```

Run with: `tsx scripts/test-trading.ts`

## Error Handling

All services implement robust error handling:

1. **Retry Logic**: 3 attempts with exponential backoff (Model Manager)
2. **Fallbacks**: Yahoo Finance if Kite fails (Data Service)
3. **Caching**: Use cached data if APIs fail (Data Service)
4. **Default Actions**: Return HOLD if decision fails (Model Manager)
5. **Transaction Safety**: Atomic portfolio updates (Trading Engine)

## Logging

Services log to:
- **Console**: Real-time monitoring
- **Database**: System logs table
- **Sentry**: Error tracking (if configured)

### Log Levels

- `INFO`: Normal operations
- `WARN`: Recoverable issues
- `ERROR`: Failures requiring attention

## Performance

### Trading Cycle Duration

- **Mock Mode**: ~2-5 seconds for 4 models
- **Real Mode**: ~10-30 seconds (depends on API latency)

### Optimizations

1. **Parallel Fetching**: Market data fetched once for all models
2. **Batch Updates**: Portfolio updates in transactions
3. **Caching**: Market data cached for 1 hour
4. **Connection Pooling**: Prisma connection pooling

## Monitoring

### Health Checks

```typescript
// Check if services are healthy
const dataService = getDataService();
const isMarketOpen = dataService.isMarketOpen();
const broker = getBrokerService();
const isAvailable = broker.isAvailable();
```

### Metrics to Track

- Trading cycle success rate
- Decision validation failure rate
- Order execution success rate
- Average cycle duration
- Portfolio snapshot frequency

## Troubleshooting

### "Kite Connect not initialized"
→ Set `USE_MOCK_SERVICES="true"` or configure Kite API keys

### "Market is closed"
→ Trading only runs during NSE hours (9:15 AM - 3:30 PM IST)

### "Invalid trade decision format"
→ LLM returned invalid JSON, check decision logs

### "Insufficient cash"
→ Portfolio doesn't have enough cash for purchase

### "Position size exceeds limit"
→ Trade would exceed maxPositionSize (default 30%)

## Best Practices

1. **Always start with mock services** for development
2. **Test thoroughly** before enabling real APIs
3. **Monitor system logs** for errors
4. **Set up alerts** for failed trading cycles
5. **Review decision logs** to understand model behavior
6. **Create regular portfolio snapshots** for analysis
7. **Use transactions** for all portfolio updates
8. **Implement circuit breakers** for repeated failures

## Future Enhancements

- [ ] Webhook support for order updates
- [ ] Redis caching layer
- [ ] Queue system (BullMQ) for async processing
- [ ] Rate limiting and throttling
- [ ] Performance analytics
- [ ] A/B testing framework
- [ ] Model comparison tools
- [ ] Risk management system
