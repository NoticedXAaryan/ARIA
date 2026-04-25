# ARIA Agent Playbook

This file is the first stop for any coding agent opening this repository.

## Mission

Build ARIA into a proactive, local-first assistant that:
- learns user behavior patterns,
- fuses context every 15 minutes,
- surfaces high-value nudges at the right moment,
- improves from user feedback over time.

## Source of Truth (Read in this order)

1. `ARIA_PRD.md` - full requirements and architecture contract.
2. `ARIA_WORKFLOW_CHECKLIST.md` - current implementation and test status.
3. `projectDiscription.md` - product framing, interfaces, UX behavior.
4. `README.md` - quick start and commands.
5. `docs/api-reference.md`, `docs/architecture.md`, `docs/setup-guide.md`.

## Current Scope (v1)

- Local daemon + scheduler + ingestion + rules-based nudges.
- Desktop tray popup as primary interaction surface.
- Dashboard for review/settings.
- Mobile companion for away-from-desk actions (optional).
- Privacy-first: mostly on-device, no paid dependency requirement.

## What Is Already Implemented

- Backend scaffold: connectors, storage, engine, scheduler, API.
- SQLite schema + nudge logging + settings + tasks.
- Basic behavior model and memory scaffolding.
- Desktop and mobile app scaffolds.
- Basic backend tests and build checks.

Check exact done/partial/pending status in `ARIA_WORKFLOW_CHECKLIST.md`.

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
