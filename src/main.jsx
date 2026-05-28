import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Atom,
  BrainCircuit,
  CircuitBoard,
  DatabaseZap,
  Eye,
  FileSearch,
  GitBranch,
  Lock,
  Network,
  Orbit,
  Pause,
  Play,
  Radar,
  Rocket,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap
} from 'lucide-react';
import * as THREE from 'three';
import './styles.css';

const agents = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    role: 'Mission control',
    icon: BrainCircuit,
    color: '#7df9ff',
    tone: 'coordinates task decomposition, routing, and synthesis'
  },
  {
    id: 'researcher',
    name: 'Researcher',
    role: 'Signal discovery',
    icon: FileSearch,
    color: '#b6ff6a',
    tone: 'maps markets, competitors, evidence, and edge cases'
  },
  {
    id: 'architect',
    name: 'Architect',
    role: 'System design',
    icon: CircuitBoard,
    color: '#ffcc66',
    tone: 'turns ideas into flows, interfaces, APIs, and infra'
  },
  {
    id: 'strategist',
    name: 'Strategist',
    role: 'Growth logic',
    icon: Rocket,
    color: '#ff7ad9',
    tone: 'models positioning, monetization, GTM, and scale'
  },
  {
    id: 'critic',
    name: 'Critic',
    role: 'Threat analysis',
    icon: ShieldAlert,
    color: '#ff5b6e',
    tone: 'attacks weak assumptions and failure modes'
  },
  {
    id: 'memory',
    name: 'Memory Agent',
    role: 'Context fabric',
    icon: DatabaseZap,
    color: '#9c8cff',
    tone: 'stores durable conclusions and recalls project history'
  }
];

const demoMissions = [
  'Design an AI-native healthcare platform for reducing diagnostic errors.',
  'Build a response strategy for an enterprise ransomware attack.',
  'Create a sustainable AI-driven public transportation model for megacities.',
  'Launch an AI education copilot for rural schools.'
];

const missionModes = [
  'Strategic Planning',
  'Startup Validation',
  'Technical Architecture',
  'Risk Analysis',
  'Product Roadmapping'
];

const bootLines = [
  'NEXUS COGNITIVE KERNEL ONLINE',
  'SYNCHRONIZING AGENT MESH',
  'MEMORY FABRIC INDEXED',
  'DEBATE ENGINE ARMED',
  'TACTICAL GRAPH RENDERER ACTIVE',
  'AWAITING MISSION VECTOR'
];

const demoPrelude = [
  'NEXUS STRATEGIC CORE INITIALIZED',
  'SYNCHRONIZING SPECIALIST AGENTS',
  'MISSION MODE: STRATEGIC PLANNING',
  'HEALTHCARE ERROR REDUCTION WORKFLOW LOCKED',
  'COLLABORATIVE STRATEGIC COGNITION ONLINE'
];

const stageTemplates = [
  { agent: 'orchestrator', text: 'Decomposing mission into research, strategy, architecture, critique, and memory tracks.' },
  { agent: 'researcher', text: 'Scanning competitor patterns, market timing, adoption constraints, and regulatory shadows.' },
  { agent: 'architect', text: 'Drafting product flows, system surfaces, data pathways, and operator controls.' },
  { agent: 'strategist', text: 'Estimating wedge, buyer urgency, monetization, retention loops, and launch sequence.' },
  { agent: 'critic', text: 'Stress testing assumptions for weak evidence, brittle economics, and trust failures.' },
  { agent: 'memory', text: 'Compressing durable findings into project memory and preference traces.' },
  { agent: 'critic', text: 'Opening debate: core risk is overclaiming intelligence before clinical or user proof exists.' },
  { agent: 'strategist', text: 'Rebuttal: position as decision support first, then earn higher autonomy with measured outcomes.' },
  { agent: 'orchestrator', text: 'Resolving debate into phased execution plan with confidence-weighted decisions.' }
];

function missionKeywords(mission) {
  const words = mission
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 8);
  const fallback = ['mission', 'market', 'product', 'risk', 'memory', 'launch'];
  return [...new Set(words.length ? words : fallback)];
}

