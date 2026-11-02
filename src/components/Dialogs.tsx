import { useEffect, useState } from 'react';

import { api, type RunDetail } from '../api/client';
import type { AgentId } from '../lib/agents';
import { useMission } from '../store/missionStore';
import { Modal } from './Modal';

export function TraceModal({ agent, onClose }: { agent: AgentId; onClose: () => void }) {
  const traces = useMission((s) => s.view.traces);
  const run = useMission((s) => s.run);
  const info = useMission((s) => s.agents.find((a) => a.id === agent));
  const fromResult: unknown =
    agent === 'orchestrator'
      ? run?.result?.plan
      : agent === 'critic'
        ? run?.result?.critiques
        : agent === 'synthesizer'
          ? run?.result?.directive
          : run?.result?.reports?.[agent];
  const trace = traces[agent]?.length ? traces[agent] : fromResult;
  return (
    <Modal title={`${info?.name ?? agent} — structured trace`} onClose={onClose}>
      {info && (
        <p className="muted-note">
          {info.description} Prompt version <code>{info.prompt_version}</code>.
        </p>
      )}
      <pre>{trace ? JSON.stringify(trace, null, 2) : 'No trace recorded for this agent yet. Run a mission first.'}</pre>
    </Modal>
  );
}

function Column({ run }: { run: RunDetail | null }) {
  if (!run) return <td>Loading…</td>;
  const d = run.result?.directive;
  return (
    <td>
      <p>
        <strong>{run.mode}</strong> · {run.status}
        {run.simulated ? ' · simulated' : ''}
      </p>
      <p className="conf-value">Confidence {run.confidence ?? '—'}</p>
      <p>{d?.decision ?? 'No directive'}</p>
      {d && (
        <>
          <small>Phases: {d.phases.map((p) => p.name).join(' → ')}</small>
          <br />
          <small>Top risk: {d.risks[0]?.risk}</small>
        </>
      )}
    </td>
  );
}

export function CompareModal({ onClose }: { onClose: () => void }) {
  const history = useMission((s) => s.history);
  const [left, setLeft] = useState(history[0]?.id ?? '');
  const [right, setRight] = useState(history[1]?.id ?? '');
  const [runs, setRuns] = useState<Record<string, RunDetail>>({});

  useEffect(() => {
    for (const id of [left, right]) {
      if (id && !runs[id]) void api.getRun(id).then((r) => setRuns((cur) => ({ ...cur, [id]: r })));
    }
  }, [left, right, runs]);

  return (
    <Modal title="Compare plans" onClose={onClose} wide>
      <div className="comparison-selectors">
        {(
          [
            ['Plan A', left, setLeft],
            ['Plan B', right, setRight],
          ] as const
        ).map(([label, value, setter]) => (
          <div key={label}>
            <label htmlFor={`cmp-${label}`}>{label}</label>
            <select id={`cmp-${label}`} value={value} onChange={(e) => setter(e.target.value)}>
              {history.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.mode}: {r.mission.slice(0, 50)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <table className="comparison-table">
        <thead>
          <tr>
            <th scope="col">Plan A</th>
            <th scope="col">Plan B</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Column run={runs[left] ?? null} />
            <Column run={runs[right] ?? null} />
          </tr>
        </tbody>
      </table>
    </Modal>
  );
}
