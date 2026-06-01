/// Build-time configuration for GSS Bike.
///
/// The API URL is intentionally not editable on the sign-in screen. Override it
/// per environment with:
///
/// `flutter run --dart-define GSS_API_URL=http://10.0.2.2:3000`
class AppConfig {
  const AppConfig._();

  static const appName = 'GSS Bike';
  static const apiBaseUrl = String.fromEnvironment(
    'GSS_API_URL',
    defaultValue: 'http://localhost:3000',
  );
}
