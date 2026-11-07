import { WebSocket } from 'ws';

/** Open a `/ws` client and resolve once it is connected. */
export function connect(port: number): Promise<WebSocket> {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.once('open', () => resolvePromise(ws));
    ws.once('error', reject);
  });
}

/** Collect every parsed message the socket receives into a live array. */
export function collect(ws: WebSocket): any[] {
  const messages: any[] = [];
  ws.on('message', (data: Buffer) => {
    try { messages.push(JSON.parse(data.toString())); } catch { /* ignore */ }
  });
  return messages;
}

export function send(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

/**
 * Every `/ws` client gets one `projects-update` push on connect
 * (`multi-server.ts:327-332`), before any test action. That push is baseline
 * noise for a zero/count message assertion. Drop it so a test asserts only the
 * messages its own action produced (retro P2).
 */
export function withoutConnectPush(messages: any[]): any[] {
  return messages.filter((m) => m?.type !== 'projects-update');
}
