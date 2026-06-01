import 'dart:async';

import 'package:flutter/services.dart';

class NativeBridge {
  const NativeBridge._();

  static const _methods = MethodChannel('gss_bike/native');
  static const _nfcEvents = EventChannel('gss_bike/nfc');
  static final Stream<String> _nfcScans = _nfcEvents
      .receiveBroadcastStream()
      .where((event) => event != null)
      .map((event) => event.toString().trim())
      .where((event) => event.isNotEmpty)
      .cast<String>()
      .asBroadcastStream();

  static Stream<String> get nfcScans {
    return _nfcScans;
  }

  static Future<AppBuildInfo> appBuildInfo() async {
    final value = await _methods.invokeMapMethod<String, Object?>(
      'appBuildInfo',
    );
    return AppBuildInfo(
      versionName: value?['versionName']?.toString() ?? '',
      versionCode: int.tryParse(value?['versionCode']?.toString() ?? '') ?? 0,
    );
  }

  static Future<void> downloadAndInstallUpdate({
    required String url,
    required String bearerToken,
    String? sha256,
  }) async {
    await _methods.invokeMethod<void>('downloadAndInstallUpdate', {
      'url': url,
      'bearerToken': bearerToken,
      'sha256': sha256 ?? '',
    });
  }

  static Future<void> openUpdateUrl(String url) async {
    await _methods.invokeMethod<void>('openUpdateUrl', {'url': url});
  }

  static Future<void> showLateBikeNotification({
    required String bicycleName,
    String? soldierName,
    String? rentedAt,
  }) async {
    await _methods.invokeMethod<void>('showLateBikeNotification', {
      'bicycleName': bicycleName,
      'soldierName': soldierName ?? '',
      'rentedAt': rentedAt ?? '',
    });
  }

  static Future<void> showAppUpdateNotification({
    required String version,
  }) async {
    await _methods.invokeMethod<void>('showAppUpdateNotification', {
      'version': version,
    });
  }

  static Future<bool> consumeAppUpdateNotificationTap() async {
    return await _methods.invokeMethod<bool>(
          'consumeAppUpdateNotificationTap',
        ) ??
        false;
  }
}

class AppBuildInfo {
  const AppBuildInfo({required this.versionName, required this.versionCode});

  final String versionName;
  final int versionCode;
}
