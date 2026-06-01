import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/api_response.dart';
import '../models/auth_tokens.dart';
import '../models/inventory_models.dart';
import '../utils/parsing.dart';
import 'offline_cache.dart';
import 'session_store.dart';

class InventoryApiException implements Exception {
  InventoryApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() => message;
}

class InventoryApiClient {
  InventoryApiClient({
    required SecureSessionStore store,
    http.Client? httpClient,
  }) : _store = store,
       _http = httpClient ?? http.Client();

  final SecureSessionStore _store;
  final http.Client _http;
  final OfflineCache _cache = const OfflineCache();
  final String baseUrl = AppConfig.apiBaseUrl;
  Future<bool>? _refreshInFlight;
  final Map<String, Future<Map<String, dynamic>>> _getRequestsInFlight = {};

  Future<String> get accessToken async =>
      (await _store.readTokens()).accessToken;

  Uri _uri(String path, [Map<String, String?> query = const {}]) {
    final normalizedBase = baseUrl.trim().replaceFirst(RegExp(r'/+$'), '');
    final uri = Uri.parse('$normalizedBase$path');
    return uri.replace(
      queryParameters: {
        ...uri.queryParameters,
        for (final entry in query.entries)
          if (entry.value != null && entry.value!.isNotEmpty)
            entry.key: entry.value!,
      },
    );
  }

  Future<ApiResponse> _send(
    String method,
    String path, {
    Map<String, String?> query = const {},
    Object? body,
    String? bearerToken,
  }) async {
    final request = http.Request(method, _uri(path, query));
    request.headers.addAll({
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (bearerToken != null && bearerToken.isNotEmpty)
        'Authorization': 'Bearer $bearerToken',
    });
    if (body != null) request.body = jsonEncode(body);

    try {
      final streamed = await _http
          .send(request)
          .timeout(const Duration(seconds: 25));
      final response = await http.Response.fromStream(streamed);
      dynamic payload;
      try {
        payload = response.body.isEmpty ? null : jsonDecode(response.body);
      } catch (_) {
        payload = response.body;
      }
      return ApiResponse(statusCode: response.statusCode, body: payload);
    } on TimeoutException {
      throw InventoryApiException('The server did not respond in time.');
    } catch (_) {
      throw InventoryApiException('Could not connect to $baseUrl.');
    }
  }

  Future<Map<String, dynamic>> _authorized(
    String method,
    String path, {
    Map<String, String?> query = const {},
    Object? body,
  }) async {
    final cacheKey = _cacheKey(method, path, query);
    if (method == 'GET') {
      final existing = _getRequestsInFlight[cacheKey];
      if (existing != null) return existing;
      final request = _authorizedUnshared(
        method,
        path,
        query: query,
        body: body,
        cacheKey: cacheKey,
      );
      _getRequestsInFlight[cacheKey] = request;
      try {
        return await request;
      } finally {
        if (identical(_getRequestsInFlight[cacheKey], request)) {
          _getRequestsInFlight.remove(cacheKey);
        }
      }
    }
    return _authorizedUnshared(
      method,
      path,
      query: query,
      body: body,
      cacheKey: cacheKey,
    );
  }

  Future<Map<String, dynamic>> _authorizedUnshared(
    String method,
    String path, {
    required String cacheKey,
    Map<String, String?> query = const {},
    Object? body,
  }) async {
    try {
      var tokens = await _store.readTokens();
      var response = await _send(
        method,
        path,
        query: query,
        body: body,
        bearerToken: tokens.accessToken,
      );
      if (_shouldRefreshAccessToken(response) &&
          tokens.refreshToken.isNotEmpty) {
        final refreshed = await refreshTokens();
        if (refreshed) {
          tokens = await _store.readTokens();
          response = await _send(
            method,
            path,
            query: query,
            body: body,
            bearerToken: tokens.accessToken,
          );
        }
      }
      final payload = _expectMap(response);
      if (method == 'GET') await _cache.writeMap(cacheKey, payload);
      return payload;
    } on InventoryApiException catch (error) {
      if (method == 'GET' && error.statusCode == null) {
        final cached = await _cache.readMap(cacheKey);
        if (cached != null) return cached;
      }
      rethrow;
    }
  }