function buildReport(mission) {
  const lower = mission.toLowerCase();
  const domain = lower.includes('medical') || lower.includes('hospital')
    ? 'clinical decision support'
    : lower.includes('fitness')
      ? 'adaptive health wearables'
      : lower.includes('cyber')
        ? 'autonomous security operations'
        : lower.includes('education')
          ? 'personalized learning infrastructure'
          : 'AI-native operations';

  return {
    title: 'Unified Strategic Directive',
    confidence: Math.floor(84 + Math.random() * 10),
    sections: [
      {
        label: 'Wedge',
        text: `Start with a narrow ${domain} workflow where urgency is high, outcomes are visible, and users already feel the cost of poor coordination.`,
        risk: 'Medium',
        recommendation: 'Choose one measurable pilot workflow before expanding the platform narrative.'
      },
      {
        label: 'Product',
        text: 'Ship a mission console: intake, agent analysis, evidence trail, risk panel, decision lock, and exportable operating plan.',
        risk: 'Low',
        recommendation: 'Make the operator review loop the product center of gravity.'
      },
      {
        label: 'GTM',
        text: 'Land with founder-led pilots, convert proof into case studies, then expand through templates, integrations, and recurring intelligence reviews.',
        risk: 'Medium',
        recommendation: 'Sell outcomes and review speed, not autonomy.'
      },
      {
        label: 'Threats',
        text: 'Primary risks are trust, data quality, buyer inertia, hallucinated certainty, and competitors copying the surface-level interface.',
        risk: 'High',
        recommendation: 'Expose uncertainty, audit trails, and explicit human decision locks.'
      }
    ]
  };
}

