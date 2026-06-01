import 'dart:async';

import 'package:flutter/services.dart';

class NativeBridge {
  const NativeBridge._();

  static const _methods = MethodChannel('gss_inventory/native');
  static const _rfidEvents = EventChannel('gss_inventory/rfid');
  static final Stream<String> _rfidScans = _rfidEvents
      .receiveBroadcastStream()
      .where((event) => event != null)
      .map((event) => event.toString().trim())
      .where((event) => event.isNotEmpty)
      .cast<String>()
      .asBroadcastStream();

  static Stream<String> get rfidScans => _rfidScans;

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

  static Future<void> setRfidScanEnabled(bool enabled) async {
    await _methods.invokeMethod<void>('setRfidScanEnabled', {
      'enabled': enabled,
    });
  }

  static Future<void> stopRfidScan() async {
    await _methods.invokeMethod<void>('stopRfidScan');
  }

  static Future<int> rfidPower() async {
    final value = await _methods.invokeMethod<Object?>('getRfidPower');
    return int.tryParse(value?.toString() ?? '') ?? 30;
  }

  static Future<int> setRfidPower(int power) async {
    final value = await _methods.invokeMethod<Object?>('setRfidPower', {
      'power': power,
    });
    return int.tryParse(value?.toString() ?? '') ?? power;
  }

  static Future<void> showAssetInventoryNotification({
    required String assetCode,
    required String status,
    String? soldierName,
  }) async {
    await _methods.invokeMethod<void>('showAssetInventoryNotification', {
      'assetCode': assetCode,
      'status': status,
      'soldierName': soldierName ?? '',
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
