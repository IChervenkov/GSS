import 'package:dio/dio.dart';
import 'package:mutex/mutex.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fitness_app/socket_manager.dart';
import 'package:fitness_app/main.dart';

class JwtInterceptor extends Interceptor {
  final Dio dio;
  static final Mutex _mutex = Mutex();

  final storage = const FlutterSecureStorage();
  final baseUrl = dotenv.env['BASE_URL'];

  String? _inMemoryAccessToken;

  JwtInterceptor(this.dio);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    _inMemoryAccessToken ??= await storage.read(key: "accessToken");

    if (_inMemoryAccessToken != null && _inMemoryAccessToken!.isNotEmpty) {
      options.headers["Authorization"] = "Bearer $_inMemoryAccessToken";
    }
    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 || err.response?.statusCode == 403) {
      if (err.requestOptions.extra['isRetry'] == true) {
        await _clearTokens();
        return handler.next(err);
      }

      try {
        await _mutex.acquire();

        final currentToken = await storage.read(key: "accessToken");
        final requestToken = err.requestOptions.headers["Authorization"]
            ?.replaceFirst("Bearer ", "");

        // If another request already refreshed the token while we waited
        if (currentToken != null && currentToken != requestToken) {
          _inMemoryAccessToken = currentToken;
          final retryResponse = await _retryRequest(
            err.requestOptions,
            currentToken,
          );
          return handler.resolve(retryResponse);
        }

        // Otherwise, perform the refresh
        final refreshed = await _refreshToken();
        if (refreshed && _inMemoryAccessToken != null) {
          final retryResponse = await _retryRequest(
            err.requestOptions,
            _inMemoryAccessToken!,
          );
          return handler.resolve(retryResponse);
        } else {
          await _clearTokens();
          return handler.next(err);
        }
      } catch (e) {
        await _clearTokens();
        return handler.next(err);
      } finally {
        _mutex.release();
      }
    } else {
      return handler.next(err);
    }
  }

  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await storage.read(key: "refreshToken");
      if (refreshToken == null || refreshToken.isEmpty) return false;

      final refreshDio = Dio();

      final response = await refreshDio.post(
        "$baseUrl/token",
        data: {"refreshToken": refreshToken},
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode == 200) {
        final newAccessToken = response.data['accessToken'];
        final newRefreshToken = response.data['refreshToken'];

        _inMemoryAccessToken = newAccessToken;
        await storage.write(key: "accessToken", value: newAccessToken);
        await storage.write(key: "refreshToken", value: newRefreshToken);

        return true;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  Future<bool> refreshTokenExternally() async {
    try {
      await _mutex.acquire();
      return await _refreshToken();
    } finally {
      _mutex.release();
    }
  }

  Future<Response<dynamic>> _retryRequest(
    RequestOptions requestOptions,
    String newAccessToken,
  ) async {
    requestOptions.headers["Authorization"] = "Bearer $newAccessToken";

    requestOptions.extra['isRetry'] = true;

    return dio.fetch(requestOptions);
  }

  Future<void> _clearTokens() async {
    try {
      final refreshToken = await storage.read(key: "refreshToken");

      if (refreshToken != null) {
        final logoutDio = Dio();
        await logoutDio.post(
          "$baseUrl/logout",
          data: {"refreshToken": refreshToken},
          options: Options(
            responseType: ResponseType.json,
            validateStatus: (status) =>
                status != null && status != 401 && status != 403,
          ),
        );
      }
    } catch (_) {
      // Ignore network errors on logout
    } finally {
      _inMemoryAccessToken = null;

      await storage.deleteAll();

      SocketManager.dispose();

      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainScreen()),
        (route) => false,
      );
    }
  }

  Future<void> logoutExternally() async {
    try {
      await _mutex.acquire();
      return await _clearTokens();
    } finally {
      _mutex.release();
    }
  }
}
