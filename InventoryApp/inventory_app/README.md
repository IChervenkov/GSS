# GSS Inventory

Android-only Flutter client for GSS asset inventory operations.

This app mirrors the Laundry mobile architecture: secure sign-in, two-factor device verification, camp selection, realtime refresh, notification registration, RFID lookup, Android update handoff, and operational asset management.

## Features

- Login and remembered authenticated session with token refresh.
- Camp picker in Overview and searchable camp selection in Settings.
- Overview cards for total assets, quantity, completed inventory, and not-found assets.
- Full Assets section with column search, table paging, sorting, add/edit/delete actions, and permission-aware controls.
- Inventory by room: choose a location room, review expected assets, scan RFID tags, and mark assets completed.
- RFID power settings, pull-to-refresh, offline cached GET responses, Firebase notification token registration, and Android APK update flow.

## Configuration

Set the backend base URL when building or running the Android app:

```bash
flutter run --dart-define=GSS_API_URL=http://192.168.1.10:3000
```

For release builds, pass the same define:

```bash
flutter build apk --dart-define=GSS_API_URL=https://your-gss-server.example.com
```

## Structure

- `lib/main.dart` starts the app and wires the session, API client, notifications, and update services.
- `android/` contains the only generated platform runner, including RFID reader integration, notifications, file provider support, and APK install handoff.
- `lib/src/screens` contains login and inventory operations screens.
- `lib/src/services` contains API, cache, session, socket, notification, and native bridge integrations.
- `lib/src/models` contains API response, auth token, and inventory domain models.
- `lib/src/widgets` contains shared app surfaces, status chips, and searchable pickers.
- `test` contains model and utility coverage matching the Laundry app style.

## Expected Mobile API

The app is written against the mobile API namespace `/api/inventory-app` with endpoints for camps, permissions, overview, RFID lookup, asset CRUD, inventory scanning, notifications, version checks, and APK download.

## Verification

Run these from this directory when Flutter execution is allowed:

```bash
flutter analyze
flutter test
```
