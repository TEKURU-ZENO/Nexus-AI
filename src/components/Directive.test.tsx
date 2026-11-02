import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RunDetail } from '../api/client';
import { emptyView } from '../lib/runView';
import { useMission } from '../store/missionStore';
import { DirectiveView } from './Directive';

const run = (simulated: boolean): RunDetail => ({
  id: 'abcdef1234',
  mission: 'Open a bakery in Lisbon',
  mode: 'Startup Validation',
  project: 'default',
  status: 'succeeded',
  decision_status: 'pending',
  confidence: 31,
  simulated,
  created_at: '2026-01-01T00:00:00Z',
  finished_at: '2026-01-01T00:00:05Z',
  usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0.001, llm_calls: 3 },
  providers: simulated ? ['simulator'] : ['openai'],
  prompt_versions: {},
  result: {
    reports: {},
    critiques: [],
    rebuttals: [],
    memory_used: [],
    safety_flags: [],
    confidence: {
      score: 31,
      finding_confidence: 0.6,
      evidence_coverage: 0,
      agreement: 0.7,
      critic_penalty: 0.5,
      unresolved_penalty: 0.04,
      simulated,
      explanation: 'claims 60% avg; 0% externally grounded.',
    },
    directive: {
      title: 'Bakery directive',
      decision: 'Run a two-week pop-up pilot',
      rationale: 'Cheap validation',
      tradeoffs: ['Slower'],
      phases: [{ name: 'Validate', goal: 'Prove demand', actions: ['Interview 10 locals'], exit_criteria: '50 pre-orders' }],
      kpis: [{ name: 'Pre-orders', target: '50', measurement: 'Form' }],
      risks: [{ risk: 'Low footfall', severity: 'high', owner: 'Founder', mitigation: 'Pick a market stall' }],
      next_actions: ['Book a market stall'],
    },
  },
});

describe('DirectiveView', () => {
  beforeEach(() => useMission.setState({ running: false, view: emptyView() }));

  it('renders decision, computed confidence, tables and decision actions', () => {
    useMission.setState({ run: run(false) });
    render(<DirectiveView />);
    expect(screen.getByText('Run a two-week pop-up pilot')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
    expect(document.querySelector('.confidence-score')).toHaveTextContent('Confidence 31/100');
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled();
    expect(screen.queryByText(/Simulated output/)).not.toBeInTheDocument();
  });

  it('warns clearly when output is simulated', () => {
    useMission.setState({ run: run(true) });
    render(<DirectiveView />);
    expect(screen.getByRole('note')).toHaveTextContent('Simulated output');
  });
});
