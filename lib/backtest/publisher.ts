export interface EventPublisher {
  publish(type: string, payload: any): void;
  close?(): void;
}

export class ConsolePublisher implements EventPublisher {
  publish(type: string, payload: any): void {
    // eslint-disable-next-line no-console
    console.log(`[${type.toUpperCase()}]`, JSON.stringify(payload));
  }
  close() {}
}

export class SsePublisher implements EventPublisher {
  private write: (chunk: string) => void;
  private encoder = new TextEncoder();
  constructor(write: (chunk: string) => void) {
    this.write = write;
  }
  publish(type: string, payload: any): void {
    const data = JSON.stringify(payload);
    const chunk = `event: ${type}\n` + `data: ${data}\n\n`;
    this.write(chunk);
  }
  close() {
    this.write('event: end\n' + 'data: {}\n\n');
  }
}
