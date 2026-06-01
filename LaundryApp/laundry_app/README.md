# GSS Laundry

Android-only Flutter client for GSS laundry desk operations.

This app mirrors the Laundry web workspace while using the Bike app shell: secure sign-in, two-factor device verification, camp selection, realtime refresh, notification registration, RFID lookup, Android update handoff, and operational bag management.

## Features

- Login and remembered authenticated session with token refresh.
- Camp picker before entering the workspace and searchable camp selection in Settings.
- Overview cards for total, available, drop-off, laundry facility, ready to pick up, and in-soldier bags.
- Separate operational sections for Drop-off bags, Laundry facility bags, and Ready to pick up bags.
- Full Bags and status sections with column search, table paging, sorting, add/edit/delete actions, and status handoff actions based on permissions.
- RFID lookup for laundry bags through the handheld reader hardware.
- Pull-to-refresh, offline cached GET responses, Firebase notification token registration, and Android APK update flow.

## Configuration

Set the backend base URL when building or running the Android app:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000
```

For release builds, pass the same define:

```bash
flutter build apk --dart-define=API_BASE_URL=https://your-gss-server.example.com
```

## Structure

- `lib/main.dart` starts the app and wires the session, API client, notifications, and update services.
- `lib/src/screens` contains login, camp selection, and laundry operations screens.
- `lib/src/services` contains API, cache, session, notification, and update integrations.
- `lib/src/models` contains API response, auth token, and laundry domain models.
- `lib/src/theme` contains the Bike-style application theme.
- `test` contains model and utility coverage mirroring the Bike app test layout.

## Android Only

The application is intended for Android devices only. Platform-specific code and permissions live under `android/`, including RFID reader integration, notifications, file provider support, and APK install handoff.

## Verification

The expected verification commands are the same style as the Bike app:

```bash
flutter analyze
flutter test
```

These commands should be run from this directory when Flutter execution is allowed.
