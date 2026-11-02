import type { components } from './schema';

export type Schemas = components['schemas'];
export type RunDetail = Schemas['RunDetail'];
export type RunSummary = Schemas['RunSummary'];
export type RunCreate = Schemas['RunCreate'];
export type RunEvent = Schemas['RunEvent'];
export type Health = Schemas['HealthResponse'];
export type AgentInfo = Schemas['AgentInfo'];
export type MemoryItem = Schemas['MemoryItem'];
export type DecisionResponse = Schemas['DecisionResponse'];
export type MissionMode = Schemas['MissionMode'];
export type Directive = Schemas['Directive'];
export type Confidence = Schemas['ConfidenceBreakdown'];
export type AgentReport = Schemas['AgentReport'];
export type Critique = Schemas['Critique'];

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1';
const TOKEN_KEY = 'nexus.token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: token lives for this page only */
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { detail?: unknown };
      message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    const retry = Number(response.headers.get('Retry-After')) || undefined;
    throw new ApiError(response.status, message, retry);
  }
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('Content-Type') ?? '';
  return (type.includes('application/json') ? response.json() : response.text()) as Promise<T>;
}

export const api = {
  health: () => request<Health>('/health'),
  agents: () => request<AgentInfo[]>('/agents'),
  listRuns: (limit = 20) => request<RunSummary[]>(`/runs?limit=${limit}`),
  getRun: (id: string) => request<RunDetail>(`/runs/${encodeURIComponent(id)}`),
  createRun: (body: RunCreate) => request<RunDetail>('/runs', { method: 'POST', body: JSON.stringify(body) }),
  cancelRun: (id: string) => request<RunSummary>(`/runs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  decide: (id: string, status: 'accepted' | 'rejected' | 'challenged', note?: string) =>
    request<DecisionResponse>(`/runs/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ status, note: note || null }),
    }),
  exportMarkdown: (id: string) => request<string>(`/runs/${encodeURIComponent(id)}/export.md`),
  memory: () => request<MemoryItem[]>('/memory'),
  deleteMemory: (id: string) => request<void>(`/memory/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