function useMissionEngine() {
  const [mission, setMission] = useState(demoMissions[0]);
  const [mode, setMode] = useState(missionModes[0]);
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState(bootLines.map((line, index) => ({ id: `boot-${index}`, agent: 'system', text: line })));
  const [events, setEvents] = useState([]);
  const [debate, setDebate] = useState([
    { agent: 'Critic', text: 'The strongest failure mode is false confidence: the system could look authoritative before it earns trust.' },
    { agent: 'Strategist', text: 'Counter: frame early deployments as supervised intelligence with measurable review loops and locked decisions.' }
  ]);
  const [memory, setMemory] = useState([
    'Preference: cinematic, tactical interfaces outperform plain dashboards.',
    'Principle: visible intelligence matters more than hidden complexity.',
    'Constraint: keep MVP scope focused through day 3, polish after.'
  ]);
  const [report, setReport] = useState(buildReport(demoMissions[0]));
  const [activeAgent, setActiveAgent] = useState('orchestrator');
  const [graphPulse, setGraphPulse] = useState(0);
  const [sessions, setSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('nexus.sessions') || '[]');
    } catch {
      return [];
    }
  });
  const [connectionState, setConnectionState] = useState('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          if (data.openai_enabled) {
            setConnectionState('live');
          } else {
            setConnectionState('simulation');
          }
        } else {
          setConnectionState('simulation');
        }
      } catch {
        setConnectionState('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const persistSession = (nextReport, nextDebate = debate, sessionMission = mission, sessionMode = mode) => {
    const session = {
      id: crypto.randomUUID(),
      mission: sessionMission,
      mode: sessionMode,
      report: nextReport,
      debate: nextDebate.slice(0, 4),
      createdAt: new Date().toISOString()
    };
    setSessions((current) => {
      const next = [session, ...current].slice(0, 6);
      localStorage.setItem('nexus.sessions', JSON.stringify(next));
      return next;
    });
  };

  const loadSession = (session) => {
    setMission(session.mission);
    setMode(session.mode || missionModes[0]);
    setReport(session.report);
    setDebate(session.debate?.length ? session.debate : debate);
    setFeed([
      { id: crypto.randomUUID(), agent: 'memory', text: `Session reopened: ${session.mission}` },
      { id: crypto.randomUUID(), agent: 'orchestrator', text: `${session.mode || 'Strategic Planning'} directive restored from mission history.` },
      ...bootLines.slice(0, 3).map((line, index) => ({ id: `restore-${index}`, agent: 'system', text: line }))
    ]);
    setEvents([]);
    setActiveAgent('memory');
    setGraphPulse((value) => value + 1);
  };

  const appendFeed = (agent, text) => {
    setFeed((current) => [
      { id: crypto.randomUUID(), agent, text },
      ...current
    ].slice(0, 18));
  };

  const markEvent = (agent, label) => {
    setEvents((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        agent,
        label
      }
    ]);
    setGraphPulse((value) => value + 1);
  };

  const runLocalMission = (targetMission, targetMode) => {
    stageTemplates.forEach((stage, index) => {
      window.setTimeout(() => {
        setActiveAgent(stage.agent);
        appendFeed(stage.agent, stage.text);
        markEvent(stage.agent, stage.text.split(':')[0]);
      }, 650 + index * 1050);
    });

    window.setTimeout(() => {
      const nextReport = buildReport(targetMission);
      setReport(nextReport);
      setMemory((current) => [
        `Mission: ${targetMission} | Outcome: ${nextReport.sections[0].text}`,
        ...current
      ].slice(0, 6));
      persistSession(nextReport, debate, targetMission, targetMode);
      appendFeed('orchestrator', `Synthesis complete. Confidence ${nextReport.confidence}%. Exporting directive.`);
      setRunning(false);
      setActiveAgent('memory');
    }, 650 + stageTemplates.length * 1050);
  };

  const runRemoteMission = async (targetMission, targetMode) => {
    const response = await fetch('/api/mission/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mission: targetMission, mode: targetMode })
    });

    if (!response.ok || !response.body) {
      throw new Error('Mission stream unavailable');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        setActiveAgent(event.agent || 'orchestrator');

        if (event.message) {
          appendFeed(event.agent || 'system', event.message);
        }

        if (event.type === 'agent_start' || event.type === 'debate_start') {
          markEvent(event.agent, event.message);
        }

        if (event.type === 'api_exhausted') {
          setConnectionState('simulation');
        }

        if (event.type === 'debate_delta') {
          setDebate((current) => [
            { agent: event.agent === 'critic' ? 'Critic' : 'Agent', text: event.message },
            ...current
          ].slice(0, 4));
        }

        if (event.type === 'memory_recall' && event.memory?.length) {
          setMemory((current) => [
            `Recall: ${event.memory[0]}`,
            ...current
          ].slice(0, 6));
        }

        if (event.type === 'memory_commit') {
          setMemory((current) => [
            event.message,
            ...current
          ].slice(0, 6));
        }

        if (event.type === 'mission_complete') {
          setReport(event.report);
          persistSession(event.report, debate, targetMission, targetMode);
          setRunning(false);
          setActiveAgent('memory');
        }
      }
    }
  };

  const runMission = async (targetMission = mission, targetMode = mode, options = {}) => {
    if (running) return;
    setMission(targetMission);
    setMode(targetMode);
    setRunning(true);
    setFeed(
      options.cinematic
        ? demoPrelude.map((text, index) => ({ id: `demo-${index}-${Date.now()}`, agent: 'system', text }))
        : [{ id: crypto.randomUUID(), agent: 'system', text: `MISSION ACCEPTED: ${targetMission}` }]
    );
    setEvents([]);
    setDebate([]);
    setReport(null);
    setGraphPulse((value) => value + 1);

    try {
      if (options.cinematic) {
        await new Promise((resolve) => window.setTimeout(resolve, 1400));
      }
      await runRemoteMission(targetMission, targetMode);
    } catch {
      appendFeed('system', 'API stream unavailable. Local cognitive simulation engaged.');
      runLocalMission(targetMission, targetMode);
    } finally {
      window.setTimeout(() => {
        setRunning(false);
      }, 18000);
    }
  };

  const startDemo = () => {
    runMission(demoMissions[0], missionModes[0], { cinematic: true });
  };

  useEffect(() => {
    if (!running || report) return;
    const timeout = window.setTimeout(() => {
      setRunning(false);
    }, 45000);
    return () => window.clearTimeout(timeout);
  }, [running, report]);

  return {
    mission,
    setMission,
    mode,
    setMode,
    sessions,
    loadSession,
    running,
    runMission,
    startDemo,
    feed,
    events,
    debate,
    memory,
    report,
    activeAgent,
    graphPulse,
    connectionState
  };
}

function Starfield() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.z = 58;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const count = 750;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 130;
      positions[i + 1] = (Math.random() - 0.5) * 80;
      positions[i + 2] = (Math.random() - 0.5) * 90;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: '#7df9ff', size: 0.16, transparent: true, opacity: 0.55 });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    let frame;
    const animate = () => {
      stars.rotation.y += 0.0009;
      stars.rotation.x += 0.00025;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="starfield" ref={mountRef} />;
}

function Topbar({ running, connectionState }) {
  const statusConfig = {
    live: { label: 'Live Orchestration', class: 'live' },
    simulation: { label: 'Local Simulation Mode', class: 'sim' },
    offline: { label: 'Offline Simulation Mode', class: 'offline' },
    checking: { label: 'Connecting...', class: '' }
  };
  const currentStatus = statusConfig[connectionState] || statusConfig.checking;

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><Atom size={20} /></div>
        <div>
          <h1>NEXUS</h1>
          <span>AI-native strategic workflow platform</span>
        </div>
      </div>
      <div className="top-actions">
        <div className={`status-pill ${currentStatus.class}`}>
          <Activity size={15} /> {currentStatus.label}
        </div>
        <div className="status-pill">
          <Activity size={15} /> Cognitive mesh {running ? 'surging' : 'stable'}
        </div>
        <button className="icon-btn" aria-label="Scan"><ScanLine size={18} /></button>
        <button className="icon-btn" aria-label="Lock"><Lock size={18} /></button>
      </div>
    </header>
  );
}

