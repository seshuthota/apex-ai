export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { SsePublisher } from '@/lib/backtest/publisher';
import { runBacktestLive } from '@/lib/backtest/runner';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || '2025-09-01';
  const endDate = searchParams.get('endDate') || '2025-09-30';
  const intervalMinutes = parseInt(searchParams.get('intervalMinutes') || '1440', 10);
  const enriched = (searchParams.get('enriched') ?? 'true') === 'true';
  const useTools = (searchParams.get('useTools') ?? 'true') === 'true';

  process.env.BACKTEST_ENRICHED_MARKET_DATA = enriched ? 'true' : 'false';
  process.env.BACKTEST_USE_ANALYSIS_TOOLS = useTools ? 'true' : 'false';

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const publisher = new SsePublisher(write);
      const abort = req.signal;
      // Initial SSE preamble and retry
      write(': connected\n\n');
      write('retry: 3000\n\n');
      const heartbeat = setInterval(() => write(': ping\n\n'), 15000);

      let runId: string | null = null;

      (async () => {
        try {
          runId = await runBacktestLive(
            { startDate, endDate, intervalMinutes, enriched, useTools },
            publisher,
            {
              signal: req.signal,
              onRunCreated: (id) => {
                runId = id;
              },
            },
          );
          publisher.close?.();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          publisher.publish('error', { runId, message });
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      })();

      abort.addEventListener('abort', () => {
        publisher.publish('error', { runId, message: 'Client disconnected' });
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
