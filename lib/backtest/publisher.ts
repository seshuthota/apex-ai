export interface EventPublisher {
  publish(type: string, payload: unknown): void;
  close?(): void;
}

export class ConsolePublisher implements EventPublisher {
  publish(type: string, payload: unknown): void {
    console.log(`[${type.toUpperCase()}]`, JSON.stringify(payload));
  }
  close() {}
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
  close() {
    this.write('event: end\n' + 'data: {}\n\n');
  }
}
