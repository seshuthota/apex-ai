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

// Determine if we should use mock services
const useMockServices = process.env.USE_MOCK_SERVICES === 'true' || 
                        !process.env.ZERODHA_API_KEY ||
                        !process.env.KITE_API_KEY;

/**
 * Get Data Service (mock or real)
 */
export function getDataService() {
  if (useMockServices) {
    console.log('📦 Using Mock Data Service');
    return new MockDataService();
  }
  console.log('🔗 Using Real Data Service (Kite Connect)');
  return new DataService();
}

/**
 * Get Broker Service (mock or real)
 */
export function getBrokerService() {
  if (useMockServices) {
    console.log('📦 Using Mock Broker Service');
    return new MockBrokerService();
  }
  console.log('🔗 Using Real Broker Service (Kite Connect)');
  return new BrokerService();
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
