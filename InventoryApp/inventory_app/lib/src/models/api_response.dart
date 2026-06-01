class ApiResponse {
  const ApiResponse({required this.statusCode, required this.body});

  final int statusCode;
  final dynamic body;

  bool get ok => statusCode >= 200 && statusCode < 300;

  String get message {
    final payload = body;
    if (payload is Map) {
      final value = payload['message'] ?? payload['error'];
      if (value != null && value.toString().trim().isNotEmpty) {
        return value.toString();
      }
    }
    return ok ? 'OK' : 'Request failed with status $statusCode.';
  }

  String? get code {
    final payload = body;
    if (payload is Map && payload['code'] != null) {
      return payload['code'].toString();
    }
    return null;
  }
}
