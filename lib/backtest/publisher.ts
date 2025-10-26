import { logger } from '@/lib/logging/logger';

export interface EventPublisher {
  publish(type: string, payload: unknown): void;
  close?(): void;
}

export class ConsolePublisher implements EventPublisher {
  private readonly log = logger.child({ source: 'publisher' });

  publish(type: string, payload: unknown): void {
    this.log.info(`event:${type}`, { payload });
  }

  close(): void {
    this.log.info('event:end');
  }
}

export class SsePublisher implements EventPublisher {
  private write: (chunk: string) => void;
  constructor(write: (chunk: string) => void) {
    this.write = write;
  }
  publish(type: string, payload: unknown): void {
    const data = JSON.stringify(payload);
    const chunk = `event: ${type}\n` + `data: ${data}\n\n`;
    this.write(chunk);
  }
  close(): void {
    this.write('event: end\n' + 'data: {}\n\n');
  }
}
