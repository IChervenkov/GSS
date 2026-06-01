# GSS observability stack

This stack wires the service metrics endpoint into Prometheus, Grafana, and Alertmanager.

## Included

- Prometheus scrape config for the GSS app
- Alert rules for repeated 500s, auth spikes, DB pool pressure, Redis readiness, high latency, and socket instability
- Grafana provisioning with five dashboards:
  - Auth
  - Traffic
  - System Errors
  - Business Critical Actions
  - WebSocket Activity

## Quick start

1. Copy `ops/observability/.env.example` to `ops/observability/.env` and adjust values.
2. Start the app with `/metrics` enabled.
3. Run `npm run ops:up`.
4. Open Grafana on port `3001` and Prometheus on port `9090`.

## Production notes

- Set `OBSERVABILITY_METRICS_AUTH_TOKEN` in the app and set `GSS_METRICS_TOKEN` in the observability `.env` to the same raw token value. Prometheus adds the `Bearer` authorization scheme when scraping.
- Restrict access to Grafana, Prometheus, and Alertmanager at the network level.
- In Kubernetes or a VM environment, replace `host.docker.internal` with the real service DNS name.
