import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class OfflineCache {
  const OfflineCache();

  static const _storage = FlutterSecureStorage();
  static const _prefix = 'gss_laundry_cache:';

  Future<void> writeMap(String key, Map<String, dynamic> value) async {
    await _storage.write(key: '$_prefix$key', value: jsonEncode(value));
  }

  Future<Map<String, dynamic>?> readMap(String key) async {
    final value = await _storage.read(key: '$_prefix$key');
    if (value == null || value.isEmpty) return null;
    try {
      final decoded = jsonDecode(value);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) {
        return decoded.map((key, value) => MapEntry('$key', value));
      }
    } catch (_) {
      return null;
    }
    return null;
  }
}
