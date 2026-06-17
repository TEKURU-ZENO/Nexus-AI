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
    color: '#3291ff',
    tone: 'coordinates task decomposition, routing, and synthesis'
  },
  {
    id: 'researcher',
    name: 'Researcher',
    role: 'Signal discovery',
    icon: FileSearch,
    color: '#3291ff',
    tone: 'maps markets, competitors, evidence, and edge cases'
  },
  {
    id: 'architect',
    name: 'Architect',
    role: 'System design',
    icon: CircuitBoard,
    color: '#3291ff',
    tone: 'turns ideas into flows, interfaces, APIs, and infra'
  },
  {
    id: 'strategist',
    name: 'Strategist',
    role: 'Growth logic',
    icon: Rocket,
    color: '#3291ff',
    tone: 'models positioning, monetization, GTM, and scale'
  },
  {
    id: 'critic',
    name: 'Critic',
    role: 'Threat analysis',
    icon: ShieldAlert,
    color: '#ff0055',
    tone: 'attacks weak assumptions and failure modes'
  },
  {
    id: 'memory',
    name: 'Memory Agent',
    role: 'Context fabric',
    icon: DatabaseZap,
    color: '#3291ff',
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

function buildReport(mission, refinement = null) {
  const lower = mission.toLowerCase();
  
  const decision = lower.includes('medical') || lower.includes('hospital')
    ? 'PROCEED WITH CLINICAL DECISION SUPPORT SUPERVISION CONSOLE FOR HIGH-RISK LABELS'
    : lower.includes('fitness')
      ? 'DEPLOY WEARABLE EDGE-COMPUTE MODEL WITH LOCAL DATA PRIVACY SANITIZATION'
      : lower.includes('cyber')
        ? 'ENGAGE ISOLATED SANDBOX CONTAINER PLAYBOOKS FOR IMMEDIATE COMPROMISE ISOLATION'
        : lower.includes('education')
          ? 'LAUNCH SEMI-SUPERVISED PERSONALIZED TUTORING PLATFORM IN SPECIAL EDUCATION COHORTS'
          : 'DEPLOY PILOT MESH FOR HIGH-FREQUENCY STRATEGIC WORKFLOW AUTO-ASSISTANCE';

  const rationale = lower.includes('medical') || lower.includes('hospital')
    ? 'Supervised integration balances liability exposure with doctor review workflows before full automation validation.'
    : 'Local edge compute maximizes compliance, user trust, and processing speed on portable nodes.';

  const report = {
    title: 'Strategic Directive',
    confidence: 91,
    decision,
    rationale,
    sections: [
      {
        label: 'Reasoning',
        text: `Analysis indicates high initial transaction friction in this space. Standardizing workflows onto a consolidated cognitive mesh resolves coordination bottlenecks and exposes operational anomalies. We recommend launching concierge pilots to generate hard performance case studies.`
      },
      {
        label: 'Tradeoffs',
        text: `Phased rollouts limit liability and secure customer trust, but slow down data collection pipelines. A tighter loop with manual locks decreases speed-to-autonomy but significantly mitigates outlier failure risk.`
      },
      {
        label: 'Execution Plan',
        text: `Phase 1: Instantiate security controls and baseline audit logging. Phase 2: Deploy supervised decision locks on pilot sites. Phase 3: Roll out automation templates based on case study feedback.`
      },
      {
        label: 'Success Metrics',
        text: `Target a 50% decrease in manual triage latency, 100% decision ledger auditability, and greater than 90% customer retention during the initial pilot phase.`
      }
    ],
    tasks: [
      'Initialize secure database ledger and state indexers',
      'Deploy human-in-the-loop decision console',
      'Publish outcomes case study for stakeholder alignment'
    ]
  };

  if (refinement) {
    report.sections.forEach(sec => {
      sec.text += ` [Refinement applied: aligned strategy with "${refinement}".]`;
    });
    report.decision += ` (REFINED)`;
  }

  return report;
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
  const [decisionStatus, setDecisionStatus] = useState('pending');
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
    setDecisionStatus(session.report?.decisionStatus || 'pending');
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

  const runLocalMission = (targetMission, targetMode, refinement = null) => {
    stageTemplates.forEach((stage, index) => {
      window.setTimeout(() => {
        setActiveAgent(stage.agent);
        appendFeed(stage.agent, stage.text);
        markEvent(stage.agent, stage.text.split(':')[0]);
      }, 650 + index * 1050);
    });

    window.setTimeout(() => {
      const nextReport = buildReport(targetMission, refinement);
      setReport(nextReport);
      const localTraces = {
        orchestrator: "Decomposed mission into research, strategy, architecture, critique, and memory tracks.\nResolved debate into phased execution plan with confidence-weighted decisions.",
        researcher: "Scanning competitor patterns, market timing, adoption constraints, and regulatory shadows.\nObservation: errors are expensive. Small clinics are fast adopters.",
        architect: "Drafting product flows, system surfaces, data pathways, and operator controls.\nDesigned intake, agent routing, evidence ledger, and confidence labels.",
        strategist: "Estimating wedge, buyer urgency, monetization, retention loops, and launch sequence.\nRecommends founder-led pilots and outcome-based pricing.",
        critic: "Stress testing assumptions for weak evidence, brittle economics, and trust failures.\nCritique: users will punish vague AI claims. Force evidence checking."
      };
      if (refinement) {
        Object.keys(localTraces).forEach(key => {
          localTraces[key] += `\n[Refinement applied: aligned strategy with "${refinement}"]`;
        });
      }
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
          const rawReport = event.report;
          const sections = rawReport.sections || [];
          
          const decisionText = targetMission.toLowerCase().includes('medical') || targetMission.toLowerCase().includes('hospital')
            ? 'PROCEED WITH CLINICAL DECISION SUPPORT SUPERVISION CONSOLE FOR HIGH-RISK LABELS'
            : 'DEPLOY PILOT COGNITIVE MESH SYSTEM FOR TARGET OPERATIONS';
            
          const mckinseyReport = {
            title: rawReport.title || 'Strategic Directive',
            confidence: rawReport.confidence || 91,
            decision: decisionText,
            rationale: sections[3]?.recommendation || 'Expected impact outweighs implementation complexity.',
            sections: [
              { label: 'Reasoning', text: sections[0]?.text || 'No preceding analysis.' },
              { label: 'Tradeoffs', text: sections[1]?.text || 'No tradeoff analysis.' },
              { label: 'Execution Plan', text: sections[2]?.text || 'No execution details.' },
              { label: 'Success Metrics', text: sections[3]?.text || 'No metrics provided.' }
            ],
            tasks: [
              sections[0]?.recommendation || 'Initiate first phase wedge',
              sections[1]?.recommendation || 'Configure core workflow hooks',
              sections[2]?.recommendation || 'Establish pilot telemetry metric ledger'
            ]
          };

          setReport(mckinseyReport);
          setFullTraces(event.full_traces || {});
          persistSession(mckinseyReport, debate, targetMission, targetMode);
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
    setDecisionStatus('pending');
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
      runLocalMission(targetMission, targetMode, options.refinement);
    } finally {
      window.setTimeout(() => {
        setRunning(false);
      }, 18000);
    }
  };

  const acceptDecision = () => {
    if (!report) return;
    setDecisionStatus('accepted');
    const commitMsg = `Accepted recommended decision: ${report.decision}`;
    setMemory((current) => [commitMsg, ...current].slice(0, 6));
    appendFeed('system', commitMsg);
    
    const updatedReport = { ...report, decisionStatus: 'accepted' };
    setReport(updatedReport);
    
    setSessions((current) => {
      const updated = current.map(s => {
        if (s.mission === mission && s.mode === mode) {
          return { ...s, report: updatedReport };
        }
        return s;
      });
      localStorage.setItem('nexus.sessions', JSON.stringify(updated));
      return updated;
    });
  };

  const challengeDecision = () => {
    if (!report) return;
    setDecisionStatus('challenged');
    const refinementText = `Re-evaluate tradeoffs under safety and adversarial constraints: "${report.decision}"`;
    appendFeed('critic', `Challenging recommended decision. Initiating critical revision...`);
    runMission(mission, mode, { refinement: refinementText });
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
    fullTraces,
    decisionStatus,
    acceptDecision,
    challengeDecision
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
    const material = new THREE.PointsMaterial({ color: '#7df9ff', size: 0.16, transparent: true, opacity: 0.25 });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    let frame;
    const animate = () => {
      stars.rotation.y += 0.0005;
      stars.rotation.x += 0.00015;
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
        <div className="brand-mark"><Atom size={16} /></div>
        <div>
          <h1>NEXUS</h1>
          <span>autonomous strategic operating system</span>
        </div>
      </div>
      <div className="top-actions">
        <div className={`status-pill ${currentStatus.class}`}>
          <span className={`status-dot ${currentStatus.class}`} />
          {currentStatus.label}
        </div>
        <button className="icon-btn" aria-label="Lock"><Lock size={18} /></button>
      </div>
    </header>
  );
}

function Sidebar() {
  const items = [
    ['Command Console', Radar],
    ['Agent Mesh', Network],
    ['Knowledge Graph', GitBranch],
    ['Memory Fabric', DatabaseZap],
    ['System Security', ShieldAlert]
  ];
  return (
    <aside className="sidebar">
      {items.map(([label, Icon], index) => (
        <button className={index === 0 ? 'side-item active' : 'side-item'} key={label} data-tooltip={label}>
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}
    </aside>
  );
}

function MissionConsole({ mission, setMission, mode, setMode, sessions, loadSession, runMission, startDemo, running, onCompare }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runMission();
    }
  };

  return (
    <section className="panel mission-console">
      <div className="panel-title">
        <div><Radar size={16} /> Command Interface</div>
        <span>superhuman portal</span>
      </div>
      
      <label>What strategic problem are you trying to solve?</label>
      
      <div className="command-bar-wrapper">
        <textarea 
          value={mission} 
          onChange={(event) => setMission(event.target.value)} 
          onKeyDown={handleKeyDown}
          placeholder="E.g., Design a scalable multi-agent SaaS platform..."
          disabled={running}
        />
        <div className="command-shortcut">Ctrl + Enter</div>
      </div>

      <div className="compact-modes">
        {missionModes.map((item) => (
          <button 
            className={mode === item ? 'selected' : ''} 
            key={item} 
            onClick={() => setMode(item)}
            disabled={running}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="chips-row">
        <span>Presets</span>
        <div className="chips-container">
          {demoMissions.map((item) => (
            <button 
              key={item} 
              onClick={() => setMission(item)}
              disabled={running}
              title={item}
            >
              {item.replace(/\.$/, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="command-actions">
        <button className="primary-btn" onClick={() => runMission()} disabled={running || !mission.trim()}>
          {running ? <Pause size={14} /> : <Play size={14} />}
          {running ? 'Running...' : 'Initiate Operation'}
        </button>
        <button className="secondary-btn" onClick={startDemo} disabled={running}>
          <Sparkles size={14} /> Demo Run
        </button>
        <button className="secondary-btn" onClick={onCompare}>
          <GitBranch size={14} /> Compare Plans
        </button>
      </div>

      <div className="history-strip">
        <label>History</label>
        <div className="history-list">
          {Array.isArray(sessions) && sessions.length ? sessions.slice(0, 3).map((session) => (
            <button className="history-item" key={session.id} onClick={() => loadSession(session)}>
              {session.mode}: {session.mission}
            </button>
          )) : <em style={{ fontSize: '10px', color: 'var(--text-muted)' }}>No prior operations logged.</em>}
        </div>
      </div>
    </section>
  );
}

function CollaborativeReasoningFeed({ feed, running, activeAgent, onAgentClick }) {
  const agentLogMap = {
    orchestrator: { label: 'Orchestrator', text: 'Decomposing mission parameters and initializing mesh...' },
    researcher: { label: 'Researcher', text: 'Scanning market signals and competitive vulnerabilities...' },
    architect: { label: 'Architect', text: 'Modeling product blueprints, workflows, and supervision locks...' },
    strategist: { label: 'Strategist', text: 'Formulating pricing, retention loops, and wedge GTM path...' },
    critic: { label: 'Critic', text: 'Stress-testing assumptions and identifying operational risks...' },
    memory: { label: 'Memory Fabric', text: 'Indexing strategic conclusions and updating durable memory...' }
  };

  const order = ['orchestrator', 'researcher', 'architect', 'strategist', 'critic', 'memory'];
  const activeIndex = order.indexOf(activeAgent);

  return (
    <section className="panel reasoning-feed-panel">
      <div className="panel-title">
        <div><Activity size={16} /> Collaborative Reasoning Feed</div>
        <span>{running ? 'thinking' : 'idle'}</span>
      </div>
      <div className="reasoning-list">
        {order.map((agentKey, idx) => {
          const isStarted = running ? idx <= activeIndex : activeIndex >= 0;
          if (!isStarted) return null;

          const config = agentLogMap[agentKey];
          const isActive = activeAgent === agentKey && running;
          const actualFeedItem = feed.find(item => item.agent === agentKey);
          const text = actualFeedItem ? actualFeedItem.text : config.text;

          return (
            <div 
              className={`reasoning-item ${isActive ? 'active' : ''}`} 
              key={agentKey}
              onClick={() => onAgentClick(agentKey)}
              style={{ cursor: 'pointer' }}
            >
              <div className="reasoning-header">
                <span className="reasoning-dot" />
                <span className="reasoning-agent" style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {config.label}
                </span>
              </div>
              <p className="reasoning-text">{text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StrategicCanvas({ activeAgent, running }) {
  const stages = [
    { key: 'orchestrator', label: 'MISSION' },
    { key: 'researcher', label: 'RESEARCH' },
    { key: 'architect', label: 'ARCHITECTURE' },
    { key: 'strategist', label: 'STRATEGY' },
    { key: 'critic', label: 'CRITIQUE' },
    { key: 'memory', label: 'DECISION' }
  ];

  const activeIndex = stages.findIndex(s => s.key === activeAgent);
  
  return (
    <section className="canvas-bar">
      {stages.map((stage, idx) => {
        const isActive = activeAgent === stage.key && running;
        const isCompleted = idx < activeIndex || (!running && activeIndex >= 0);
        return (
          <React.Fragment key={stage.key}>
            <div className={`canvas-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
              <span className="canvas-indicator" />
              <span>{stage.label}</span>
            </div>
            {idx < stages.length - 1 && <span className="canvas-arrow">→</span>}
          </React.Fragment>
        );
      })}
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
    <div className="debate-feed" style={{ overflowY: 'auto', height: '100%' }}>
      {lines.slice(0, 3).map((line, index) => (
        <div className={line.agent === 'Critic' ? 'debate-bubble critic' : 'debate-bubble strategist'} key={`${line.agent}-${index}`}>
          <strong>{line.agent}</strong>
          <p>{line.text}</p>
        </div>
      ))}
    </div>
  );
}

function MemoryPanel({ memory }) {
  return (
    <div className="memory-feed" style={{ overflowY: 'auto', height: '100%' }}>
      {memory.map((item, index) => (
        <div className="memory-item" key={`${item}-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Eye size={13} style={{ flexShrink: 0, color: 'var(--accent)' }} />
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
        <button className={activeTab === 'feed' ? 'active' : ''} onClick={() => setActiveTab('feed')}>
          <Terminal size={14} /> Feed
        </button>
        <button className={activeTab === 'debate' ? 'active' : ''} onClick={() => setActiveTab('debate')}>
          <ShieldAlert size={14} /> Debate
        </button>
        <button className={activeTab === 'memory' ? 'active' : ''} onClick={() => setActiveTab('memory')}>
          <DatabaseZap size={14} /> Memory
        </button>
        <button className={activeTab === 'timeline' ? 'active' : ''} onClick={() => setActiveTab('timeline')}>
          <Orbit size={14} /> Timeline
        </button>
      </div>
      <div className="tab-content" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'feed' && <LiveTerminal feed={engine.feed} />}
        {activeTab === 'debate' && <DebatePanel running={engine.running} debate={engine.debate} />}
        {activeTab === 'memory' && <MemoryPanel memory={engine.memory} />}
        {activeTab === 'timeline' && <Timeline events={engine.events} running={engine.running} />}
      </div>
    </section>
  );
}

function MissionOutput({ report, mission, mode, runMission, running, decisionStatus, acceptDecision, challengeDecision, memory }) {
  const [refinementText, setRefinementText] = useState('');
  const [checkedTasks, setCheckedTasks] = useState({});

  const toggleTask = (idx) => {
    setCheckedTasks(current => ({
      ...current,
      [idx]: !current[idx]
    }));
  };

  const handleRefineSubmit = () => {
    if (!refinementText.trim()) return;
    runMission(mission, mode, { refinement: refinementText });
    setRefinementText('');
  };

  const exportReport = () => {
    if (!report) return;
    let md = `# NEXUS Strategic Directive\n\n`;
    md += `**Mission:** ${mission}\n`;
    md += `**Mode:** ${mode}\n`;
    md += `**Recommended Decision:** ${report.decision}\n`;
    md += `**Confidence Score:** ${report.confidence}%\n\n`;
    md += `## Directive\n\n`;
    report.sections.forEach(sec => {
      md += `### ${sec.label}\n`;
      md += `${sec.text}\n\n`;
    });
    md += `## Next Actions\n\n`;
    report.tasks.forEach((task, idx) => {
      const isChecked = checkedTasks[idx] ? '[x]' : '[ ]';
      md += `${isChecked} ${task}\n`;
    });
    md += `\n---\n*Generated by NEXUS AI-native Strategic Workflow Platform*\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEXUS-Strategic-Directive.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report) {
    return (
      <section className="output-workspace panel">
        <div className="panel-title">
          <div><Sparkles size={16} /> Strategic Directive</div>
          <span>Awaiting Intake</span>
        </div>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          {running ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div className="blinking-log" style={{ fontFamily: 'monospace' }}>COMPILING STRATEGIC DIRECTIVE...</div>
              <div style={{ width: '120px', height: '2px', background: 'var(--border)', position: 'relative', overflow: 'hidden' }}>
                <motion.div 
                  style={{ height: '100%', background: 'var(--accent)', width: '30%' }} 
                  animate={{ x: [-40, 120] }} 
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>
          ) : (
            'Initiate mission parameters to compile McKinsey Strategic Brief.'
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="output-workspace">
      <div className="sheet">
        <div className="sheet-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 className="sheet-title">NEXUS Strategic Directive</h2>
            <button className="secondary-btn" onClick={exportReport} style={{ height: '26px', fontSize: '10px' }}>
              <Zap size={12} /> Export Directive (.md)
            </button>
          </div>
          <div className="sheet-metadata">
            <div>SECURE ID: NXS-8942-A</div>
            <div>LATENCY: 1.42s</div>
            <div>SEED: 0x9f32e</div>
            <div>OPERATIONAL CONFIDENCE: {report.confidence}%</div>
          </div>
        </div>

        {/* Recommended Decision Block with Lock Buttons */}
        <div className={`decision-banner ${decisionStatus}`}>
          <div className="decision-title-row">
            <span className="decision-label">RECOMMENDED DECISION</span>
            <span className="decision-confidence">Confidence: {report.confidence}%</span>
          </div>
          <p className="decision-text">{report.decision}</p>
          <p className="decision-rationale"><strong>Rationale:</strong> {report.rationale}</p>
          
          {decisionStatus === 'pending' ? (
            <div className="decision-actions">
              <button className="btn-accept" onClick={acceptDecision}>Accept Decision</button>
              <button className="btn-challenge" onClick={challengeDecision}>Challenge Decision</button>
            </div>
          ) : (
            <span className={`decision-status-tag ${decisionStatus}`}>
              Decision {decisionStatus}
            </span>
          )}
        </div>

        {/* Document Body */}
        <div className="document-body">
          {report.sections.map((section, idx) => {
            const memoryIndex = idx;
            const hasMemory = memory[memoryIndex];
            return (
              <div className="doc-section" key={section.label}>
                <h3>{section.label}</h3>
                <p>
                  {section.text}
                  {hasMemory && (
                    <span className="citation">
                      {memoryIndex + 1}
                      <span className="citation-tooltip">
                        <strong>Recalled Principle:</strong> {memory[memoryIndex]}
                      </span>
                    </span>
                  )}
                </p>
              </div>
            );
          })}

          {/* Next Actions Interactive Checklist */}
          {report.tasks && report.tasks.length > 0 && (
            <div className="doc-section">
              <h3>Next Actions</h3>
              <div className="task-list">
                {report.tasks.map((task, idx) => {
                  const isChecked = !!checkedTasks[idx];
                  return (
                    <div 
                      className={`task-item ${isChecked ? 'checked' : ''}`} 
                      key={idx}
                      onClick={() => toggleTask(idx)}
                    >
                      <div className={`task-checkbox ${isChecked ? 'checked' : ''}`}>
                        {isChecked && <Zap size={10} />}
                      </div>
                      <span>{task}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Refinement input */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={refinementText} 
              onChange={e => setRefinementText(e.target.value)}
              placeholder="Inject strategic constraint or vector refinement..." 
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '4px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#ffffff'
              }}
              onKeyDown={e => e.key === 'Enter' && handleRefineSubmit()}
            />
            <button className="secondary-btn" onClick={handleRefineSubmit} style={{ height: '34px' }}>
              Refine Plan
            </button>
          </div>
        </div>
      </div>
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

  const leftSections = leftSession?.report?.sections || [];
  const rightSections = rightSession?.report?.sections || [];

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
                <td>{leftSession?.mission}</td>
                <td>{rightSession?.mission}</td>
              </tr>
              <tr>
                <td><strong>Mode</strong></td>
                <td>{leftSession?.mode}</td>
                <td>{rightSession?.mode}</td>
              </tr>
              <tr>
                <td><strong>Confidence</strong></td>
                <td><span className="conf-value">{leftSession?.report?.confidence || 90}%</span></td>
                <td><span className="conf-value">{rightSession?.report?.confidence || 90}%</span></td>
              </tr>
              {leftSections.map((sec, idx) => {
                const rightSec = rightSections[idx] || {};
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
          <CollaborativeReasoningFeed 
            feed={engine.feed} 
            running={engine.running} 
            activeAgent={engine.activeAgent} 
            onAgentClick={(agentId) => {
              const agentObj = agents.find(a => a.id === agentId);
              if (agentObj) setTraceAgent(agentObj);
            }}
          />
        </div>
        <div className="center-column">
          <StrategicCanvas activeAgent={engine.activeAgent} running={engine.running} />
          <MissionOutput 
            report={engine.report} 
            mission={engine.mission} 
            mode={engine.mode} 
            runMission={engine.runMission} 
            running={engine.running}
            decisionStatus={engine.decisionStatus}
            acceptDecision={engine.acceptDecision}
            challengeDecision={engine.challengeDecision}
            memory={engine.memory}
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
