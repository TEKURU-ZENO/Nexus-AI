import { useEffect, useState } from 'react';

import { api, type RunDetail } from '../api/client';
import { ablationCategories, ablationHeadline, goldenMissionAblations } from '../lib/ablation';
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

export function AblationModal({ onClose }: { onClose: () => void }) {
  const [selectedMissionId, setSelectedMissionId] = useState(goldenMissionAblations[0]?.id ?? 'g001');
  const activeMission = goldenMissionAblations.find((m) => m.id === selectedMissionId) ?? goldenMissionAblations[0];

  return (
    <Modal title="Golden Mission Ablation Study" onClose={onClose} wide>
      <p className="muted-note" style={{ margin: '-4px 0 12px 0' }}>
        Empirical evaluation: Multi-Agent Debate Council vs. Single-Agent Frontier Baseline (GPT-4o Solo CoT).
      </p>

      {/* Summary Metric Strip */}
      <div className="ablation-summary-strip">
        <div className="ablation-stat-box">
          <div className="num">{ablationHeadline.headlineNumber}</div>
          <div className="lbl">Ablation Delta</div>
        </div>
        <div className="ablation-stat-box">
          <div className="num">
            {ablationHeadline.councilAvg}{' '}
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>vs {ablationHeadline.singleAgentAvg}</span>
          </div>
          <div className="lbl">Decision Validity</div>
        </div>
        <div className="ablation-stat-box">
          <div className="num">{ablationHeadline.blindspotMultiplier}</div>
          <div className="lbl">Fewer Blindspots</div>
        </div>
        <div className="ablation-stat-box">
          <div className="num">{ablationHeadline.winRate}</div>
          <div className="lbl">Council Win Rate (47/50)</div>
        </div>
      </div>

      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#dddddd', lineHeight: '1.45' }}>
        {ablationHeadline.summary}
      </p>

      {/* Mission Selector Tabs */}
      <div className="ablation-mission-selector">
        {goldenMissionAblations.map((m) => (
          <button
            key={m.id}
            type="button"
            className={selectedMissionId === m.id ? 'active' : ''}
            onClick={() => setSelectedMissionId(m.id)}
          >
            {m.domain}
          </button>
        ))}
      </div>

      {activeMission && (
        <>
          <div style={{ marginBottom: '10px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#ffffff' }}>{activeMission.title}</h3>
            <span style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'monospace' }}>
              Domain: {activeMission.domain} &bull; Measured Delta: {activeMission.council.ablationDelta}
            </span>
          </div>

          <div className="ablation-side-by-side">
            {/* Single Agent Column */}
            <div className="ablation-card single">
              <div className="ablation-card-title">
                <span>{activeMission.singleAgent.model}</span>
                <span>Score: {activeMission.singleAgent.score}%</span>
              </div>
              <div>
                <strong
                  style={{
                    fontSize: '9px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                  }}
                >
                  Ablated Decision:
                </strong>
                <p
                  style={{
                    margin: '3px 0 8px 0',
                    fontSize: '11px',
                    color: '#dddddd',
                    fontStyle: 'italic',
                    lineHeight: '1.35',
                  }}
                >
                  &ldquo;{activeMission.singleAgent.decision}&rdquo;
                </p>
              </div>
              <div>
                <strong
                  style={{
                    fontSize: '9px',
                    color: 'var(--danger)',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                  }}
                >
                  Critical Blindspots Missed:
                </strong>
                {activeMission.singleAgent.flawsMissed.map((flaw, idx) => (
                  <div className="ablation-flaw-item" key={idx}>
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>&times;</span>
                    <span>{flaw}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(235, 87, 87, 0.2)', paddingTop: '6px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Failure Impact:{' '}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: '600' }}>
                  {activeMission.singleAgent.verdict}
                </span>
              </div>
            </div>

            {/* NEXUS Debate Council Column */}
            <div className="ablation-card council">
              <div className="ablation-card-title">
                <span>{activeMission.council.model}</span>
                <span>Score: {activeMission.council.score}%</span>
              </div>
              <div>
                <strong
                  style={{
                    fontSize: '9px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                  }}
                >
                  Debate-Hardened Decision:
                </strong>
                <p
                  style={{
                    margin: '3px 0 8px 0',
                    fontSize: '11px',
                    color: '#ffffff',
                    fontWeight: '500',
                    lineHeight: '1.35',
                  }}
                >
                  &ldquo;{activeMission.council.decision}&rdquo;
                </p>
              </div>
              <div>
                <strong
                  style={{
                    fontSize: '9px',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                  }}
                >
                  Flaws Caught by Debate Council:
                </strong>
                {activeMission.council.flawsCaught.map((caught, idx) => (
                  <div className="ablation-flaw-item" key={idx}>
                    <span style={{ color: '#27ae60', fontWeight: 'bold' }}>&#10003;</span>
                    <span>{caught}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(47, 128, 237, 0.2)', paddingTop: '6px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Council Verdict:{' '}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '600' }}>
                  {activeMission.council.verdict}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Categorical Breakdown Table */}
      <h4
        style={{
          margin: '14px 0 6px 0',
          fontSize: '10px',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          letterSpacing: '0.5px',
          fontFamily: 'monospace',
        }}
      >
        50 Golden Missions: Categorical Ablation Breakdown
      </h4>
      <table className="ablation-table">
        <thead>
          <tr>
            <th scope="col">Evaluation Dimension</th>
            <th scope="col">Single Agent (CoT)</th>
            <th scope="col">Debate Council</th>
            <th scope="col">Measured Advantage</th>
          </tr>
        </thead>
        <tbody>
          {ablationCategories.map((cat) => (
            <tr key={cat.category}>
              <td>
                <strong>{cat.category}</strong>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cat.description}</div>
              </td>
              <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{cat.singleAgent}%</td>
              <td style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: '600' }}>{cat.council}%</td>
              <td className="delta">{cat.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
