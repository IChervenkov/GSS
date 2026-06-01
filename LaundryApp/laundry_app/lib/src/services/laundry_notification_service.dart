import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'laundry_api_client.dart';
import 'native_bridge.dart';

@pragma('vm:entry-point')
Future<void> gssLaundryMessagingBackgroundHandler(RemoteMessage message) async {
  await LaundryNotificationService.ensureFirebaseReady();
}

class LaundryNotificationService {
  const LaundryNotificationService._();

  static bool _configured = false;
  static bool _firebaseReady = false;
  static bool _tokenRefreshListenerAttached = false;

  static Future<void> configure() async {
    if (_configured) return;
    _configured = true;

    FirebaseMessaging.onBackgroundMessage(gssLaundryMessagingBackgroundHandler);
    if (!await ensureFirebaseReady()) return;

    try {
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: false,
            badge: false,
            sound: false,
          );
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    } catch (_) {
      return;
    }
  }

  static Future<void> registerDevice(LaundryApiClient api) async {
    if (!await ensureFirebaseReady()) return;

    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);
      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        unawaited(_registerToken(api, token));
      }
      if (!_tokenRefreshListenerAttached) {
        _tokenRefreshListenerAttached = true;
        messaging.onTokenRefresh.listen((token) {
          if (token.isNotEmpty) unawaited(_registerToken(api, token));
        });
      }
    } catch (_) {
      return;
    }
  }

  static Future<bool> ensureFirebaseReady() async {
    if (_firebaseReady) return true;
    try {
      await Firebase.initializeApp();
      _firebaseReady = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> _registerToken(LaundryApiClient api, String token) async {
    try {
      await api.registerNotificationToken(
        token: token,
        platform: defaultTargetPlatform.name,
      );
    } catch (_) {
      return;
    }
  }

  static void _handleForegroundMessage(RemoteMessage message) {
    if (_isAppUpdateMessage(message)) {
      unawaited(
        NativeBridge.showAppUpdateNotification(
          version:
              message.data['version'] ?? message.data['latestVersion'] ?? '',
        ),
      );
    }
  }

  static bool _isAppUpdateMessage(RemoteMessage message) {
    final type = (message.data['type'] ?? '').toLowerCase();
    return type == 'app_update' ||
        type == 'app_version' ||
        type == 'new_version';
  }
}