  bool _shouldRefreshAccessToken(ApiResponse response) {
    if (response.ok) return false;
    return response.statusCode == 401 ||
        response.code == 'ACCESS_TOKEN_EXPIRED' ||
        response.message == 'Access token has expired.';
  }

  String _cacheKey(String method, String path, Map<String, String?> query) {
    final normalizedQuery = Map.fromEntries(
      query.entries
          .where((entry) => entry.value != null)
          .map((entry) => MapEntry(entry.key, entry.value!))
          .toList()
        ..sort((a, b) => a.key.compareTo(b.key)),
    );
    return jsonEncode({
      'method': method,
      'path': path,
      'query': normalizedQuery,
    });
  }

  Map<String, dynamic> _expectMap(ApiResponse response) {
    if (!response.ok) {
      throw InventoryApiException(
        response.message,
        statusCode: response.statusCode,
        code: response.code,
      );
    }
    final payload = response.body;
    if (payload is Map<String, dynamic>) return payload;
    if (payload is Map) {
      return payload.map((key, value) => MapEntry('$key', value));
    }
    return <String, dynamic>{};
  }

  Future<void> checkLogin({
    required String username,
    required String password,
  }) async {
    final response = await _send(
      'POST',
      '/api/checkLogInApp',
      body: {'username': username, 'password': password},
    );
    final payload = _expectMap(response);
    if (payload['success'] != true) {
      throw InventoryApiException('Username or password is incorrect.');
    }
  }

  Future<void> prepareTwoFactor(String username) async {
    final response = await _send(
      'GET',
      '/api/2fa-verificated-device',
      query: {'username': username},
    );
    _expectMap(response);
  }

  Future<void> verifyDevice({
    required String username,
    required String code,
  }) async {
    final response = await _send(
      'POST',
      '/api/verify-device',
      body: {
        'username': username,
        'code': code,
        'deviceId': await _store.deviceId(),
        'deviceName': 'GSS Inventory Flutter',
      },
    );
    final payload = _expectMap(response);
    await _store.saveTokens(
      AuthTokens(
        accessToken: asString(payload['accessToken']),
        refreshToken: asString(payload['refreshToken']),
      ),
    );
  }

