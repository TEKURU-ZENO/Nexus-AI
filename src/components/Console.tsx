import { Fragment, useState } from 'react';
import { Activity, GitBranch, Play, Radar, Square } from 'lucide-react';

import type { MissionMode } from '../api/client';
import { MISSION_MODES, PRESET_MISSIONS, STAGES, type AgentId } from '../lib/agents';
import { useMission } from '../store/missionStore';

export function MissionConsole({ onCompare }: { onCompare: () => void }) {
  const { mission, mode, running, history, setMission, setMode, start, cancel, open } = useMission();
  const [touched, setTouched] = useState(false);
  const tooShort = mission.trim().length < 10;

  return (
    <section className="panel mission-console" aria-labelledby="console-title">
      <div className="panel-title">
        <div id="console-title">
          <Radar size={16} aria-hidden="true" /> Command Interface
        </div>
        <span>{running ? 'run in progress' : 'ready'}</span>
      </div>

      <label htmlFor="mission-input">What strategic problem are you trying to solve?</label>
      <div className="command-bar-wrapper">
        <textarea
          id="mission-input"
          value={mission}
          maxLength={4000}
          onChange={(e) => setMission(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void start();
            }
          }}
          placeholder="E.g., Design a scalable multi-agent SaaS platform…"
          disabled={running}
          aria-invalid={touched && tooShort}
          aria-describedby="mission-help"
        />
        <div className="command-shortcut" id="mission-help">
          {touched && tooShort ? 'At least 10 characters' : 'Ctrl + Enter to run'}
        </div>
      </div>

      <div className="compact-modes" role="radiogroup" aria-label="Mission mode">
        {MISSION_MODES.map((item) => (
          <button
            key={item}
            role="radio"
            aria-checked={mode === item}
            className={mode === item ? 'selected' : ''}
            onClick={() => setMode(item as MissionMode)}
            disabled={running}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="chips-row">
        <span>Presets</span>
        <div className="chips-container">
          {PRESET_MISSIONS.map((item) => (
            <button key={item} onClick={() => setMission(item)} disabled={running} title={item}>
              {item.replace(/\.$/, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="command-actions">
        {running ? (
          <button className="primary-btn" onClick={() => void cancel()}>
            <Square size={14} aria-hidden="true" /> Cancel run
          </button>
        ) : (
          <button className="primary-btn" onClick={() => void start()} disabled={tooShort}>
            <Play size={14} aria-hidden="true" /> Initiate Operation
          </button>
        )}
        <button className="secondary-btn" onClick={onCompare} disabled={history.length < 2}>
          <GitBranch size={14} aria-hidden="true" /> Compare Plans
        </button>
      </div>

      <div className="history-strip">
        <span className="field-label" id="history-label">
          History
        </span>
        <div className="history-list" aria-labelledby="history-label">
          {history.length ? (
            history.slice(0, 5).map((run) => (
              <button className="history-item" key={run.id} onClick={() => void open(run.id)} disabled={running}>
                <span className={`history-status ${run.status}`}>{run.status}</span> {run.mode}: {run.mission}
              </button>
            ))
          ) : (
            <em className="muted-note">No prior runs in this workspace.</em>
          )}
        </div>
      </div>
    </section>
  );
}

const IDLE_TEXT: Partial<Record<AgentId, string>> = {
  orchestrator: 'Decomposes the mission into a plan.',
  researcher: 'Maps users, market, evidence and regulation.',
  architect: 'Designs the smallest trustworthy system.',
  strategist: 'Defines wedge, pricing and go-to-market.',
  critic: 'Attacks assumptions and demands proof.',
  synthesizer: 'Writes the decision directive.',
};

export function ReasoningFeed({ onAgentClick }: { onAgentClick: (agent: AgentId) => void }) {
  const view = useMission((s) => s.view);
  const running = useMission((s) => s.running);
  const agents = useMission((s) => s.agents);
  const nameOf = (id: AgentId) => agents.find((a) => a.id === id)?.name ?? id;

  return (
    <section className="panel reasoning-feed-panel" aria-labelledby="feed-title">
      <div className="panel-title">
        <div id="feed-title">
          <Activity size={16} aria-hidden="true" /> Agent Activity
        </div>
        <span>{running ? 'thinking' : view.complete ? 'complete' : 'idle'}</span>
      </div>
      <ul className="reasoning-list">
        {STAGES.map(({ id }) => {
          const active = view.activeAgent === id || (id === 'critic' && view.activeAgent === 'judge');
          const done = view.completed.has(id);
          return (
            <li key={id}>
              <button
                className={`reasoning-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                onClick={() => onAgentClick(id)}
                aria-describedby={`agent-hint-${id}`}
              >
                <div className="reasoning-header">
                  <span className="reasoning-dot" aria-hidden="true" />
                  <span className="reasoning-agent">{nameOf(id)}</span>
                  {done && <span className="reasoning-badge">done</span>}
                </div>
                <p className="reasoning-text">{view.latestByAgent[id] ?? IDLE_TEXT[id]}</p>
                <span className="sr-only" id={`agent-hint-${id}`}>
                  {done ? 'Complete. ' : active ? 'Working. ' : ''}Opens the structured trace.
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function StageBar() {
  const view = useMission((s) => s.view);
  return (
    <ol className="canvas-bar" aria-label="Run progress">
      {STAGES.map((stage, idx) => {
        const active = view.activeAgent === stage.id || (stage.id === 'critic' && view.activeAgent === 'judge');
        const done = view.completed.has(stage.id);
        return (
          <Fragment key={stage.id}>
            <li
              className={`canvas-node ${active ? 'active' : ''} ${done ? 'completed' : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span className="canvas-indicator" aria-hidden="true" />
              <span>{stage.label}</span>
            </li>
            {idx < STAGES.length - 1 && (
              <li className="canvas-arrow" aria-hidden="true">
                →
              </li>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
