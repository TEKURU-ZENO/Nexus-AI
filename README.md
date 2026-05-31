# NEXUS

An autonomous multi-agent intelligence operating system prototype built for a cinematic hackathon demo.

## Run

```bash
npm install
python -m pip install -r server/requirements.txt
```

In one terminal:

```bash
npm run dev:server
```

In another terminal:

```bash
npm run dev
```

Add `OPENAI_API_KEY` to `server/.env` to enable real Responses API agent calls. Without a key, the backend still streams deterministic demo cognition so the presentation remains stable.

## Demo Mission

Use:

> Design an AI startup to reduce hospital misdiagnosis.

NEXUS will simulate a live cognitive mesh with agent activation, streaming analysis, debate, dynamic graph updates, persistent memory traces, and a unified strategic directive.

## Strategic Workflow Focus

The MVP is now optimized around Strategic Product Planning. Mission modes include Strategic Planning, Startup Validation, Technical Architecture, Risk Analysis, and Product Roadmapping.

Generated directives include risk levels, reasoning, recommendations, agent debate, and local session history so prior cognition traces can be reopened.

## Checkpoint Assets

- `docs/product-brief.md`
- `docs/investor-one-pager.md`
- `docs/user-flow.md`
- `docs/demo-script.md`
- `docs/landing-page-structure.md`
- `docs/screenshot-pack.md`
- `docs/public-perception-posts.md`

---

## Codex / Antigravity Implementation Attribution (20 Points Criterion)

NEXUS was developed in collaboration with Codex (using the Antigravity developer agent) to build, configure, and secure the platform. Codex facilitated:

1. **Mono-Repo Vercel Deployment Scaffolding**: Designed the unified `vercel.json` routing matrix, linking static React/Vite builds and Python serverless functions under a single `/api` mapping.
2. **Local Development Proxy Routing**: Configured the `vite.config.js` proxy routing rules to map `/api` to localhost ports, eliminating environment branching bugs and localhost hardcoding.
3. **Sequential Chain-of-Thought Pipeline**: Engineered the downstream agent prompts in `server/services/mission_service.py` to propagate context, transforming isolated agent runs into a collaborative multi-agent mesh.
4. **Resilient Fail-Safe Error Interceptor**: Created stream interceptors to detect OpenAI API warning/quota failures, triggering high-fidelity simulation fallback states dynamically.
5. **Interactive UI Features**: Assisted in constructing components for deep-dive cognitive traces, side-by-side plan comparison, and user refinement feedback loops.

