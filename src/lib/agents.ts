export type AgentId =
  'orchestrator' | 'researcher' | 'architect' | 'strategist' | 'critic' | 'judge' | 'synthesizer' | 'memory' | 'system';

/** Visual metadata only; names/roles/prompt versions come from GET /api/v1/agents. */
export const STAGES: { id: AgentId; label: string }[] = [
  { id: 'orchestrator', label: 'Plan' },
  { id: 'researcher', label: 'Research' },
  { id: 'architect', label: 'Architecture' },
  { id: 'strategist', label: 'Strategy' },
  { id: 'critic', label: 'Debate' },
  { id: 'synthesizer', label: 'Directive' },
];

export const MISSION_MODES = [
  'Strategic Planning',
  'Startup Validation',
  'Technical Architecture',
  'Risk Analysis',
  'Product Roadmapping',
] as const;

export const PRESET_MISSIONS = [
  'Design an AI-native healthcare platform for reducing diagnostic errors.',
  'Build a response strategy for an enterprise ransomware attack.',
  'Create a sustainable AI-driven public transportation model for megacities.',
  'Launch an AI education copilot for rural schools.',
];
