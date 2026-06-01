import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/api_response.dart';
import '../models/auth_tokens.dart';
import '../models/bike_models.dart';
import '../utils/parsing.dart';
import 'offline_cache.dart';
import 'session_store.dart';

class BikeApiException implements Exception {
  BikeApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() => message;
}

/// Authenticated API client with refresh-token interception.
class BikeApiClient {
  BikeApiClient({required SecureSessionStore store, http.Client? httpClient})
    : _store = store,
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
      throw BikeApiException('The server did not respond in time.');
    } catch (_) {
      throw BikeApiException('Could not connect to $baseUrl.');
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
      if (method == 'GET') {
        await _cache.writeMap(cacheKey, payload);
      }
      return payload;
    } on BikeApiException catch (error) {
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
      throw BikeApiException(
        response.message,
        statusCode: response.statusCode,
        code: response.code,
      );
    }
    final payload = response.body;
    if (payload is Map<String, dynamic>) return payload;
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
      throw BikeApiException('Username or password is incorrect.');
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
        'deviceName': 'GSS Bike Flutter',
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
          'clientFingerprint': 'gss-bike:flutter',
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
    final payload = await _authorized('GET', '/api/bike-app/camps');
    return asList(payload['camps']).map(Camp.fromJson).toList();
  }

  Future<BikeAppPermissions> permissions() async {
    final payload = await _authorized('GET', '/api/bike-app/permissions');
    return BikeAppPermissions.fromJson(payload);
  }

  Future<InventorySnapshot> inventory(String campId) async {
    final payload = await _authorized(
      'GET',
      '/api/bike-app/inventory',
      query: {'campId': campId},
    );
    return InventorySnapshot.fromJson(payload);
  }

  String? _encodedFilters(Map<String, String> filters) {
    final activeFilters = {
      for (final entry in filters.entries)
        if (entry.value.trim().isNotEmpty) entry.key: entry.value.trim(),
    };
    return activeFilters.isEmpty ? null : jsonEncode(activeFilters);
  }

  Future<PagedBicycleAssets> bicycles(
    String campId, {
    String search = '',
    int page = 1,
    int limit = 10,
    Map<String, String> filters = const {},
    String? sortColumn,
    String sortDirection = 'default',
  }) async {
    final payload = await _authorized(
      'GET',
      '/api/bike-app/bicycles',
      query: {
        'campId': campId,
        'search': search,
        'page': '$page',
        'limit': '$limit',
        'filters': _encodedFilters(filters),
        'sortColumn': sortColumn,
        'sortDirection': sortDirection,
      },
    );
    return PagedBicycleAssets.fromJson(payload);
  }

  Future<PagedHelmetAssets> helmets(
    String campId, {
    String search = '',
    int page = 1,
    int limit = 10,
    Map<String, String> filters = const {},
    String? sortColumn,
    String sortDirection = 'default',
  }) async {
    final payload = await _authorized(
      'GET',
      '/api/bike-app/helmets',
      query: {
        'campId': campId,
        'search': search,
        'page': '$page',
        'limit': '$limit',
        'filters': _encodedFilters(filters),
        'sortColumn': sortColumn,
        'sortDirection': sortDirection,
      },
    );
    return PagedHelmetAssets.fromJson(payload);
  }

  Future<List<Soldier>> soldiers(String campId, String search) async {
    final payload = await _authorized(
      'GET',
      '/api/bike-app/soldiers',
      query: {'campId': campId, 'search': search, 'limit': '50'},
    );
    return asList(payload['soldiers']).map(Soldier.fromJson).toList();
  }

  Future<NfcLookupResult> nfcLookup(String campId, String nfcData) async {
    final payload = await _authorized(
      'GET',
      '/api/bike-app/nfc',
      query: {'campId': campId, 'nfcData': nfcData},
    );
    return NfcLookupResult.fromJson(payload);
  }

  Future<List<RentalRecord>> recentRentals({
    required String campId,
    required String assetType,
    required String assetId,
    int limit = 2,
  }) async {
    final payload = await _authorized(
      'GET',
      '/api/bike-app/rentals',
      query: {
        'campId': campId,
        'assetType': assetType,
        'assetId': assetId,
        'limit': '$limit',
      },
    );
    return asList(payload['rentals']).map(RentalRecord.fromJson).toList();
  }

  Future<List<RentalRecord>> activeAssignments({
    required String campId,
    required String soldierId,
  }) async {
    final payload = await _authorized(
      'GET',
      '/api/bike-app/assignments',
      query: {'campId': campId, 'soldierId': soldierId},
    );
    return asList(payload['assignments']).map(RentalRecord.fromJson).toList();
  }

  Future<AppUpdateInfo> appVersion() async {
    final payload = await _authorized('GET', '/api/bike-app/version');
    return AppUpdateInfo.fromJson(payload);
  }

  Future<void> registerNotificationToken({
    required String token,
    required String platform,
  }) async {
    if (token.trim().isEmpty) return;
    await _authorized(
      'POST',
      '/api/bike-app/notifications/token',
      body: {
        'token': token,
        'platform': platform,
        'deviceId': await _store.deviceId(),
        'purpose': 'bike_late',
      },
    );
  }

  String absoluteUrl(String pathOrUrl) {
    final text = pathOrUrl.trim();
    if (text.startsWith('http://') || text.startsWith('https://')) {
      return text;
    }
    return _uri(text).toString();
  }

  Future<void> addBicycle(String campId, String name, String nfcCode) async {
    await _authorized(
      'POST',
      '/api/bike-app/bicycles',
      body: {'campId': campId, 'name': name, 'nfcCode': nfcCode},
    );
  }

  Future<void> editBicycle(
    String campId,
    BicycleAsset bike,
    String name,
    String nfcCode, {
    String? status,
    String? soldierId,
    String? helmetId,
    DateTime? rentedAt,
  }) async {
    await _authorized(
      'PATCH',
      '/api/bike-app/bicycles',
      body: {
        'campId': campId,
        'identifier': bike.id,
        'name': name,
        'nfcCode': nfcCode,
        'status': ?status,
        'soldierId': ?soldierId,
        'helmetId': ?helmetId,
        if (rentedAt != null) 'rentedAt': rentedAt.toUtc().toIso8601String(),
      },
    );
  }

  Future<void> deleteBicycle(String campId, String identifier) async {
    await _authorized(
      'DELETE',
      '/api/bike-app/bicycles',
      body: {'campId': campId, 'identifier': identifier},
    );
  }

  Future<void> addHelmet(String campId, String code, String nfcCode) async {
    await _authorized(
      'POST',
      '/api/bike-app/helmets',
      body: {'campId': campId, 'code': code, 'nfcCode': nfcCode},
    );
  }

  Future<void> editHelmet(
    String campId,
    HelmetAsset helmet,
    String code,
    String nfcCode,
  ) async {
    await _authorized(
      'PATCH',
      '/api/bike-app/helmets',
      body: {
        'campId': campId,
        'helmetId': helmet.id,
        'code': code,
        'nfcCode': nfcCode,
      },
    );
  }

  Future<void> deleteHelmet(String campId, String helmetId) async {
    await _authorized(
      'DELETE',
      '/api/bike-app/helmets',
      body: {'campId': campId, 'helmetId': helmetId},
    );
  }

  Future<void> rentBicycle({
    required String campId,
    required String identifier,
    required String rentedAt,
    required bool repair,
    String? soldierId,
    String? helmetId,
    bool longTerm = false,
  }) async {
    await _authorized(
      'POST',
      '/api/bike-app/rentals',
      body: {
        'campId': campId,
        'identifier': identifier,
        'rentedAt': rentedAt,
        'repair': repair,
        'soldierId': soldierId ?? '',
        'helmetId': helmetId ?? '',
        'longTerm': longTerm,
      },
    );
  }

  Future<void> returnBicycle({
    required String campId,
    required String identifier,
    required String returnedAt,
  }) async {
    await _authorized(
      'POST',
      '/api/bike-app/returns',
      body: {
        'campId': campId,
        'identifier': identifier,
        'returnedAt': returnedAt,
      },
    );
  }
}
