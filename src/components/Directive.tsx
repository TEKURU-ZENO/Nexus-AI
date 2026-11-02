import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Download, Sparkles } from 'lucide-react';

import { api, type Confidence, type RunDetail } from '../api/client';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useMission } from '../store/missionStore';

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConfidenceMeter({ confidence }: { confidence: Confidence }) {
  const parts = [
    { label: 'Claim confidence', value: confidence.finding_confidence },
    { label: 'External grounding', value: confidence.evidence_coverage },
    { label: 'Post-debate agreement', value: confidence.agreement },
    { label: 'Critic severity (penalty)', value: confidence.critic_penalty, inverse: true },
  ];
  return (
    <details className="confidence-meter">
      <summary>
        <span className="confidence-score">
          <span className="sr-only">Confidence </span>
          {confidence.score}
          <small>/100</small>
        </span>
        <span className="confidence-why">How is this computed?</span>
      </summary>
      <ul>
        {parts.map((p) => (
          <li key={p.label}>
            <span>{p.label}</span>
            <meter
              min={0}
              max={1}
              value={p.value}
              low={p.inverse ? undefined : 0.4}
              high={p.inverse ? 0.5 : 0.7}
              optimum={p.inverse ? 0 : 1}
            />
            <b>{Math.round(p.value * 100)}%</b>
          </li>
        ))}
      </ul>
      <p className="muted-note">{confidence.explanation}</p>
    </details>
  );
}

function RunMeta({ run }: { run: RunDetail }) {
  const seconds =
    run.finished_at && run.created_at ? (new Date(run.finished_at).getTime() - new Date(run.created_at).getTime()) / 1000 : null;
  return (
    <div className="sheet-metadata">
      <div>RUN {run.id.slice(0, 8)}</div>
      <div>{run.providers?.length ? run.providers.join(', ') : 'simulator'}</div>
      <div>{run.usage.input_tokens + run.usage.output_tokens} tokens</div>
      <div>${run.usage.cost_usd.toFixed(4)}</div>
      {seconds !== null && <div>{seconds.toFixed(1)}s</div>}
    </div>
  );
}

