/**
 * Service Factory
 * 
 * Exports the appropriate services based on environment configuration
 */

import { DataService } from './data-service';
import { MockDataService } from './data-service.mock';
import { BrokerService } from './broker-service';
import { MockBrokerService } from './broker-service.mock';
import { TradingEngine } from './trading-engine';
import type { IDataService, IBrokerService } from '@/lib/types';

// Determine if we should use mock services
const zerodhaApiKey = process.env.ZERODHA_API_KEY ?? process.env.KITE_API_KEY ?? '';
const zerodhaAccessToken = process.env.ZERODHA_ACCESS_TOKEN ?? process.env.KITE_ACCESS_TOKEN ?? '';
const useMockServices =
  process.env.USE_MOCK_SERVICES === 'true' ||
  !zerodhaApiKey ||
  !zerodhaAccessToken;

// Singletons to keep state (mock price history etc.) consistent across calls
const dataServiceInstance: IDataService = useMockServices ? new MockDataService() : new DataService();
const brokerServiceInstance: IBrokerService = useMockServices ? new MockBrokerService() : new BrokerService();

/**
 * Get Data Service (mock or real)
 */
export function getDataService(): IDataService {
  return dataServiceInstance;
}

/**
 * Get Broker Service (mock or real)
 */
export function getBrokerService(): IBrokerService {
  return brokerServiceInstance;
}

/**
 * Get Trading Engine with appropriate services
 */
export function getTradingEngine() {
  const dataService = getDataService();
  const brokerService = getBrokerService();

  return new TradingEngine({
    dataService,
    brokerService,
    useMockData: useMockServices,
  });
}

// Re-export all services for direct use
export { DataService } from './data-service';
export { MockDataService } from './data-service.mock';
export { BrokerService } from './broker-service';
export { MockBrokerService } from './broker-service.mock';
export { PortfolioCalculator } from './portfolio-calculator';
export { ModelManager } from './model-manager';
export { TradingEngine } from './trading-engine';
export * from '@/lib/market';
export * from '@/lib/broker';
export * from '@/lib/trading';
export * from '@/lib/llm';
