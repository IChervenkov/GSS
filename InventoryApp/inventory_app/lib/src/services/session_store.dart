import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/auth_tokens.dart';

class SecureSessionStore {
  const SecureSessionStore();

  static const _storage = FlutterSecureStorage();
  static const _accessTokenKey = 'gss_inventory_access_token';
  static const _refreshTokenKey = 'gss_inventory_refresh_token';
  static const _deviceIdKey = 'gss_inventory_device_id';

  Future<AuthTokens> readTokens() async {
    return AuthTokens(
      accessToken: await _storage.read(key: _accessTokenKey) ?? '',
      refreshToken: await _storage.read(key: _refreshTokenKey) ?? '',
    );
  }

  Future<void> saveTokens(AuthTokens tokens) async {
    await _storage.write(key: _accessTokenKey, value: tokens.accessToken);
    await _storage.write(key: _refreshTokenKey, value: tokens.refreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  Future<String> deviceId() async {
    final existing = await _storage.read(key: _deviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final bytes = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
    final id =
        'gss-inventory-${base64Url.encode(utf8.encode(bytes)).replaceAll('=', '')}';
    await _storage.write(key: _deviceIdKey, value: id);
    return id;
  }
}
