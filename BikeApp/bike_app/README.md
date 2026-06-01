# GSS Bike

Flutter client for GSS bicycle operations.

## Features

- Login, 2FA verification, JWT access tokens, refresh-token rotation, and logout.
- Secure token/device storage via `flutter_secure_storage`.
- Laundry-style mobile shell with app bar actions, bottom navigation, camp status header, summary cards, and an Overview section.
- Overview cards for active rentals and available share.
- Bicycle and helmet add, edit, delete, column search, sorting, pagination, NFC lookup, rent, repair, and return workflows.
- Soldier search for assignment workflows.
- Camp selection with searchable picker and realtime camp updates.
- Socket.IO realtime refreshes from the `ui:bicycle:list` room.
- Android update handoff and late-bike notifications.

## Configuration

The API base URL is build-time configuration and is not shown on the sign-in screen.

```powershell
flutter run --dart-define GSS_API_URL=http://localhost:3000
```

For the Android emulator, use the host bridge:

```powershell
flutter run --dart-define GSS_API_URL=http://10.0.2.2:3000
```

## Structure

- `lib/main.dart`: Flutter entrypoint.
- `lib/src/app`: app root and authenticated shell selection.
- `lib/src/config`: build-time configuration.
- `lib/src/models`: API DTO models.
- `lib/src/services`: HTTP/JWT/session/realtime clients.
- `lib/src/screens`: sign-in and bicycle operations screens.
- `lib/src/widgets`: reusable dialogs and UI primitives.
- `lib/src/utils`: parsing, validation, and display formatting.
- `test`: focused model and utility tests.

## Verification

```powershell
flutter analyze
flutter test
```