  Future<bool> refreshTokens() async {
    if (_refreshInFlight != null) return _refreshInFlight!;
    final completer = Completer<bool>();
    _refreshInFlight = completer.future;
    try {
      final tokens = await _store.readTokens();
      if (tokens.refreshToken.isEmpty) {
        completer.complete(false);
        return false;
      }
      final response = await _send(
        'POST',
        '/api/token',
        body: {
          'refreshToken': tokens.refreshToken,
          'deviceId': await _store.deviceId(),
          'clientFingerprint': 'gss-inventory:flutter',
        },
      );
      if (!response.ok) {
        final currentTokens = await _store.readTokens();
        if (currentTokens.refreshToken == tokens.refreshToken) {
          await _store.clearTokens();
        }
        completer.complete(false);
        return false;
      }
      final payload = _expectMap(response);
      final currentTokens = await _store.readTokens();
      if (currentTokens.refreshToken != tokens.refreshToken) {
        completer.complete(false);
        return false;
      }
      await _store.saveTokens(
        AuthTokens(
          accessToken: asString(payload['accessToken']),
          refreshToken: asString(payload['refreshToken']),
        ),
      );
      completer.complete(true);
      return true;
    } catch (_) {
      if (!completer.isCompleted) completer.complete(false);
      rethrow;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<void> logout() async {
    final tokens = await _store.readTokens();
    if (tokens.refreshToken.isNotEmpty) {
      await _send(
        'POST',
        '/api/logout',
        body: {
          'refreshToken': tokens.refreshToken,
          'deviceId': await _store.deviceId(),
        },
      ).catchError((_) => const ApiResponse(statusCode: 0, body: null));
    }
    final currentTokens = await _store.readTokens();
    if (currentTokens.refreshToken == tokens.refreshToken) {
      await _store.clearTokens();
    }
  }

  Future<List<Camp>> camps() async {
    final payload = await _authorized('GET', '/api/inventory-app/camps');
    return asList(payload['camps']).map(Camp.fromJson).toList();
  }

  Future<InventoryAppPermissions> permissions() async {
    final payload = await _authorized('GET', '/api/inventory-app/permissions');
    return InventoryAppPermissions.fromJson(payload);
  }

  Future<AssetsOverview> overview(
    String campId, {
    Map<String, dynamic> tableState = const {},
  }) async {
    final payload = await _authorized(
      'GET',
      '/api/inventory-app/overview',
      query: {
        'campId': campId,
        if (tableState.isNotEmpty) 'state': jsonEncode(tableState),
      },
    );
    return AssetsOverview.fromJson(payload);
  }

  Future<AssetRfidLookupResult> rfidLookup(
    String campId,
    String rfidCode,
  ) async {
    final payload = await _authorized(
      'GET',
      '/api/inventory-app/rfid',
      query: {'campId': campId, 'rfidCode': rfidCode},
    );
    return AssetRfidLookupResult.fromJson(payload);
  }

  Future<AppUpdateInfo> appVersion() async {
    final payload = await _authorized('GET', '/api/inventory-app/version');
    return AppUpdateInfo.fromJson(payload);
  }

  Future<void> registerNotificationToken({
    required String token,
    required String platform,
  }) async {
    if (token.trim().isEmpty) return;
    await _authorized(
      'POST',
      '/api/inventory-app/notifications/token',
      body: {
        'token': token,
        'platform': platform,
        'deviceId': await _store.deviceId(),
        'purpose': 'asset_inventory',
      },
    );
  }

  String absoluteUrl(String pathOrUrl) {
    final text = pathOrUrl.trim();
    if (text.startsWith('http://') || text.startsWith('https://')) return text;
    return _uri(text).toString();
  }

  Future<void> addAsset(
    String campId, {
    required String code,
    required String rfidCode,
    required String name,
    required String typeId,
    required String locationRoomId,
    String? locationKeyId,
    required String quantity,
    required String status,
    required String inventoryStatus,
    String? owner,
    String? category,
    String? service,
    String? expandable,
    String? description,
    String? mrah,
    String? m2Inside,
    String? purchaseDate,
    String? purchasePrice,
    String? comments,
    String? replacedOff,
    String? replacedBy,
    String? yearOfLifeCycle,
    String? restOfLifeCycle,
    String? restValue,
    bool isFixed = false,
    bool isQuantitative = false,
  }) async {
    await _authorized(
      'POST',
      '/api/inventory-app/assets',
      body: _assetBody(
        campId: campId,
        code: code,
        rfidCode: rfidCode,
        name: name,
        typeId: typeId,
        locationRoomId: locationRoomId,
        locationKeyId: locationKeyId,
        quantity: quantity,
        status: status,
        inventoryStatus: inventoryStatus,
        owner: owner,
        category: category,
        service: service,
        expandable: expandable,
        description: description,
        mrah: mrah,
        m2Inside: m2Inside,
        purchaseDate: purchaseDate,
        purchasePrice: purchasePrice,
        comments: comments,
        replacedOff: replacedOff,
        replacedBy: replacedBy,
        yearOfLifeCycle: yearOfLifeCycle,
        restOfLifeCycle: restOfLifeCycle,
        restValue: restValue,
        isFixed: isFixed,
        isQuantitative: isQuantitative,
      ),
    );
  }

  Future<void> editAsset(
    String campId,
    Asset asset, {
    required String code,
    required String rfidCode,
    required String name,
    required String typeId,
    required String locationRoomId,
    String? locationKeyId,
    required String quantity,
    required String status,
    required String inventoryStatus,
    String? owner,
    String? category,
    String? service,
    String? expandable,
    String? description,
    String? mrah,
    String? m2Inside,
    String? purchaseDate,
    String? purchasePrice,
    String? comments,
    String? replacedOff,
    String? replacedBy,
    String? yearOfLifeCycle,
    String? restOfLifeCycle,
    String? restValue,
    bool isFixed = false,
    bool isQuantitative = false,
  }) async {
    await _authorized(
      'PATCH',
      '/api/inventory-app/assets',
      body: {
        'assetId': asset.id,
        ..._assetBody(
          campId: campId,
          code: code,
          rfidCode: rfidCode,
          name: name,
          typeId: typeId,
          locationRoomId: locationRoomId,
          locationKeyId: locationKeyId,
          quantity: quantity,
          status: status,
          inventoryStatus: inventoryStatus,
          owner: owner,
          category: category,
          service: service,
          expandable: expandable,
          description: description,
          mrah: mrah,
          m2Inside: m2Inside,
          purchaseDate: purchaseDate,
          purchasePrice: purchasePrice,
          comments: comments,
          replacedOff: replacedOff,
          replacedBy: replacedBy,
          yearOfLifeCycle: yearOfLifeCycle,
          restOfLifeCycle: restOfLifeCycle,
          restValue: restValue,
          isFixed: isFixed,
          isQuantitative: isQuantitative,
        ),
      },
    );
  }

  Map<String, Object?> _assetBody({
    required String campId,
    required String code,
    required String rfidCode,
    required String name,
    required String typeId,
    required String locationRoomId,
    String? locationKeyId,
    required String quantity,
    required String status,
    required String inventoryStatus,
    String? owner,
    String? category,
    String? service,
    String? expandable,
    String? description,
    String? mrah,
    String? m2Inside,
    String? purchaseDate,
    String? purchasePrice,
    String? comments,
    String? replacedOff,
    String? replacedBy,
    String? yearOfLifeCycle,
    String? restOfLifeCycle,
    String? restValue,
    bool isFixed = false,
    bool isQuantitative = false,
  }) {
    return {
      'campId': campId,
      'code': code,
      'rfidCode': rfidCode,
      'name': name,
      'typeId': typeId,
      'locationRoomId': locationRoomId,
      'locationKeyId': locationKeyId ?? '',
      'quantity': quantity,
      'status': status,
      'inventoryStatus': inventoryStatus,
      'owner': owner ?? '',
      'category': category ?? '',
      'service': service ?? '',
      'expandable': expandable ?? 'Non Expandable',
      'description': description ?? '',
      'mrah': mrah ?? '',
      'm2Inside': m2Inside ?? '',
      'purchaseDate': purchaseDate ?? '',
      'purchasePrice': purchasePrice ?? '',
      'comments': comments ?? '',
      'replacedOff': replacedOff ?? '',
      'replacedBy': replacedBy ?? '',
      'yearOfLifeCycle': yearOfLifeCycle ?? '',
      'restOfLifeCycle': restOfLifeCycle ?? '',
      'restValue': restValue ?? '',
      'isFixed': isFixed,
      'isQuantitative': isQuantitative,
    };
  }

  Future<void> deleteAsset(String campId, String assetId) async {
    await _authorized(
      'DELETE',
      '/api/inventory-app/assets',
      body: {'campId': campId, 'assetId': assetId},
    );
  }

  Future<void> recordInventory(
    String campId, {
    required String assetId,
    required String locationRoomId,
    String? locationKeyId,
    String inventoryStatus = 'completed',
  }) async {
    await _authorized(
      'POST',
      '/api/inventory-app/inventory/scan',
      body: {
        'campId': campId,
        'assetId': assetId,
        'locationRoomId': locationRoomId,
        'locationKeyId': ?locationKeyId,
        'inventoryStatus': inventoryStatus,
      },
    );
  }

  Future<void> restartInventory(String campId, {String? locationRoomId}) async {
    await _authorized(
      'POST',
      '/api/inventory-app/inventory/restart',
      body: {
        'campId': campId,
        if (locationRoomId != null && locationRoomId.isNotEmpty)
          'locationRoomId': locationRoomId,
      },
    );
  }
}
