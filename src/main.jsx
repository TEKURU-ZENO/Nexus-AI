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
  const [fullTraces, setFullTraces] = useState({});

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
      const localTraces = {
        orchestrator: "Decomposed mission into research, strategy, architecture, critique, and memory tracks.\nResolved debate into phased execution plan with confidence-weighted decisions.",
        researcher: "Scanning competitor patterns, market timing, adoption constraints, and regulatory shadows.\nObservation: errors are expensive. Small clinics are fast adopters.",
        architect: "Drafting product flows, system surfaces, data pathways, and operator controls.\nDesigned intake, agent routing, evidence ledger, and confidence labels.",
        strategist: "Estimating wedge, buyer urgency, monetization, retention loops, and launch sequence.\nRecommends founder-led pilots and outcome-based pricing.",
        critic: "Stress testing assumptions for weak evidence, brittle economics, and trust failures.\nCritique: users will punish vague AI claims. Force evidence checking."
      };
      setFullTraces(localTraces);
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

  const runRemoteMission = async (targetMission, targetMode, refinement = null) => {
    const response = await fetch('/api/mission/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mission: targetMission, mode: targetMode, refinement })
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
          setFullTraces(event.full_traces || {});
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
    setFullTraces({});
    setGraphPulse((value) => value + 1);

    try {
      if (options.cinematic) {
        await new Promise((resolve) => window.setTimeout(resolve, 1400));
      }
      await runRemoteMission(targetMission, targetMode, options.refinement);
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
    connectionState,
    fullTraces
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

function MissionConsole({ mission, setMission, mode, setMode, sessions, loadSession, runMission, startDemo, running, onCompare }) {
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
        <button className="primary" onClick={() => runMission()} disabled={running}>
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Mission Running' : 'Initiate Mission'}
        </button>
        <button className="secondary" onClick={startDemo} disabled={running}><Sparkles size={17} /> Demo Run</button>
        <button className="secondary" onClick={onCompare}><GitBranch size={17} /> Compare Plans</button>
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
  
  const categories = [
    { id: 'researcher', label: 'Discovery', color: '#b6ff6a', defaultKeyword: 'Insights' },
    { id: 'architect', label: 'Architecture', color: '#ffcc66', defaultKeyword: 'Blueprints' },
    { id: 'strategist', label: 'Strategy', color: '#ff7ad9', defaultKeyword: 'Viability' },
    { id: 'critic', label: 'Risk Analysis', color: '#ff5b6e', defaultKeyword: 'Mitigations' },
    { id: 'memory', label: 'Context Fabric', color: '#9c8cff', defaultKeyword: 'State' }
  ];

  const getCategory = (word) => {
    const lower = word.toLowerCase();
    if (['market', 'launch', 'monetize', 'growth', 'business', 'model', 'product', 'startup', 'monetization', 'value', 'viability', 'strategy'].some(x => lower.includes(x))) {
      return 'strategist';
    }
    if (['system', 'platform', 'architect', 'design', 'infra', 'data', 'software', 'app', 'engineering', 'blueprint', 'flows'].some(x => lower.includes(x))) {
      return 'architect';
    }
    if (['risk', 'error', 'threat', 'vulnerability', 'attack', 'security', 'failure', 'objections', 'weakness', 'mitigation'].some(x => lower.includes(x))) {
      return 'critic';
    }
    if (['memory', 'context', 'history', 'database', 'seed', 'archive', 'state', 'principle', 'preference'].some(x => lower.includes(x))) {
      return 'memory';
    }
    return 'researcher';
  };

  const keywordGroups = {
    researcher: [],
    architect: [],
    strategist: [],
    critic: [],
    memory: []
  };

  keywords.forEach(word => {
    const cat = getCategory(word);
    if (keywordGroups[cat]) {
      keywordGroups[cat].push(word.toUpperCase());
    }
  });

  categories.forEach(cat => {
    if (keywordGroups[cat.id].length === 0) {
      keywordGroups[cat.id].push(cat.defaultKeyword.toUpperCase());
    }
  });

  const rootPos = { x: 8, y: 50 };
  const categoryPos = {
    researcher: { x: 38, y: 15 },
    architect: { x: 38, y: 32.5 },
    strategist: { x: 38, y: 50 },
    critic: { x: 38, y: 67.5 },
    memory: { x: 38, y: 85 }
  };

  const leaves = [];
  categories.forEach(cat => {
    const groupWords = keywordGroups[cat.id];
    const catY = categoryPos[cat.id].y;
    const N = groupWords.length;
    const spacing = 7;
    
    groupWords.forEach((word, index) => {
      const leafY = catY + (index - (N - 1) / 2) * spacing;
      leaves.push({
        word,
        parentId: cat.id,
        parentColor: cat.color,
        x: 76,
        y: leafY
      });
    });
  });

  const isAgentActive = (id) => activeAgent === id;

  return (
    <section className="graph-panel panel">
      <div className="panel-title">
        <div><Network size={18} /> Dynamic Knowledge Graph</div>
        <span>live hierarchy mapping</span>
      </div>
      <div className="graph-space">
        <svg className="graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {categories.map(cat => {
            const active = isAgentActive(cat.id) || activeAgent === 'orchestrator';
            return (
              <line
                key={`root-to-${cat.id}`}
                x1={rootPos.x}
                y1={rootPos.y}
                x2={categoryPos[cat.id].x}
                y2={categoryPos[cat.id].y}
                style={{
                  stroke: active ? cat.color : 'rgba(125, 249, 255, 0.08)',
                  strokeWidth: active ? 0.6 : 0.2,
                  transition: 'all 0.5s ease'
                }}
                className={active ? 'graph-line-active' : ''}
              />
            );
          })}

          {leaves.map((leaf, index) => {
            const active = isAgentActive(leaf.parentId) || activeAgent === 'orchestrator';
            const catPos = categoryPos[leaf.parentId];
            return (
              <line
                key={`cat-to-leaf-${index}`}
                x1={catPos.x}
                y1={catPos.y}
                x2={leaf.x}
                y2={leaf.y}
                style={{
                  stroke: active ? leaf.parentColor : 'rgba(125, 249, 255, 0.08)',
                  strokeWidth: active ? 0.4 : 0.15,
                  transition: 'all 0.5s ease'
                }}
                className={active ? 'graph-line-active' : ''}
              />
            );
          })}
        </svg>

        <motion.div
          className="graph-node core"
          style={{ left: `${rootPos.x}%`, top: `${rootPos.y}%` }}
          animate={{
            scale: activeAgent === 'orchestrator' ? [1, 1.08, 1] : [1, 1.02, 1],
            boxShadow: activeAgent === 'orchestrator' 
              ? '0 0 30px rgba(125, 249, 255, 0.6)' 
              : '0 0 15px rgba(125, 249, 255, 0.2)'
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          NEXUS
        </motion.div>

        {categories.map(cat => {
          const active = isAgentActive(cat.id);
          const pos = categoryPos[cat.id];
          return (
            <motion.div
              key={cat.id}
              className={`graph-node category-node ${active ? 'active' : ''}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                border: `1px solid ${active ? cat.color : 'rgba(255, 255, 255, 0.15)'}`,
                color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                textShadow: active ? `0 0 8px ${cat.color}` : 'none',
                boxShadow: active ? `0 0 15px ${cat.color}33` : 'none',
                zIndex: active ? 10 : 2
              }}
              animate={active ? { scale: 1.05 } : { scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span 
                  style={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    backgroundColor: cat.color,
                    boxShadow: `0 0 6px ${cat.color}`,
                    display: 'inline-block'
                  }} 
                />
                {cat.label}
              </div>
            </motion.div>
          );
        })}

        {leaves.map((leaf, index) => {
          const active = isAgentActive(leaf.parentId);
          return (
            <motion.div
              key={`leaf-${index}`}
              className={`graph-node leaf-node ${active ? 'active' : ''}`}
              style={{
                left: `${leaf.x}%`,
                top: `${leaf.y}%`,
                border: `1px solid ${active ? leaf.parentColor + '88' : 'rgba(255, 255, 255, 0.08)'}`,
                color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                backgroundColor: 'rgba(2, 12, 23, 0.9)',
                fontSize: '10px',
                fontFamily: 'monospace',
                padding: '4px 8px',
                minHeight: 'auto',
                boxShadow: active ? `0 0 8px ${leaf.parentColor}22` : 'none',
                zIndex: active ? 9 : 1
              }}
              animate={active ? { scale: 1.02 } : { scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {leaf.word}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function LiveTerminal({ feed }) {
  return (
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
  );
}

function Timeline({ events, running }) {
  const fallback = ['mission intake', 'task routing', 'parallel analysis', 'debate', 'memory commit', 'synthesis'];
  const rows = events.length ? events : fallback.map((label, index) => ({ id: label, label, agent: agents[index % agents.length].id }));
  return (
    <div className="timeline-feed-wrapper" style={{ overflowY: 'auto', height: '100%' }}>
      {rows.slice(-7).map((event, index) => (
        <div className="timeline-row" key={event.id}>
          <i className={events.length && index === rows.slice(-7).length - 1 ? 'hot' : ''} />
          <div>
            <strong>{event.agent}</strong>
            <span>{event.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DebatePanel({ running, debate }) {
  const lines = debate.length ? debate : [
    { agent: 'Critic', text: 'Awaiting adversarial review.' },
    { agent: 'Strategist', text: 'Counter-positioning channel armed.' }
  ];

  return (
    <div className="debate-feed-wrapper" style={{ overflowY: 'auto', height: '100%' }}>
      {lines.slice(0, 3).map((line, index) => (
        <div className={line.agent === 'Critic' ? 'debate-line critic' : 'debate-line strategist'} key={`${line.agent}-${index}`}>
          <b>{line.agent}</b>
          <p>{line.text}</p>
        </div>
      ))}
    </div>
  );
}

function MemoryPanel({ memory }) {
  return (
    <div className="memory-feed-wrapper" style={{ overflowY: 'auto', height: '100%' }}>
      {memory.map((item, index) => (
        <div className="memory-item" key={`${item}-${index}`}>
          <Eye size={15} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function RightPanel({ engine }) {
  const [activeTab, setActiveTab] = useState('feed');
  return (
    <section className="right-panel panel">
      <div className="panel-tabs">
        <button className={activeTab === 'feed' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('feed')}>
          <Terminal size={14} /> Feed
        </button>
        <button className={activeTab === 'debate' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('debate')}>
          <ShieldAlert size={14} /> Debate
        </button>
        <button className={activeTab === 'memory' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('memory')}>
          <DatabaseZap size={14} /> Memory
        </button>
        <button className={activeTab === 'timeline' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('timeline')}>
          <Orbit size={14} /> Timeline
        </button>
      </div>
      <div className="tab-content" style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'feed' && <LiveTerminal feed={engine.feed} />}
        {activeTab === 'debate' && <DebatePanel running={engine.running} debate={engine.debate} />}
        {activeTab === 'memory' && <MemoryPanel memory={engine.memory} />}
        {activeTab === 'timeline' && <Timeline events={engine.events} running={engine.running} />}
      </div>
    </section>
  );
}

function MissionOutput({ report, mission, mode, runMission, running }) {
  const [refinementText, setRefinementText] = useState('');

  const exportReport = () => {
    if (!report) return;
    let md = `# NEXUS Strategic Directive\n\n`;
    md += `**Mission:** ${mission}\n`;
    md += `**Mode:** ${mode}\n`;
    md += `**Confidence Score:** ${report.confidence}%\n\n`;
    md += `## Sections\n\n`;
    report.sections.forEach(sec => {
      md += `### ${sec.label} (Risk: ${sec.risk})\n`;
      md += `${sec.text}\n\n`;
      if (sec.recommendation) {
        md += `*Recommendation:* ${sec.recommendation}\n\n`;
      }
    });
    md += `\n---\n*Generated by NEXUS AI-native Strategic Workflow Platform*\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXUS-Directive-${mode.replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefineSubmit = () => {
    if (!refinementText.trim()) return;
    runMission(mission, mode, { refinement: refinementText });
    setRefinementText('');
  };

  return (
    <section className="output panel">
      <div className="panel-title">
        <div><Sparkles size={18} /> Unified Output</div>
        <span>{report ? `${report.confidence}% confidence` : 'assembling'}</span>
      </div>
      {report ? (
        <div className="output-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{report.title}</h2>
            <button className="secondary" onClick={exportReport} style={{ height: '34px', fontSize: '12px' }}>
              <Zap size={14} /> Export Report (.md)
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '10px', color: 'rgba(125, 249, 255, 0.65)', fontFamily: 'monospace' }}>
            <span style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>MISSION SECURE ID: NXS-8942-A</span>
            <span style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>LATENCY: 1.42s</span>
            <span style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>MESH: 6 ACTIVE</span>
            <span style={{ background: 'rgba(255,255,255,0.03)', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>SEED: 0x9f32e</span>
          </div>

          <div className="confidence-breakdown">
            <div className="breakdown-bar">
              <span>Desirability (Researcher)</span>
              <div className="meter-bg">
                <motion.div className="meter-fill" initial={{ width: 0 }} animate={{ width: '88%' }} transition={{ type: 'spring', stiffness: 80, damping: 12, delay: 0.1 }} style={{ backgroundColor: '#b6ff6a' }} />
              </div>
              <span>88%</span>
            </div>
            <div className="breakdown-bar">
              <span>Feasibility (Architect)</span>
              <div className="meter-bg">
                <motion.div className="meter-fill" initial={{ width: 0 }} animate={{ width: '86%' }} transition={{ type: 'spring', stiffness: 80, damping: 12, delay: 0.2 }} style={{ backgroundColor: '#7df9ff' }} />
              </div>
              <span>86%</span>
            </div>
            <div className="breakdown-bar">
              <span>Viability (Strategist)</span>
              <div className="meter-bg">
                <motion.div className="meter-fill" initial={{ width: 0 }} animate={{ width: '87%' }} transition={{ type: 'spring', stiffness: 80, damping: 12, delay: 0.3 }} style={{ backgroundColor: '#ff7ad9' }} />
              </div>
              <span>87%</span>
            </div>
            <div className="breakdown-bar">
              <span>Resilience (Critic)</span>
              <div className="meter-bg">
                <motion.div className="meter-fill" initial={{ width: 0 }} animate={{ width: '91%' }} transition={{ type: 'spring', stiffness: 80, damping: 12, delay: 0.4 }} style={{ backgroundColor: '#ff5b6e' }} />
              </div>
              <span>91%</span>
            </div>
          </div>

          <motion.div 
            className="report-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {report.sections.map((section, idx) => (
              <motion.article 
                key={section.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
              >
                <div className="report-head">
                  <strong>{section.label}</strong>
                  {section.risk && <span className={`risk ${section.risk.toLowerCase()}`}>Risk {section.risk}</span>}
                </div>
                <p>{section.text}</p>
                {section.recommendation && <small>{section.recommendation}</small>}
              </motion.article>
            ))}
          </motion.div>

          <div className="refinement-area">
            <label>Adversarial Feedback Loop (Refine Directive)</label>
            <div className="refinement-input-row">
              <textarea 
                value={refinementText} 
                onChange={(e) => setRefinementText(e.target.value)} 
                placeholder="Enter criticism or instruction to refine this plan (e.g. 'focus more on regulatory constraints')"
                disabled={running}
              />
              <button className="primary" onClick={handleRefineSubmit} disabled={running || !refinementText.trim()}>
                Refine Plan
              </button>
            </div>
          </div>
        </div>
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

function AgentTraceModal({ agent, trace, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{agent.name} - Cognitive Trace</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <pre>{trace || "No cognitive trace recorded for this agent in the current session. Run a mission to collect traces."}</pre>
        </div>
      </div>
    </div>
  );
}

function ComparisonModal({ sessions, onClose }) {
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(sessions.length > 1 ? 1 : 0);

  if (!sessions || sessions.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Compare Mission Plans</h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-body">
            <p>You need at least one saved mission in your history to compare plans.</p>
          </div>
        </div>
      </div>
    );
  }

  const leftSession = sessions[leftIndex];
  const rightSession = sessions[rightIndex];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Compare Mission Plans</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="comparison-selectors">
            <div>
              <label>Plan A:</label>
              <select value={leftIndex} onChange={e => setLeftIndex(Number(e.target.value))}>
                {sessions.map((s, idx) => (
                  <option key={s.id} value={idx}>{s.mode}: {s.mission.slice(0, 40)}...</option>
                ))}
              </select>
            </div>
            <div>
              <label>Plan B:</label>
              <select value={rightIndex} onChange={e => setRightIndex(Number(e.target.value))}>
                {sessions.map((s, idx) => (
                  <option key={s.id} value={idx}>{s.mode}: {s.mission.slice(0, 40)}...</option>
                ))}
              </select>
            </div>
          </div>

          <table className="comparison-table">
            <thead>
              <tr>
                <th>Vector</th>
                <th>Plan A</th>
                <th>Plan B</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Mission</strong></td>
                <td>{leftSession.mission}</td>
                <td>{rightSession.mission}</td>
              </tr>
              <tr>
                <td><strong>Mode</strong></td>
                <td>{leftSession.mode}</td>
                <td>{rightSession.mode}</td>
              </tr>
              <tr>
                <td><strong>Confidence</strong></td>
                <td><span className="conf-value">{leftSession.report?.confidence || 90}%</span></td>
                <td><span className="conf-value">{rightSession.report?.confidence || 90}%</span></td>
              </tr>
              {leftSession.report?.sections.map((sec, idx) => {
                const rightSec = rightSession.report?.sections[idx] || {};
                return (
                  <tr key={sec.label}>
                    <td><strong>{sec.label}</strong></td>
                    <td>
                      <div className="risk-tag">{sec.risk && <span className={`risk ${sec.risk.toLowerCase()}`}>Risk {sec.risk}</span>}</div>
                      <p>{sec.text}</p>
                      {sec.recommendation && <small>{sec.recommendation}</small>}
                    </td>
                    <td>
                      <div className="risk-tag">{rightSec.risk && <span className={`risk ${rightSec.risk.toLowerCase()}`}>Risk {rightSec.risk}</span>}</div>
                      <p>{rightSec.text}</p>
                      {rightSec.recommendation && <small>{rightSec.recommendation}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LandingPage({ onEnter, connectionState }) {
  const statusConfig = {
    live: { label: 'SYSTEM STATE: OPERATIONAL (LIVE)', class: 'live' },
    simulation: { label: 'SYSTEM STATE: SIMULATED NODE', class: 'sim' },
    offline: { label: 'SYSTEM STATE: OFFLINE DIRECTIVE', class: 'offline' },
    checking: { label: 'SYSTEM STATE: INITIALIZING...', class: '' }
  };
  const currentStatus = statusConfig[connectionState] || statusConfig.checking;

  const [logs, setLogs] = useState([
    'NEXUS SYSTEM DECRYPT KEY LOADED [0x9f32e]',
    'CORE SUBSYSTEMS ARMED: 6 AGENT NODES DETECTED',
    'MEMORY PERSISTENCE: READY'
  ]);

  useEffect(() => {
    const mockFeed = [
      'Establishing API link to OpenAI Responses Engine...',
      'Secure socket handshake verified: 1024-bit key exchange',
      'Injecting dynamic memory index parameters...',
      'Cognitive debate parameters set to adversarial mode',
      'Ready for strategic mission intake...'
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < mockFeed.length) {
        setLogs((current) => [...current, `[${new Date().toLocaleTimeString()}] ${mockFeed[idx]}`].slice(-6));
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="landing-shell">
      <Starfield />
      <div className="grid-bg" />
      <div className="landing-content-split">
        <motion.div 
          className="landing-left"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="landing-badge">
            <Atom size={16} /> <span>NEXUS OPERATING SYSTEM</span>
          </div>
          <h1>NEXUS</h1>
          <p className="subtitle">Collaborative Strategy & Multi-Agent Orchestration</p>
          <p className="tagline">
            Decompose complex missions, orchestrate sequential agent chains of thought, debate plan safety adversarially, and compile production-ready strategic directives.
          </p>

          <div className={`status-indicator ${currentStatus.class}`}>
            <span className={`status-dot ${currentStatus.class}`} /> {currentStatus.label}
          </div>

          <div className="landing-actions">
            <button className="primary" onClick={onEnter}>
              <Play size={18} /> Initiate Connection
            </button>
            <a href="https://github.com/TEKURU-ZENO/Nexus-AI" target="_blank" rel="noreferrer" className="secondary btn-link">
              <GitBranch size={17} /> Source Code
            </a>
          </div>
        </motion.div>

        <motion.div 
          className="landing-right"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="terminal-card">
            <div className="terminal-header">
              <div className="dots"><span /><span /><span /></div>
              <span>NEXUS_OS_TELEMETRY.LOG</span>
            </div>
            <div className="terminal-logs">
              {logs.map((log, idx) => (
                <div className="log-line" key={idx}>
                  <span className="log-arrow">&gt;&gt;</span> {log}
                </div>
              ))}
              <div className="log-line blinking-log">
                <span className="log-arrow">&gt;&gt;</span> AWAITING CONNECTION VECTOR...
              </div>
            </div>
          </div>

          <div className="tactical-specs">
            <div className="spec-item">
              <span>AGENTS INSTANTIATED</span>
              <b>06 UNITS</b>
            </div>
            <div className="spec-item">
              <span>SECURE MESH PORTS</span>
              <b>SSL/NDJSON</b>
            </div>
            <div className="spec-item">
              <span>REASONING PIPELINE</span>
              <b>SEQUENTIAL CHAIN</b>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function App() {
  const engine = useMissionEngine();
  const [view, setView] = useState('landing');
  const [traceAgent, setTraceAgent] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);

  if (view === 'landing') {
    return <LandingPage onEnter={() => setView('console')} connectionState={engine.connectionState} />;
  }

  return (
    <main className="app-shell">
      <Starfield />
      <div className="grid-bg" />
      <Topbar running={engine.running} connectionState={engine.connectionState} />
      <Sidebar />
      <section className="workspace">
        <div className="left-column">
          <MissionConsole {...engine} onCompare={() => setCompareOpen(true)} />
          <div className="agent-grid">
            {agents.map((agent) => (
              <div key={agent.id} onClick={() => setTraceAgent(agent)}>
                <AgentCard
                  agent={agent}
                  running={engine.running}
                  active={engine.activeAgent === agent.id}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="center-column">
          <KnowledgeGraph {...engine} />
          <MissionOutput 
            report={engine.report} 
            mission={engine.mission} 
            mode={engine.mode} 
            runMission={engine.runMission} 
            running={engine.running} 
          />
        </div>
        <div className="right-column">
          <RightPanel engine={engine} />
        </div>
      </section>

      {traceAgent && (
        <AgentTraceModal 
          agent={traceAgent} 
          trace={engine.fullTraces[traceAgent.id]} 
          onClose={() => setTraceAgent(null)} 
        />
      )}

      {compareOpen && (
        <ComparisonModal 
          sessions={engine.sessions} 
          onClose={() => setCompareOpen(false)} 
        />
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
