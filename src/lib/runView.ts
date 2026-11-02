import type { RunEvent } from '../api/client';
import type { AgentId } from './agents';

export interface FeedLine {
  seq: number;
  agent: string;
  type: string;
  text: string;
}

export interface DebateLine {
  seq: number;
  speaker: 'Critic' | 'Team' | 'Judge';
  text: string;
  round: number;
}

export interface RunView {
  activeAgent: AgentId | null;
  completed: Set<AgentId>;
  feed: FeedLine[];
  debate: DebateLine[];
  latestByAgent: Partial<Record<AgentId, string>>;
  traces: Partial<Record<AgentId, unknown[]>>;
  safetyFlags: string[];
  degraded: string[];
  memoryRecalled: string[];
  complete: boolean;
  terminalStatus: string | null;
  lastSeq: number;
}

export const emptyView = (): RunView => ({
  activeAgent: null,
  completed: new Set(),
  feed: [],
  debate: [],
  latestByAgent: {},
  traces: {},
  safetyFlags: [],
  degraded: [],
  memoryRecalled: [],
  complete: false,
  terminalStatus: null,
  lastSeq: 0,
});

const FEED_LIMIT = 200;

function pushTrace(view: RunView, agent: AgentId, value: unknown): void {
  view.traces = { ...view.traces, [agent]: [...(view.traces[agent] ?? []), value] };
}

/** Pure reducer: derives the UI model from the event-sourced run log. */
export function applyEvent(prev: RunView, event: RunEvent): RunView {
  if (event.seq <= prev.lastSeq) return prev; // idempotent on replays
  const view: RunView = { ...prev, completed: new Set(prev.completed), lastSeq: event.seq };
  const agent = (event.agent ?? 'system') as AgentId;
  const data = (event.data ?? {}) as Record<string, unknown>;
  const round = typeof data.round === 'number' ? data.round : 1;

  if (event.message) {
    view.feed = [{ seq: event.seq, agent, type: event.type, text: event.message }, ...prev.feed].slice(0, FEED_LIMIT);
    view.latestByAgent = { ...prev.latestByAgent, [agent]: event.message };
  }

  switch (event.type) {
    case 'agent_start':
    case 'debate_start':
    case 'debate_round':
      view.activeAgent = agent;
      break;
    case 'agent_output':
      view.completed.add(agent);
      pushTrace(view, agent, data.plan ?? data.report);
      break;
    case 'critique':
      view.activeAgent = 'critic';
      pushTrace(view, 'critic', data.critique);
      view.debate = [...prev.debate, { seq: event.seq, speaker: 'Critic', text: event.message, round }];
      break;
    case 'rebuttal':
      pushTrace(view, 'strategist', data.rebuttal);
      view.debate = [...view.debate, { seq: event.seq, speaker: 'Team', text: event.message, round }];
      break;
    case 'verdict':
      view.activeAgent = 'judge';
      view.completed.add('critic');
      pushTrace(view, 'judge', data.verdict);
      view.debate = [...view.debate, { seq: event.seq, speaker: 'Judge', text: event.message, round }];
      break;
    case 'directive':
      view.completed.add('synthesizer');
      pushTrace(view, 'synthesizer', data.directive);
      break;
    case 'memory_recall':
      view.memoryRecalled = Array.isArray(data.memory) ? (data.memory as string[]) : [];
      break;
    case 'safety_flag':
      view.safetyFlags = [...prev.safetyFlags, String(data.flag ?? event.message)];
      break;
    case 'provider_degraded':
      view.degraded = [...prev.degraded, event.message];
      break;
    case 'run_complete':
      view.complete = true;
      view.activeAgent = null;
      view.terminalStatus = typeof data.status === 'string' ? data.status : 'succeeded';
      break;
  }
  return view;
}
