import { useState } from 'react';
import { Atom, DatabaseZap, GitBranch, KeyRound, Network, Radar, ShieldAlert } from 'lucide-react';

import { setToken } from '../api/client';
import { useMission, type Connection } from '../store/missionStore';

export const STATUS: Record<Connection, { label: string; cls: string }> = {
  live: { label: 'Live providers', cls: 'live' },
  simulation: { label: 'Simulator mode (no API keys)', cls: 'sim' },
  offline: { label: 'API offline', cls: 'offline' },
  unauthorized: { label: 'Sign-in required', cls: 'offline' },
  checking: { label: 'Connecting…', cls: '' },
};

export function StatusPill() {
  const connection = useMission((s) => s.connection);
  const health = useMission((s) => s.health);
  const providers = health?.live_providers ?? [];
  const status = STATUS[connection];
  return (
    <div className={`status-pill ${status.cls}`} role="status" aria-live="polite">
      <span className={`status-dot ${status.cls}`} aria-hidden="true" />
      {status.label}
      {connection === 'live' && providers.length > 0 && <span className="status-detail">· {providers.join(' → ')}</span>}
    </div>
  );
}

function TokenButton() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const bootstrap = useMission((s) => s.bootstrap);
  if (!open) {
    return (
      <button className="icon-btn" aria-label="Set access token" title="Set access token" onClick={() => setOpen(true)}>
        <KeyRound size={18} aria-hidden="true" />
      </button>
    );
  }
  return (
    <form
      className="token-form"
      onSubmit={(e) => {
        e.preventDefault();
        setToken(value.trim() || null);
        setOpen(false);
        void bootstrap();
      }}
    >
      <label htmlFor="token-input" className="sr-only">
        Bearer access token
      </label>
      <input
        id="token-input"
        type="password"
        autoComplete="off"
        placeholder="Paste bearer token"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button className="secondary-btn" type="submit">
        Save
      </button>
    </form>
  );
}

export function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <Atom size={16} />
        </div>
        <div>
          <h1>NEXUS</h1>
          <span>multi-agent strategic decision system</span>
        </div>
      </div>
      <div className="top-actions">
        <StatusPill />
        <TokenButton />
      </div>
    </header>
  );
}

export function Sidebar() {
  const items = [
    ['Command Console', Radar],
    ['Agent Mesh', Network],
    ['Run Graph', GitBranch],
    ['Memory', DatabaseZap],
    ['Governance', ShieldAlert],
  ] as const;
  return (
    <nav className="sidebar" aria-label="Sections">
      {items.map(([label, Icon], index) => (
        <span
          className={index === 0 ? 'side-item active' : 'side-item'}
          key={label}
          data-tooltip={label}
          aria-current={index === 0 ? 'page' : undefined}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </span>
      ))}
    </nav>
  );
}

export function Toasts() {
  const error = useMission((s) => s.error);
  const notice = useMission((s) => s.notice);
  const dismiss = useMission((s) => s.dismiss);
  if (!error && !notice) return null;
  return (
    <div className={`toast ${error ? 'error' : 'info'}`} role={error ? 'alert' : 'status'}>
      <span>{error ?? notice}</span>
      <button className="toast-close" onClick={dismiss} aria-label="Dismiss message">
        ×
      </button>
    </div>
  );
}
