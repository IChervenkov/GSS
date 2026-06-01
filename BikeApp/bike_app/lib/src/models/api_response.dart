import '../utils/parsing.dart';

class ApiResponse {
  const ApiResponse({required this.statusCode, required this.body});

  final int statusCode;
  final dynamic body;

  bool get ok => statusCode >= 200 && statusCode < 300;

  String get message {
    final payload = body;
    if (payload is Map<String, dynamic>) {
      return asString(
        payload['message'],
        fallback: ok ? 'OK' : 'Request failed.',
      );
    }
    return ok ? 'OK' : 'Request failed.';
  }

  String? get code {
    final payload = body;
    if (payload is Map<String, dynamic>) return asStringOrNull(payload['code']);
    return null;
  }
}
