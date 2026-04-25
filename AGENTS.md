# ARIA Agent Playbook

This file is the first stop for any coding agent opening this repository.

## Mission

Build ARIA into a proactive, local-first assistant that:
- learns user behavior patterns,
- fuses context every 15 minutes,
- surfaces high-value nudges at the right moment,
- improves from user feedback over time.

## Source of Truth (Read in this order)

1. `ARIA_PRD.md` — full requirements and architecture contract.
2. `ARIA_WORKFLOW_CHECKLIST.md` — current implementation status, phase-by-phase.
3. `README.md` — orientation, quick start, documentation map.
4. `docs/architecture.md` — system architecture with file-to-layer mapping.
5. `docs/api-reference.md` — REST + WebSocket endpoint schemas.
6. `docs/setup-guide.md` — full installation walkthrough.

## Current Scope (v1)

- Local daemon + scheduler + ingestion + rules-based nudges.
- Desktop tray popup as primary interaction surface.
- Dashboard for review/settings.
- Mobile companion for away-from-desk actions (optional).
- Privacy-first: mostly on-device, no paid dependency requirement.

## Default Working Loop for Agents

1. Read `ARIA_WORKFLOW_CHECKLIST.md` and pick highest-priority unchecked items.
2. Implement in small, testable increments.
3. Run verification commands:
   - `pytest aria-backend/tests -q`
   - `cd aria-desktop && npm run build`
   - `cd aria-mobile && npx expo export --platform android --output-dir dist-test`
4. Update docs/checklist to reflect real state after changes.

## Priority Order for Next Work

1. Phase 5 reliability gap: queue lifecycle, re-eval, expiry, fallback.
2. Tests for queue/fallback/interrupt edge-cases.
3. Tray popup parity with UX spec (countdown, snooze variants, ignored logging).
4. Mobile pairing + feedback sync parity.
5. CI workflow that runs backend + desktop + mobile checks.

## Guardrails

- Do not introduce paid dependencies.
- Keep APIs local-first and privacy-safe.
- Treat `ARIA_PRD.md` as requirements contract.
- If a feature conflicts with PRD, follow PRD and note mismatch.
- Keep docs in sync with implementation changes.
