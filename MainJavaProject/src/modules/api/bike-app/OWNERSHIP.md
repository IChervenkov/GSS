# API Bike App Module Ownership

The `src/modules/api/bike-app` module owns the authenticated mobile API used by the Flutter `bike_app`.

It may adapt mobile request/response contracts, but bicycle domain rules, permission checks for mutations, audit logging, and realtime side effects should continue to live in the web bicycles application service unless a separate shared bicycles module is introduced.
