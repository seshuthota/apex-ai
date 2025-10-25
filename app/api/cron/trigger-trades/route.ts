/**
 * Cron API Route - Trigger Trading Cycle
 * 
 * This endpoint is called by Vercel Cron or external scheduler
 * to execute the trading cycle for all active models.
 * 
 * Security: Protected by CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTradingEngine } from '@/lib/services';

export async function GET(request: NextRequest) {
  console.log('🔔 Cron trigger received');

  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    console.warn('⚠️  Unauthorized cron attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const engine = getTradingEngine();
    const result = await engine.executeTradingCycle();

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      result: {
        processed: result.processed,
        executed: result.executed,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('❌ Trading cycle failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Trading cycle failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Allow up to 5 minutes execution time (Vercel Pro)
export const maxDuration = 300;

// Prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
