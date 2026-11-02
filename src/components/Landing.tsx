import { motion } from 'framer-motion';
import { Atom, GitBranch, Play } from 'lucide-react';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { useMission } from '../store/missionStore';
import { STATUS } from './Chrome';

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const connection = useMission((s) => s.connection);
  const health = useMission((s) => s.health);
  const agents = useMission((s) => s.agents);
  const reduced = useReducedMotion();
  const status = STATUS[connection];
  const anim = (delay: number, x: number) =>
    reduced ? {} : { initial: { opacity: 0, x }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.8, delay } };

  const facts = [
    `API ${health ? `v${health.version} online` : connection === 'checking' ? 'connecting…' : 'unreachable'}`,
    `Providers: ${health?.live_providers.length ? health.live_providers.join(' → ') : 'none configured (simulator)'}`,
    `Auth mode: ${health?.auth_mode ?? '—'}`,
    `Agents registered: ${agents.length || '—'}`,
    'Pipeline: plan → parallel specialists → critic ⇄ rebuttal → judge → directive',
  ];

  return (
    <main className="landing-shell" id="main">
      <div className="grid-bg" aria-hidden="true" />
      <div className="landing-content-split">
        <motion.div className="landing-left" {...anim(0, -30)}>
          <div className="landing-badge">
            <Atom size={16} aria-hidden="true" /> <span>NEXUS DECISION SYSTEM</span>
          </div>
          <h1>NEXUS</h1>
          <p className="subtitle">Multi-agent strategy with adversarial review</p>
          <p className="tagline">
            Specialist agents analyse your mission in parallel, a critic attacks the plan, a judge scores the debate, and you get
            a directive with phases, KPIs, owned risks, and a confidence score that shows how it was computed.
          </p>
          <div className={`status-indicator ${status.cls}`} role="status">
            <span className={`status-dot ${status.cls}`} aria-hidden="true" /> {status.label}
          </div>
          <div className="landing-actions">
            <button className="primary" onClick={onEnter}>
              <Play size={18} aria-hidden="true" /> Open console
            </button>
            <a
              href="https://github.com/TEKURU-ZENO/Nexus-AI"
              target="_blank"
              rel="noreferrer noopener"
              className="secondary btn-link"
            >
              <GitBranch size={17} aria-hidden="true" /> Source code
            </a>
          </div>
        </motion.div>

        <motion.div className="landing-right" {...anim(0.2, 30)}>
          <div className="terminal-card">
            <div className="terminal-header">
              <div className="dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span>SYSTEM STATUS</span>
            </div>
            <ul className="terminal-logs">
              {facts.map((f) => (
                <li className="log-line" key={f}>
                  <span className="log-arrow" aria-hidden="true">
                    &gt;&gt;
                  </span>{' '}
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="tactical-specs">
            <div className="spec-item">
              <span>AGENTS</span>
              <b>{agents.length ? String(agents.length).padStart(2, '0') : '—'}</b>
            </div>
            <div className="spec-item">
              <span>TRANSPORT</span>
              <b>SSE · RESUMABLE</b>
            </div>
            <div className="spec-item">
              <span>ENGINE</span>
              <b>LANGGRAPH</b>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
