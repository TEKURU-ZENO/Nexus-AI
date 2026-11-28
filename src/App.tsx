import { lazy, Suspense, useEffect, useState } from 'react';

import { AblationModal, CompareModal, TraceModal } from './components/Dialogs';
import { MissionConsole, ReasoningFeed, StageBar } from './components/Console';
import { Sidebar, Toasts, Topbar } from './components/Chrome';
import { DirectiveView } from './components/Directive';
import { LandingPage } from './components/Landing';
import { RightPanel } from './components/Panels';
import { useReducedMotion } from './hooks/useReducedMotion';
import type { AgentId } from './lib/agents';
import { useMission } from './store/missionStore';

const Starfield = lazy(() => import('./components/Starfield'));

export default function App() {
  const bootstrap = useMission((s) => s.bootstrap);
  const reduced = useReducedMotion();
  const [view, setView] = useState<'landing' | 'console'>(() => (location.hash === '#console' ? 'console' : 'landing'));
  const [traceAgent, setTraceAgent] = useState<AgentId | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [ablationOpen, setAblationOpen] = useState(false);

  useEffect(() => {
    void bootstrap();
    const interval = window.setInterval(() => void bootstrap(), 60_000);
    return () => window.clearInterval(interval);
  }, [bootstrap]);

  useEffect(() => {
    const onHash = () => setView(location.hash === '#console' ? 'console' : 'landing');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const enter = () => {
    location.hash = 'console'; // keeps back/forward navigation working
  };

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {!reduced && (
        <Suspense fallback={null}>
          <Starfield />
        </Suspense>
      )}
      {view === 'landing' ? (
        <>
          <LandingPage onEnter={enter} onOpenAblation={() => setAblationOpen(true)} />
          {ablationOpen && <AblationModal onClose={() => setAblationOpen(false)} />}
        </>
      ) : (
        <div className="app-shell">
          <div className="grid-bg" aria-hidden="true" />
          <Topbar onOpenAblation={() => setAblationOpen(true)} />
          <Sidebar />
          <main className="workspace" id="main">
            <div className="left-column">
              <MissionConsole onCompare={() => setCompareOpen(true)} />
              <ReasoningFeed onAgentClick={setTraceAgent} />
            </div>
            <div className="center-column">
              <StageBar />
              <DirectiveView />
            </div>
            <div className="right-column">
              <RightPanel />
            </div>
          </main>
          {traceAgent && <TraceModal agent={traceAgent} onClose={() => setTraceAgent(null)} />}
          {compareOpen && <CompareModal onClose={() => setCompareOpen(false)} />}
          {ablationOpen && <AblationModal onClose={() => setAblationOpen(false)} />}
          <Toasts />
        </div>
      )}
    </>
  );
}