function Sidebar() {
  const items = [
    ['Mission', Radar],
    ['Agents', Network],
    ['Graph', GitBranch],
    ['Memory', DatabaseZap],
    ['Threats', ShieldAlert]
  ];
  return (
    <aside className="sidebar">
      {items.map(([label, Icon], index) => (
        <button className={index === 0 ? 'side-item active' : 'side-item'} key={label} title={label}>
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}
    </aside>
  );
}

function AgentCard({ agent, active, running }) {
  const Icon = agent.icon;
  const confidence = useMemo(() => Math.floor(76 + Math.random() * 21), [running, active]);
  return (
    <motion.div
      className={active ? 'agent-card active' : 'agent-card'}
      style={{ '--agent': agent.color }}
      animate={{ y: active ? -3 : 0, opacity: active ? 1 : 0.78 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
    >
      <div className="agent-head">
        <div className="agent-icon"><Icon size={20} /></div>
        <div>
          <strong>{agent.name}</strong>
          <span>{agent.role}</span>
        </div>
      </div>
      <p>{agent.tone}</p>
      <div className="agent-meta">
        <span>{active && running ? 'thinking' : active ? 'primed' : 'standby'}</span>
        <b>{confidence}%</b>
      </div>
      <div className="meter"><i style={{ width: `${confidence}%` }} /></div>
    </motion.div>
  );
}

function MissionConsole({ mission, setMission, mode, setMode, sessions, loadSession, runMission, startDemo, running }) {
  return (
    <section className="mission-console panel">
      <div className="panel-title">
        <div><Radar size={18} /> Mission Console</div>
        <span>{mode}</span>
      </div>
      <div className="mode-row">
        {missionModes.map((item) => (
          <button className={mode === item ? 'selected' : ''} key={item} onClick={() => setMode(item)}>
            {item}
          </button>
        ))}
      </div>
      <textarea value={mission} onChange={(event) => setMission(event.target.value)} />
      <div className="demo-row">
        {demoMissions.map((item) => (
          <button key={item} onClick={() => setMission(item)}>{item.replace('.', '')}</button>
        ))}
      </div>
      <div className="command-row">
        <button className="primary" onClick={runMission} disabled={running}>
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Mission Running' : 'Initiate Mission'}
        </button>
        <button className="secondary" onClick={startDemo} disabled={running}><Sparkles size={17} /> Demo Run</button>
        <button className="secondary"><Zap size={17} /> Boost Confidence</button>
        <button className="secondary"><GitBranch size={17} /> Fork Plan</button>
      </div>
      <div className="session-strip">
        <span>Mission history</span>
        <div>
          {sessions.length ? sessions.slice(0, 3).map((session) => (
            <button key={session.id} onClick={() => loadSession(session)}>
              {session.mode}: {session.mission}
            </button>
          )) : <em>No saved missions yet</em>}
        </div>
      </div>
    </section>
  );
}

function KnowledgeGraph({ mission, graphPulse, activeAgent }) {
  const keywords = missionKeywords(mission);
  const nodes = ['NEXUS', ...keywords, activeAgent].slice(0, 10);
  return (
    <section className="graph-panel panel">
      <div className="panel-title">
        <div><Network size={18} /> Dynamic Knowledge Graph</div>
        <span>live expansion</span>
      </div>
      <div className="graph-space">
        {nodes.map((node, index) => {
          const angle = (index / nodes.length) * Math.PI * 2 + graphPulse * 0.12;
          const radius = index === 0 ? 0 : 34 + (index % 3) * 11;
          const x = 50 + Math.cos(angle) * radius;
          const y = 50 + Math.sin(angle) * radius * 0.65;
          return (
            <motion.div
              className={index === 0 ? 'graph-node core' : 'graph-node'}
              key={`${node}-${index}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              animate={{ scale: index === 0 ? [1, 1.12, 1] : [0.92, 1.04, 0.92] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.12 }}
            >
              {node}
            </motion.div>
          );
        })}
        <svg className="graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {nodes.slice(1).map((_, index) => {
            const angle = ((index + 1) / nodes.length) * Math.PI * 2 + graphPulse * 0.12;
            const radius = 34 + ((index + 1) % 3) * 11;
            const x = 50 + Math.cos(angle) * radius;
            const y = 50 + Math.sin(angle) * radius * 0.65;
            return <line key={index} x1="50" y1="50" x2={x} y2={y} />;
          })}
        </svg>
      </div>
    </section>
  );
}

function LiveTerminal({ feed }) {
  return (
    <section className="terminal-panel panel">
      <div className="panel-title">
        <div><Terminal size={18} /> Live Agent Feed</div>
        <span>streaming cognition</span>
      </div>
      <div className="terminal-feed">
        <AnimatePresence initial={false}>
          {feed.map((line) => (
            <motion.div
              className="terminal-line"
              key={line.id}
              initial={{ opacity: 0, x: -12, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0 }}
            >
              <span>{line.agent}</span>
              <p>{line.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Timeline({ events, running }) {
  const fallback = ['mission intake', 'task routing', 'parallel analysis', 'debate', 'memory commit', 'synthesis'];
  const rows = events.length ? events : fallback.map((label, index) => ({ id: label, label, agent: agents[index % agents.length].id }));
  return (
    <section className="timeline panel">
      <div className="panel-title">
        <div><Orbit size={18} /> Autonomous Planning Timeline</div>
        <span>{running ? 'executing' : 'ready'}</span>
      </div>
      {rows.slice(-7).map((event, index) => (
        <div className="timeline-row" key={event.id}>
          <i className={events.length && index === rows.slice(-7).length - 1 ? 'hot' : ''} />
          <div>
            <strong>{event.agent}</strong>
            <span>{event.label}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function DebatePanel({ running, debate }) {
  const lines = debate.length ? debate : [
    { agent: 'Critic', text: 'Awaiting adversarial review.' },
    { agent: 'Strategist', text: 'Counter-positioning channel armed.' }
  ];

  return (
    <section className="debate panel">
      <div className="panel-title">
        <div><ShieldAlert size={18} /> Agent Debate Mode</div>
        <span>{running ? 'active' : 'armed'}</span>
      </div>
      {lines.slice(0, 3).map((line, index) => (
        <div className={line.agent === 'Critic' ? 'debate-line critic' : 'debate-line strategist'} key={`${line.agent}-${index}`}>
          <b>{line.agent}</b>
          <p>{line.text}</p>
        </div>
      ))}
    </section>
  );
}

function MemoryPanel({ memory }) {
  return (
    <section className="memory panel">
      <div className="panel-title">
        <div><DatabaseZap size={18} /> Persistent Memory</div>
        <span>{memory.length} traces</span>
      </div>
      {memory.map((item, index) => (
        <div className="memory-item" key={`${item}-${index}`}>
          <Eye size={15} />
          <span>{item}</span>
        </div>
      ))}
    </section>
  );
}

function MissionOutput({ report }) {
  return (
    <section className="output panel">
      <div className="panel-title">
        <div><Sparkles size={18} /> Unified Output</div>
        <span>{report ? `${report.confidence}% confidence` : 'assembling'}</span>
      </div>
      {report ? (
        <>
          <h2>{report.title}</h2>
          <div className="report-grid">
            {report.sections.map((section) => (
              <article key={section.label}>
                <div className="report-head">
                  <strong>{section.label}</strong>
                  {section.risk && <span className={`risk ${section.risk.toLowerCase()}`}>Risk {section.risk}</span>}
                </div>
                <p>{section.text}</p>
                {section.recommendation && <small>{section.recommendation}</small>}
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="skeleton-stack">
          <i />
          <i />
          <i />
        </div>
      )}
    </section>
  );
}

function App() {
  const engine = useMissionEngine();
  return (
    <main className="app-shell">
      <Starfield />
      <div className="grid-bg" />
      <Topbar running={engine.running} connectionState={engine.connectionState} />
      <Sidebar />
      <section className="workspace">
        <div className="left-column">
          <MissionConsole {...engine} />
          <div className="agent-grid">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                running={engine.running}
                active={engine.activeAgent === agent.id}
              />
            ))}
          </div>
        </div>
        <div className="center-column">
          <KnowledgeGraph {...engine} />
          <MissionOutput report={engine.report} />
        </div>
        <div className="right-column">
          <LiveTerminal feed={engine.feed} />
          <Timeline events={engine.events} running={engine.running} />
          <DebatePanel running={engine.running} debate={engine.debate} />
          <MemoryPanel memory={engine.memory} />
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
