import { useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, DatabaseZap, Orbit, ShieldAlert, Terminal, Trash2 } from 'lucide-react';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { useMission } from '../store/missionStore';

const TABS = [
  { id: 'feed', label: 'Feed', icon: Terminal },
  { id: 'debate', label: 'Debate', icon: ShieldAlert },
  { id: 'memory', label: 'Memory', icon: DatabaseZap },
  { id: 'timeline', label: 'Timeline', icon: Orbit },
] as const;
type Tab = (typeof TABS)[number]['id'];

function LiveFeed() {
  const feed = useMission((s) => s.view.feed);
  const reduced = useReducedMotion();
  if (!feed.length) return <p className="empty-note">Events stream here while a run executes.</p>;
  return (
    <div className="terminal-feed" role="log" aria-live="polite" aria-relevant="additions" aria-label="Event feed" tabIndex={0}>
      <AnimatePresence initial={false}>
        {feed.map((line) => (
          <motion.div
            className={`terminal-line type-${line.type}`}
            key={line.seq}
            initial={reduced ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span>{line.agent}</span>
            <p>{line.text}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Debate() {
  const debate = useMission((s) => s.view.debate);
  const run = useMission((s) => s.run);
  const critique = run?.result?.critiques?.at(-1);
  if (!debate.length && !critique) return <p className="empty-note">The critic, team rebuttal and judge verdict appear here.</p>;
  return (
    <div className="debate-feed">
      {critique && (
        <div className="debate-bubble critic">
          <strong>Most dangerous assumption</strong>
          <p>{critique.most_dangerous_assumption}</p>
        </div>
      )}
      {critique?.challenges.map((c, i) => (
        <div className="debate-bubble critic" key={`c-${i}`}>
          <strong>
            Challenge → {c.target_agent} <span className={`risk ${c.severity}`}>{c.severity}</span>
          </strong>
          <p>{c.claim}</p>
          <small>Proof required: {c.proof_required}</small>
        </div>
      ))}
      {debate.map((line) => (
        <div className={`debate-bubble ${line.speaker === 'Critic' ? 'critic' : 'strategist'}`} key={line.seq}>
          <strong>
            {line.speaker} · round {line.round}
          </strong>
          <p>{line.text}</p>
        </div>
      ))}
    </div>
  );
}

function Memory() {
  const memory = useMission((s) => s.memory);
  const recalled = useMission((s) => s.view.memoryRecalled);
  const forget = useMission((s) => s.forgetMemory);
  return (
    <div className="memory-feed">
      {recalled.length > 0 && (
        <>
          <h3 className="panel-subtitle">Recalled for this run</h3>
          {recalled.map((m, i) => (
            <div className="memory-item recalled" key={`r-${i}`}>
              {m}
            </div>
          ))}
        </>
      )}
      <h3 className="panel-subtitle">Project memory (accepted decisions)</h3>
      {memory.length === 0 && <p className="empty-note">Nothing stored yet. Accepting a live run's decision commits it here.</p>}
      {memory.map((m) => (
        <div className="memory-item" key={m.id}>
          <span>{m.content}</span>
          <button className="icon-btn small" onClick={() => void forget(m.id)} aria-label="Delete this memory">
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Timeline() {
  const view = useMission((s) => s.view);
  const rows = [...view.feed]
    .reverse()
    .filter((l) => /start|round|verdict|directive|complete|blocked|degraded|flag/.test(l.type));
  if (!rows.length) return <p className="empty-note">Milestones of the run graph appear here.</p>;
  return (
    <ol className="timeline-feed-wrapper">
      {rows.map((row, i) => (
        <li className="timeline-row" key={row.seq}>
          <i className={i === rows.length - 1 && !view.complete ? 'hot' : ''} aria-hidden="true" />
          <div>
            <strong>{row.agent}</strong>
            <span>{row.text}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('feed');
  const flags = useMission((s) => s.view.safetyFlags);
  const degraded = useMission((s) => s.view.degraded);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const next = TABS[(i + step + TABS.length) % TABS.length].id;
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  return (
    <section className="right-panel panel" aria-label="Run details">
      {(flags.length > 0 || degraded.length > 0) && (
        <div className="alert-strip" role="status">
          <AlertTriangle size={14} aria-hidden="true" />
          {flags.length > 0 && <span>Safety flags: {flags.join(', ')}</span>}
          {degraded.length > 0 && <span>{degraded.at(-1)}</span>}
        </div>
      )}
      <div className="panel-tabs" role="tablist" aria-label="Run detail views">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`tabpanel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
            onKeyDown={onKey}
          >
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      <div className="tab-content" role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'feed' && <LiveFeed />}
        {tab === 'debate' && <Debate />}
        {tab === 'memory' && <Memory />}
        {tab === 'timeline' && <Timeline />}
      </div>
    </section>
  );
}
