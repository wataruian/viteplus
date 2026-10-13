# Monorepo Architecture

This document provides a comprehensive overview of the `@lightproject/monorepo` architecture.

## High-Level Structure

The repository is structured as a **Vite+-powered Monorepo**.

- **`apps/`**: Contains deployable units of the system.
  - **`backend`**: Hono API — a Fetch-API/WinterCG-compatible framework (`app.fetch`). The
    portable core (`src/app.ts`) has no runtime-specific dependencies; `src/runtimes/` holds the
    thin adapters that run it: `node.ts` (local dev via `@hono/node-server`) and `edge.ts` (the
    `wrangler.toml` entry, deployed to Cloudflare Workers). Node-specific APIs are intentionally
    confined to `runtimes/node.ts` and build/test tooling.
  - **`frontend`**: Modern SPA built with React and Vite.
- **`packages/`**: Shared internal libraries and utilities.
  - **`common`**: The foundational library providing isomorphic environment management and structured logging.
    Entry points (`@lightproject/common/<dir>`) are split by runtime: `browser` (Faro RUM —
    frontend only), `server` (OpenTelemetry SDK setup, `/metrics`, flush/shutdown — backend only),
    `node` (Node-only fs helpers), and isomorphic `utils`, `logger`, `environment`, `configs`,
    `validators`, `typecast`. Browser code must not import `server`/`node`, and server code must
    not import `browser`.
  - **`design-system`**: Shared UI component library using UnoCSS and React.
  - **`library`**: General purpose shared library templates.
- **`bak/`**: Intentionally tracked archive of earlier app/library setups, kept for future reuse.
  Not a workspace member; excluded from lint/format, Sonar, and CodeQL. Not a cleanup/TODO item —
  do not propose removing it from Git.

## Observability Stack

A full Grafana LGTM stack is configured via `docker-compose.yml` for local telemetry and observability:

- **Grafana** (Port 3300): Dashboards and visualization.
- **Loki** (Port 3100): Log aggregation.
- **Tempo** (Port 3200): Distributed tracing.
- **Mimir** (Ports 9009/9095): Metrics storage.
- **OpenTelemetry Collector** (Ports 4317/4318): Ingestion point for all traces, metrics, and logs.

_Backend services must emit their telemetry data to the OpenTelemetry Collector._

### Metrics model

- **One stream per SDK instance**: backend Worker isolates/Node processes and frontend browser tabs each
  set a lazily generated `service.instance.id` (OTel single-writer principle). OTLP metric exporters
  use **delta** temporality; the collector's `deltatocumulative` processor (`max_stale: 5m`) turns
  each instance's deltas into a cumulative series for Mimir. Without a per-instance identity,
  concurrent writers' overlapping deltas are silently dropped (verified on otelcol-contrib 0.131.0).
- **Query across instances**: `sum without (instance, service_instance_id) (rate(<counter>_total[5m]))`.
- **Samples are intentional** (starter demos of the Counter API and duration gauges): backend
  `request_hits` + `http_server_duration_seconds`, frontend `button_clicks` +
  `http_client_duration_seconds`.
- **Cost / scaling**: series churn tracks recently active instances (≈ concurrent visitors), not total
  page views. At high browser traffic, switch frontend metrics to collector-derived metrics
  (`spanmetrics`/`count` connectors over browser spans/events), with the collector as single writer.

### Redaction

- App-side: `@lightproject/common/logger` — `redact` (JSON-shaped serialization + key masking,
  fail-closed) and `redactUrl` (userinfo, sensitive query/fragment params, JSON-valued params).
- Collector: `transform/redact-urls` (traces + logs pipelines, `error_mode: propagate`) covers every
  producer, including browser/Faro spans the app code never touches.