function EmptyState() {
  const running = useMission((s) => s.running);
  const reduced = useReducedMotion();
  return (
    <section className="output-workspace panel" aria-live="polite">
      <div className="panel-title">
        <div>
          <Sparkles size={16} aria-hidden="true" /> Decision Directive
        </div>
        <span>{running ? 'compiling' : 'awaiting mission'}</span>
      </div>
      <div className="empty-state">
        {running ? (
          <div className="compiling">
            <div className="blinking-log">AGENTS DELIBERATING…</div>
            <div className="progress-track">
              <motion.div
                className="progress-bar"
                animate={reduced ? undefined : { x: [-40, 120] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>
        ) : (
          'Describe a mission and run it to produce a debated, evidence-scored directive.'
        )}
      </div>
    </section>
  );
}

export function DirectiveView() {
  const run = useMission((s) => s.run);
  const running = useMission((s) => s.running);
  const decide = useMission((s) => s.decide);
  const start = useMission((s) => s.start);
  const [refinement, setRefinement] = useState('');
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const directive = run?.result?.directive;
  if (!run || !directive || running) {
    if (run && !running && run.status !== 'succeeded') {
      return (
        <section className="output-workspace panel" role="alert">
          <div className="panel-title">
            <div>
              <AlertTriangle size={16} aria-hidden="true" /> Run {run.status}
            </div>
          </div>
          <div className="empty-state">{run.error ?? 'No directive was produced.'}</div>
        </section>
      );
    }
    return <EmptyState />;
  }

  const confidence = run.result?.confidence;
  const sources = Array.from(
    new Map(
      Object.values(run.result?.reports ?? {})
        .flatMap((r) => r.findings.flatMap((f) => f.evidence ?? []))
        .filter((e) => !!e.url)
        .map((e) => [e.url, e] as const),
    ).values(),
  );
  const decided = run.decision_status !== 'pending';

  const exportMd = async () => {
    downloadText(`nexus-directive-${run.id.slice(0, 8)}.md`, await api.exportMarkdown(run.id));
  };
  const refine = () => {
    if (!refinement.trim()) return;
    void start({ refinement: refinement.trim(), parentRunId: run.id });
    setRefinement('');
  };

  return (
    <section className="output-workspace" aria-labelledby="directive-title">
      <article className="sheet">
        <header className="sheet-header">
          <div className="sheet-title-row">
            <h2 className="sheet-title" id="directive-title">
              {directive.title}
            </h2>
            <button className="secondary-btn compact" onClick={() => void exportMd()}>
              <Download size={12} aria-hidden="true" /> Export (.md)
            </button>
          </div>
          <RunMeta run={run} />
        </header>

        {run.simulated && (
          <div className="simulated-banner" role="note">
            <AlertTriangle size={14} aria-hidden="true" /> Simulated output: no LLM provider answered this run. Template-grade
            content, confidence capped, never stored in memory.
          </div>
        )}
        {run.refinement && (
          <p className="refinement-note">
            <strong>Refinement:</strong> {run.refinement}
          </p>
        )}

        <div className={`decision-banner ${run.decision_status}`}>
          <div className="decision-title-row">
            <span className="decision-label">RECOMMENDED DECISION</span>
            {confidence && <ConfidenceMeter confidence={confidence} />}
          </div>
          <p className="decision-text">{directive.decision}</p>
          <p className="decision-rationale">
            <strong>Rationale:</strong> {directive.rationale}
          </p>
          {decided ? (
            <span className={`decision-status-tag ${run.decision_status}`}>Decision {run.decision_status}</span>
          ) : (
            <div className="decision-actions">
              <button className="btn-accept" onClick={() => void decide('accepted')}>
                Accept
              </button>
              <button className="btn-challenge" onClick={() => void decide('challenged')}>
                Challenge
              </button>
              <button className="btn-reject" onClick={() => void decide('rejected')}>
                Reject
              </button>
            </div>
          )}
        </div>

        <div className="document-body">
          <section className="doc-section">
            <h3>Tradeoffs</h3>
            <ul>
              {directive.tradeoffs.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>

          <section className="doc-section">
            <h3>Execution plan</h3>
            <ol className="phase-list">
              {directive.phases.map((p, i) => (
                <li key={i} className="phase">
                  <strong>
                    Phase {i + 1}: {p.name}
                  </strong>
                  <p>{p.goal}</p>
                  <ul>
                    {p.actions.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                  <small>Exit criteria: {p.exit_criteria}</small>
                </li>
              ))}
            </ol>
          </section>

          <section className="doc-section">
            <h3>KPIs</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">KPI</th>
                  <th scope="col">Target</th>
                  <th scope="col">Measurement</th>
                </tr>
              </thead>
              <tbody>
                {directive.kpis.map((k, i) => (
                  <tr key={i}>
                    <td>{k.name}</td>
                    <td>{k.target}</td>
                    <td>{k.measurement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="doc-section">
            <h3>Risks</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Risk</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Mitigation</th>
                </tr>
              </thead>
              <tbody>
                {directive.risks.map((r, i) => (
                  <tr key={i}>
                    <td>{r.risk}</td>
                    <td>
                      <span className={`risk ${r.severity}`}>{r.severity}</span>
                    </td>
                    <td>{r.owner}</td>
                    <td>{r.mitigation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="doc-section">
            <h3>Next actions</h3>
            <ul className="task-list">
              {directive.next_actions.map((task, idx) => (
                <li key={idx}>
                  <label className={`task-item ${checked[idx] ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!checked[idx]}
                      onChange={() => setChecked((c) => ({ ...c, [idx]: !c[idx] }))}
                    />
                    <span className={`task-checkbox ${checked[idx] ? 'checked' : ''}`} aria-hidden="true">
                      {checked[idx] && <Check size={10} />}
                    </span>
                    <span>{task}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {sources.length > 0 && (
            <section className="doc-section">
              <h3>Sources</h3>
              <ul className="sources">
                {sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url ?? '#'} target="_blank" rel="noreferrer noopener">
                      {s.source_title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <form
          className="refine-bar"
          onSubmit={(e) => {
            e.preventDefault();
            refine();
          }}
        >
          <label htmlFor="refine-input" className="sr-only">
            Refinement constraint
          </label>
          <input
            id="refine-input"
            type="text"
            maxLength={1000}
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            placeholder="Add a constraint and re-run (e.g. budget under €20k, launch in 8 weeks)…"
          />
          <button className="secondary-btn" type="submit" disabled={!refinement.trim()}>
            Refine plan
          </button>
        </form>
      </article>
    </section>
  );
}
