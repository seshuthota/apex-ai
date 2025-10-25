/**
 * Test Trading Cycle API
 * 
 * Manually trigger a trading cycle for testing purposes.
 * Uses mock services by default unless FORCE_REAL=true is passed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTradingEngine } from '@/lib/services';

export async function POST(request: NextRequest) {
  console.log('🧪 Manual trading cycle test triggered');

  try {
    const body = await request.json().catch(() => ({}));
    const forceReal = body.forceReal === true;

    // Override mock services if requested
    if (forceReal) {
      process.env.USE_MOCK_SERVICES = 'false';
    } else {
      process.env.USE_MOCK_SERVICES = 'true';
    }

    const engine = getTradingEngine();
    const result = await engine.executeTradingCycle();

    return NextResponse.json({
      success: result.success,
      mode: forceReal ? 'REAL' : 'MOCK',
      timestamp: new Date().toISOString(),
      result: {
        processed: result.processed,
        executed: result.executed,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('❌ Test trading cycle failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Test trading cycle failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
