import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Small JSON cache used to keep the operations screen useful without network.
class OfflineCache {
  const OfflineCache();

  static const _storage = FlutterSecureStorage();
  static const _prefix = 'gss_bike.offline.';

  Future<Map<String, dynamic>?> readMap(String key) async {
    final value = await _storage.read(key: _storageKey(key));
    if (value == null || value.isEmpty) return null;
    try {
      final decoded = jsonDecode(value);
      if (decoded is Map<String, dynamic>) return decoded;
    } catch (_) {
      return null;
    }
    return null;
  }

  Future<void> writeMap(String key, Map<String, dynamic> value) async {
    await _storage.write(key: _storageKey(key), value: jsonEncode(value));
  }

  String _storageKey(String key) {
    return '$_prefix${base64UrlEncode(utf8.encode(key)).replaceAll('=', '')}';
  }
}
