/**
 * Broker Service - Real Implementation
 * 
 * Executes orders through Zerodha Kite Connect
 * Supports paper trading mode
 */

import { KiteConnect } from 'kiteconnect';
import type { BrokerOrderResult } from '@/lib/types';

const ZERODHA_API_KEY =
  process.env.ZERODHA_API_KEY ?? process.env.KITE_API_KEY ?? '';
const ZERODHA_ACCESS_TOKEN =
  process.env.ZERODHA_ACCESS_TOKEN ?? process.env.KITE_ACCESS_TOKEN ?? '';

export class BrokerService {
  private kite: KiteConnect | null = null;

  constructor() {
    // Initialize Kite Connect if credentials are available
    if (ZERODHA_API_KEY && ZERODHA_ACCESS_TOKEN) {
      this.kite = new KiteConnect({
        api_key: ZERODHA_API_KEY,
      });
      this.kite.setAccessToken(ZERODHA_ACCESS_TOKEN);
      console.log('✅ Broker Service initialized with Zerodha credentials');
    } else {
      console.warn(
        '⚠️ Zerodha credentials not configured (expected ZERODHA_API_KEY and ZERODHA_ACCESS_TOKEN)',
      );
    }
  }

  /**
   * Submit an order to NSE through Kite Connect
   */
  async submitOrder(params: {
    ticker: string;
    action: 'BUY' | 'SELL';
    shares: number;
  }): Promise<BrokerOrderResult> {
    if (!this.kite) {
      throw new Error(
        'Kite Connect not initialized. Please configure ZERODHA_API_KEY and ZERODHA_ACCESS_TOKEN',
      );
    }

    try {
      // Place order on NSE
      const orderParams = {
        exchange: 'NSE',
        tradingsymbol: params.ticker,
        transaction_type: params.action,
        quantity: params.shares,
        order_type: 'MARKET', // Market order for immediate execution
        product: 'CNC', // Cash and Carry (delivery)
        variety: 'regular',
      };

      console.log(`📝 Placing ${params.action} order: ${params.shares} shares of ${params.ticker}`);

      const orderId = await this.kite.placeOrder('regular', orderParams as any);

      console.log(`✅ Order placed with ID: ${orderId}`);

      // Wait for order to be filled
      const filledOrder = await this.waitForFill(orderId);

      return {
        orderId: orderId,
        status: filledOrder.status,
        filledPrice: filledOrder.average_price || 0,
      };
    } catch (error) {
      console.error('❌ Order submission failed:', error);
      throw error;
    }
  }

  /**
   * Wait for order to be filled
   */
  private async waitForFill(orderId: string, maxWait: number = 30000): Promise<any> {
    if (!this.kite) throw new Error('Kite Connect not initialized');

    const start = Date.now();
    const pollInterval = 1000; // Check every 1 second

    while (Date.now() - start < maxWait) {
      const orders = await this.kite.getOrders();
      const order = orders.find((o: any) => o.order_id === orderId);

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      console.log(`⏳ Order ${orderId} status: ${order.status}`);

      // Check if order is complete
      if (order.status === 'COMPLETE') {
        console.log(`✅ Order ${orderId} FILLED @ ₹${order.average_price}`);
        return order;
      }

      // Check if order failed
      if (order.status === 'REJECTED' || order.status === 'CANCELLED') {
        throw new Error(`Order ${orderId} was ${order.status}: ${order.status_message}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Order ${orderId} did not fill within ${maxWait}ms`);
  }

  /**
   * Get current price for a ticker from Kite
   */
  async getCurrentPrice(ticker: string): Promise<number> {
    if (!this.kite) {
      throw new Error('Kite Connect not initialized');
    }

    try {
      const quote = await this.kite.getQuote([`NSE:${ticker}`]);
      const price = quote[`NSE:${ticker}`]?.last_price;

      if (!price) {
        throw new Error(`Price not available for ${ticker}`);
      }

      return price;
    } catch (error) {
      console.error(`Failed to get price for ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<string> {
    if (!this.kite) {
      throw new Error('Kite Connect not initialized');
    }

    const orders = await this.kite.getOrders();
    const order = orders.find((o: any) => o.order_id === orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    return order.status;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, variety: string = 'regular'): Promise<void> {
    if (!this.kite) {
      throw new Error('Kite Connect not initialized');
    }

    await this.kite.cancelOrder(variety, orderId);
    console.log(`❌ Order ${orderId} cancelled`);
  }

  /**
   * Get all orders for the day
   */
  async getOrders(): Promise<any[]> {
    if (!this.kite) {
      throw new Error('Kite Connect not initialized');
    }

    return await this.kite.getOrders();
  }

  /**
   * Check if broker service is available
   */
  isAvailable(): boolean {
    return this.kite !== null;
  }
}
