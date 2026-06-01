import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/auth_tokens.dart';

/// Secure persistence for bearer, refresh, and device identity data.
class SecureSessionStore {
  const SecureSessionStore();

  static const _storage = FlutterSecureStorage();
  static const _accessKey = 'gss_bike.access_token';
  static const _refreshKey = 'gss_bike.refresh_token';
  static const _deviceKey = 'gss_bike.device_id';

  Future<AuthTokens> readTokens() async {
    return AuthTokens(
      accessToken: await _storage.read(key: _accessKey) ?? '',
      refreshToken: await _storage.read(key: _refreshKey) ?? '',
    );
  }

  Future<void> saveTokens(AuthTokens tokens) async {
    await _storage.write(key: _accessKey, value: tokens.accessToken);
    await _storage.write(key: _refreshKey, value: tokens.refreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Future<String> deviceId() async {
    final existing = await _storage.read(key: _deviceKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final bytes = List<int>.generate(18, (_) => Random.secure().nextInt(256));
    final id = 'gss-bike-${base64UrlEncode(bytes).replaceAll('=', '')}';
    await _storage.write(key: _deviceKey, value: id);
    return id;
  }
}
