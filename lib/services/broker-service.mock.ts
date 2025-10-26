/**
 * Mock Broker Service
 * 
 * Used for development and testing without Zerodha API.
 * Simulates order execution with realistic delays.
 */

import type { BrokerOrderResult } from '@/lib/types';

export class MockBrokerService {
  private orderCounter = 0;
  private mockPrices: Map<string, number> = new Map();

  constructor() {
    // Initialize with realistic NSE prices
    this.mockPrices.set('RELIANCE', 2450.50);
    this.mockPrices.set('TCS', 3650.00);
    this.mockPrices.set('INFY', 1520.25);
    this.mockPrices.set('HDFCBANK', 1640.75);
    this.mockPrices.set('ICICIBANK', 1050.50);
    this.mockPrices.set('SBIN', 610.30);
    this.mockPrices.set('BHARTIARTL', 1550.00);
    this.mockPrices.set('ITC', 445.20);
    this.mockPrices.set('KOTAKBANK', 1750.60);
    this.mockPrices.set('LT', 3500.00);
  }

  /**
   * Submit a mock order
   */
  async submitOrder(params: {
    ticker: string;
    action: 'BUY' | 'SELL';
    shares: number;
  }): Promise<BrokerOrderResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const orderId = `MOCK-${++this.orderCounter}-${Date.now()}`;
    const basePrice = this.mockPrices.get(params.ticker) || 1000;
    
    // Add small random variation to simulate market price
    const variation = (Math.random() - 0.5) * 0.01; // ±0.5%
    const filledPrice = basePrice * (1 + variation);

    // Silent order placement

    // Update mock price for next order (slight drift)
    this.mockPrices.set(params.ticker, filledPrice);

    // Simulate order filling delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // 95% success rate (5% rejection for realism)
    const isRejected = Math.random() < 0.05;

    if (isRejected) {
      // Silent rejection
      return {
        orderId,
        status: 'REJECTED',
      };
    }

    // Silent order fill

    return {
      orderId,
      status: 'COMPLETE',
      filledPrice: Number(filledPrice.toFixed(2)),
    };
  }

  /**
   * Get current price for a ticker
   */
  async getCurrentPrice(ticker: string): Promise<number> {
    const price = this.mockPrices.get(ticker);
    if (!price) {
      throw new Error(`Mock price not available for ${ticker}`);
    }
    
    // Add small random variation
    const variation = (Math.random() - 0.5) * 0.005; // ±0.25%
    return Number((price * (1 + variation)).toFixed(2));
  }

  /**
   * Check order status (mock implementation)
   */
  async getOrderStatus(orderId: string): Promise<string> {
    // All mock orders are immediately filled
    return 'COMPLETE';
  }

  /**
   * Set mock price for testing
   */
  setMockPrice(ticker: string, price: number): void {
    this.mockPrices.set(ticker, price);
    // Silent price update
  }

  /**
   * Simulate market volatility
   */
  simulateVolatility(percentage: number = 2): void {
    this.mockPrices.forEach((price, ticker) => {
      const change = (Math.random() - 0.5) * 2 * percentage; // Random change
      const newPrice = price * (1 + change / 100);
      this.mockPrices.set(ticker, newPrice);
    });
    // Silent volatility simulation
  }
}
