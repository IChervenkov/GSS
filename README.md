# GSS

GSS is an operations platform for managing bicycles, assets, and laundry workflows across multiple camps. This repository contains the TypeScript web/API service, three Flutter mobile clients, an NFC reader utility, deployment tooling, and operational documentation.

## Repository layout

| Path | Purpose |
| --- | --- |
| `MainJavaProject/` | Express 5 and TypeScript web/API service, server-rendered workspaces, tests, migrations, and operations tooling |
| `BikeApp/bike_app/` | Flutter client for bicycle and helmet rental operations |
| `InventoryApp/inventory_app/` | Android Flutter client for asset inventory and RFID-assisted room checks |
| `LaundryApp/laundry_app/` | Android Flutter client for laundry bag tracking and handoff workflows |
| `NFC Chips Reader/` | Python utility that reads NFC card UIDs and types them into the active application |

The mobile clients share the backend's authentication, camp selection, permissions, realtime updates, notifications, RFID lookup, and Android update services.

## Prerequisites

For the backend:

- Node.js 24
- npm
- Docker with Docker Compose (recommended for PostgreSQL and Redis)

For mobile development:

- Flutter 3.38.4 or newer with Dart 3.11
- Android Studio and an Android SDK for Android builds

The NFC utility additionally requires Python, a PC/SC-compatible reader (the implementation uses the ACR122U UID command), and the `pyscard`, `pyautogui`, and `keyboard` packages.

## Backend quick start

Run these commands from `MainJavaProject/`:

```powershell
npm ci
Copy-Item .env.example .env
npm run infra:up
npm run db:migrate
npm run dev
```

Before starting the service, replace every placeholder secret and review the database settings in `.env`. The default local service URL is `http://localhost:3000`.

`npm run infra:up` starts PostgreSQL and Redis through Docker Compose. To stop them, run:

```powershell
npm run infra:down
```

### Useful backend commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the application |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm run lint` | Run repository lint and CSP hygiene checks |
| `npm test` | Run unit, integration, realtime, end-to-end, smoke, and coverage-map checks |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:schema-doc` | Regenerate the database schema documentation |
| `npm run security:secret-scan` | Scan tracked source for secrets |
| `npm run security:dependency-audit` | Run the dependency audit policy |

## Mobile clients

Install dependencies and run commands from the selected Flutter project directory.

### Bike

```powershell
Set-Location BikeApp\bike_app
flutter pub get
flutter run --dart-define GSS_API_URL=http://10.0.2.2:3000
```

### Inventory

```powershell
Set-Location InventoryApp\inventory_app
flutter pub get
flutter run --dart-define=GSS_API_URL=http://10.0.2.2:3000
```

### Laundry

```powershell
Set-Location LaundryApp\laundry_app
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

`10.0.2.2` routes an Android emulator to a backend running on the host machine. For a physical device, use an address that the device can reach. Keep the configuration key shown for each app; the Laundry client currently uses `API_BASE_URL`, while Bike and Inventory use `GSS_API_URL`.

Verify any mobile client with:

```powershell
flutter analyze
flutter test
```

More client-specific details are available in the [Bike](BikeApp/bike_app/README.md), [Inventory](InventoryApp/inventory_app/README.md), and [Laundry](LaundryApp/laundry_app/README.md) READMEs.

## NFC reader utility

From `NFC Chips Reader/`, install the Python dependencies and start the reader:

```powershell
python -m pip install pyscard pyautogui keyboard
python main.py
```

The utility polls the first available reader and types a detected card UID at the current cursor position. Press `Ctrl+Shift+Alt+S` to stop scanning.

## Containers and operations

The backend includes Docker-based local and production profiles, environment-specific Compose files, database backup/restore scripts, and a Prometheus/Grafana/Alertmanager observability stack.

- [Deployment runbook](MainJavaProject/ops/runbooks/deployment.md)
- [Backup and restore runbook](MainJavaProject/ops/runbooks/backup-restore.md)
- [Observability guide](MainJavaProject/ops/observability/README.md)
- [Database schema](MainJavaProject/docs/database/schema.md)
- [Engineering governance](MainJavaProject/docs/governance/README.md)

Never commit `.env`, production secrets, database data, or locally generated build artifacts.
