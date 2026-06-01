/// Build-time configuration for GSS Inventory.
///
/// Override the API URL per environment with:
/// `--dart-define GSS_API_URL=http://10.0.2.2:3000`
class AppConfig {
  const AppConfig._();

  static const appName = 'GSS Inventory';
  static const apiBaseUrl = String.fromEnvironment(
    'GSS_API_URL',
    defaultValue: 'http://localhost:3000',
  );
}
