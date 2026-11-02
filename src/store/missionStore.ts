import { create } from 'zustand';

import {
  ApiError,
  api,
  type AgentInfo,
  type Health,
  type MemoryItem,
  type MissionMode,
  type RunDetail,
  type RunSummary,
} from '../api/client';
import { streamRun } from '../api/sse';
import { applyEvent, emptyView, type RunView } from '../lib/runView';
import { PRESET_MISSIONS } from '../lib/agents';

export type Connection = 'checking' | 'live' | 'simulation' | 'offline' | 'unauthorized';

interface MissionState {
  connection: Connection;
  health: Health | null;
  agents: AgentInfo[];
  mission: string;
  mode: MissionMode;
  history: RunSummary[];
  memory: MemoryItem[];
  run: RunDetail | null;
  view: RunView;
  running: boolean;
  error: string | null;
  notice: string | null;

  setMission: (mission: string) => void;
  setMode: (mode: MissionMode) => void;
  dismiss: () => void;
  bootstrap: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshMemory: () => Promise<void>;
  start: (opts?: { refinement?: string; parentRunId?: string }) => Promise<void>;
  open: (runId: string) => Promise<void>;
  cancel: () => Promise<void>;
  decide: (status: 'accepted' | 'rejected' | 'challenged', note?: string) => Promise<void>;
  forgetMemory: (id: string) => Promise<void>;
}

let controller: AbortController | null = null;

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return `Rate limit reached. Try again in ${error.retryAfter ?? 'a few'} seconds.`;
    if (error.status === 401) return 'Authentication required. Paste an access token to continue.';
    if (error.status === 402) return error.message;
    if (error.status === 422) return `Invalid input: ${error.message}`;
    return `${error.status}: ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Unexpected error';
}

export const useMission = create<MissionState>((set, get) => {
  /** Attach to a run's event stream and keep the view in sync until it completes. */
  async function follow(runId: string, replayFromStart: boolean): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    if (replayFromStart) set({ view: emptyView() });
    try {
      await streamRun(runId, {
        signal,
        after: get().view.lastSeq,
        onEvent: (event) => set((s) => ({ view: applyEvent(s.view, event) })),
      });
      if (signal.aborted) return;
      set({ run: await api.getRun(runId), running: false });
      void get().refreshHistory();
    } catch (error) {
      if (!signal.aborted) set({ running: false, error: describe(error) });
    }
  }

  return {
    connection: 'checking',
    health: null,
    agents: [],
    mission: PRESET_MISSIONS[0],
    mode: 'Strategic Planning',
    history: [],
    memory: [],
    run: null,
    view: emptyView(),
    running: false,
    error: null,
    notice: null,

    setMission: (mission) => set({ mission }),
    setMode: (mode) => set({ mode }),
    dismiss: () => set({ error: null, notice: null }),

    bootstrap: async () => {
      try {
        const [health, agents] = await Promise.all([api.health(), api.agents()]);
        set({ health, agents, connection: health.simulator_only ? 'simulation' : 'live' });
      } catch {
        set({ connection: 'offline' });
        return;
      }
      try {
        await Promise.all([get().refreshHistory(), get().refreshMemory()]);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) set({ connection: 'unauthorized' });
      }
    },

    refreshHistory: async () => set({ history: await api.listRuns(20) }),
    refreshMemory: async () => set({ memory: await api.memory() }),

    start: async (opts = {}) => {
      const { mission, mode, running } = get();
      if (running || mission.trim().length < 10) {
        if (!running) set({ error: 'Describe the mission in at least 10 characters.' });
        return;
      }
      set({ running: true, error: null, notice: null, run: null, view: emptyView() });
      try {
        const run = await api.createRun({
          mission: mission.trim(),
          mode,
          refinement: opts.refinement ?? null,
          parent_run_id: opts.parentRunId ?? null,
          project: 'default',
        });
        set({ run });
        await follow(run.id, true);
      } catch (error) {
        set({ running: false, error: describe(error) });
      }
    },

    open: async (runId) => {
      try {
        const run = await api.getRun(runId);
        const live = run.status === 'queued' || run.status === 'running';
        set({ run, mission: run.mission, mode: run.mode, running: live, error: null });
        await follow(runId, true);
      } catch (error) {
        set({ error: describe(error) });
      }
    },

    cancel: async () => {
      const { run } = get();
      if (!run) return;
      try {
        await api.cancelRun(run.id);
      } catch (error) {
        set({ error: describe(error) });
      }
    },

    decide: async (status, note) => {
      const { run } = get();
      if (!run) return;
      try {
        const result = await api.decide(run.id, status, note);
        set({ notice: result.detail, run: { ...run, decision_status: result.status } });
        void get().refreshMemory();
        if (result.challenge_run_id) {
          set({ running: true, run: null });
          await get().open(result.challenge_run_id);
        } else {
          void get().refreshHistory();
        }
      } catch (error) {
        set({ error: describe(error) });
      }
    },

    forgetMemory: async (id) => {
      try {
        await api.deleteMemory(id);
        await get().refreshMemory();
      } catch (error) {
        set({ error: describe(error) });
      }
    },
  };
});
