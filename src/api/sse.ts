import { API_BASE, ApiError, authHeaders, type RunEvent } from './client';

export interface StreamOptions {
  signal: AbortSignal;
  onEvent: (event: RunEvent) => void;
  /** Resume after this sequence number (Last-Event-ID). */
  after?: number;
  maxRetries?: number;
}

/** Parse one SSE frame ("id:", "event:", "data:" lines). Exported for tests. */
export function parseFrame(frame: string): { id?: number; data?: string } {
  let id: number | undefined;
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('id:')) id = Number(line.slice(3).trim());
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  return { id, data: data.length ? data.join('\n') : undefined };
}

/**
 * Fetch-based SSE client (EventSource cannot send Authorization headers).
 * Reconnects with exponential backoff and resumes from the last sequence number seen.
 * Resolves when the run completes or the signal aborts.
 */
export async function streamRun(runId: string, opts: StreamOptions): Promise<void> {
  let last = opts.after ?? 0;
  let attempt = 0;
  const maxRetries = opts.maxRetries ?? 5;

  while (!opts.signal.aborted) {
    try {
      const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/events`, {
        headers: { Accept: 'text/event-stream', 'Last-Event-ID': String(last), ...authHeaders() },
        signal: opts.signal,
      });
      if (!response.ok || !response.body) throw new ApiError(response.status, 'event stream unavailable');
      attempt = 0;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const { id, data } = parseFrame(frame);
          if (!data) continue;
          let event: RunEvent;
          try {
            event = JSON.parse(data) as RunEvent;
          } catch {
            continue; // never let one malformed frame kill the stream
          }
          if (id !== undefined && id <= last) continue;
          if (id !== undefined) last = id;
          opts.onEvent(event);
          if (event.type === 'run_complete') return;
        }
      }
      return; // server closed the stream after a terminal event
    } catch (error) {
      if (opts.signal.aborted) return;
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error;
      if (++attempt > maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 500 * 2 ** attempt)));
    }
  }
}
