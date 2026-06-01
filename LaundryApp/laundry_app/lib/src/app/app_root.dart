import 'dart:async';

import 'package:flutter/material.dart';

import '../screens/laundry_operations_screen.dart';
import '../screens/login_screen.dart';
import '../services/laundry_api_client.dart';
import '../services/laundry_notification_service.dart';
import '../services/session_store.dart';

class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  final SecureSessionStore _store = const SecureSessionStore();
  late final LaundryApiClient _api = LaundryApiClient(store: _store);
  bool _booting = true;
  bool _authenticated = false;
  int _authGeneration = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_bootstrap());
  }

  Future<void> _bootstrap() async {
    final tokens = await _store.readTokens();
    var authenticated = tokens.hasBoth;
    if (authenticated) {
      try {
        authenticated = await _api.refreshTokens();
      } catch (_) {
        authenticated = true;
      }
    }
    if (!mounted) return;
    setState(() {
      _authenticated = authenticated;
      if (authenticated) _authGeneration++;
      _booting = false;
    });
    if (authenticated) {
      unawaited(LaundryNotificationService.registerDevice(_api));
    }
  }

  Future<void> _logout() async {
    final generation = _authGeneration;
    await _api.logout();
    if (!mounted || generation != _authGeneration) return;
    setState(() {
      _authenticated = false;
      _authGeneration++;
    });
  }

  Future<void> _expireAuth(int generation) async {
    if (generation != _authGeneration) return;
    await _store.clearTokens();
    if (!mounted || generation != _authGeneration) return;
    setState(() {
      _authenticated = false;
      _authGeneration++;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_booting) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!_authenticated) {
      return LoginScreen(
        api: _api,
        onAuthenticated: () {
          setState(() {
            _authenticated = true;
            _authGeneration++;
          });
          unawaited(LaundryNotificationService.registerDevice(_api));
        },
      );
    }

    final authGeneration = _authGeneration;
    return LaundryOperationsScreen(
      api: _api,
      onLogout: _logout,
      onAuthExpired: () => _expireAuth(authGeneration),
    );
  }
}
