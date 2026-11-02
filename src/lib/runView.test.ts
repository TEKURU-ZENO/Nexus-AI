import { describe, expect, it } from 'vitest';

import type { RunEvent } from '../api/client';
import { applyEvent, emptyView } from './runView';

const ev = (seq: number, type: string, agent: string, message = '', data: Record<string, unknown> | null = null): RunEvent => ({
  seq,
  type,
  agent,
  message,
  data,
  at: new Date(0).toISOString(),
});

describe('applyEvent', () => {
  it('tracks the active agent, completion and debate', () => {
    let v = emptyView();
    v = applyEvent(v, ev(1, 'agent_start', 'orchestrator', 'planning'));
    expect(v.activeAgent).toBe('orchestrator');
    v = applyEvent(v, ev(2, 'agent_output', 'orchestrator', 'plan ready', { plan: { objective: 'x' } }));
    expect(v.completed.has('orchestrator')).toBe(true);
    expect(v.traces.orchestrator).toHaveLength(1);
    v = applyEvent(v, ev(3, 'critique', 'critic', 'risky assumption', { round: 1 }));
    v = applyEvent(v, ev(4, 'rebuttal', 'strategist', 'conceded'));
    v = applyEvent(v, ev(5, 'verdict', 'judge', 'resolved'));
    expect(v.debate.map((d) => d.speaker)).toEqual(['Critic', 'Team', 'Judge']);
    expect(v.completed.has('critic')).toBe(true);
    v = applyEvent(v, ev(6, 'run_complete', 'orchestrator', 'done', { status: 'succeeded' }));
    expect(v.complete).toBe(true);
    expect(v.activeAgent).toBeNull();
    expect(v.terminalStatus).toBe('succeeded');
    expect(v.feed[0].seq).toBe(6);
  });

  it('is idempotent for replayed events (resume after reconnect)', () => {
    const once = applyEvent(emptyView(), ev(1, 'agent_start', 'researcher', 'go'));
    expect(applyEvent(once, ev(1, 'agent_start', 'researcher', 'go'))).toBe(once);
  });

  it('collects safety flags and provider degradation', () => {
    let v = applyEvent(emptyView(), ev(1, 'safety_flag', 'system', 'flag', { flag: 'injection:role_hijack' }));
    v = applyEvent(v, ev(2, 'provider_degraded', 'system', 'openai failed; answered by anthropic'));
    expect(v.safetyFlags).toEqual(['injection:role_hijack']);
    expect(v.degraded).toHaveLength(1);
  });
});
