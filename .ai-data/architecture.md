# Monorepo Architecture

This document provides a comprehensive overview of the `@lightproject/monorepo` architecture.

## High-Level Structure

The repository is structured as a **Vite+-powered Monorepo**.

- **`apps/`**: Contains deployable units of the system.
  - **`backend`**: Node.js Express API.
  - **`frontend`**: Modern SPA built with React and Vite.
- **`packages/`**: Shared internal libraries and utilities.
  - **`common`**: The foundational library providing isomorphic environment management and structured logging.
  - **`design-system`**: Shared UI component library using UnoCSS and React.
  - **`library`**: General purpose shared library templates.

## Observability Stack

A full Grafana LGTM stack is configured via `docker-compose.yml` for local telemetry and observability:

- **Grafana** (Port 3300): Dashboards and visualization.
- **Loki** (Port 3100): Log aggregation.
- **Tempo** (Port 3200): Distributed tracing.
- **Mimir** (Ports 9009/9095): Metrics storage.
- **OpenTelemetry Collector** (Ports 4317/4318): Ingestion point for all traces, metrics, and logs.

_Backend services must emit their telemetry data to the OpenTelemetry Collector._
