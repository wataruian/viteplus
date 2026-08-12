# Persistent Memory & Decision Log

This file acts as a chronological ledger for major architectural shifts, context updates, and monorepo conventions.

## 2026-08-12: Migration to Mise Tasks

- **Decision**: Migrated loose root-level bash scripts (`check.sh`, `clean.sh`, `create.sh`, `init.sh`, `start.sh`) into `.mise/tasks/`.
- **Reasoning**: `mise` provides a standardized, discoverable, and self-documenting interface for high-level repository automation.
- **Impact**: All high-level interactions should now use `mise run <task>`.

## 2026-08-12: Backend Framework Update

- **Decision**: Removed `vite-plugin-node` from the backend setup.
- **Reasoning**: Shifted to a standard Node.js Express API structure to simplify the backend runtime and decouple it from Vite-specific server plugins.

## 2026-08-12: Establishing `.ai-data`

- **Decision**: Designated `.ai-data` as the persistent, version-controlled knowledge base for all AI interactions and architectural context.
- **Structure**: Core knowledge is stored directly in `.ai-data/`, while temporary agent scratchpads, outputs, and generated artifacts are routed to `.ai-data/artifacts/` (which is `.gitignore`d).
