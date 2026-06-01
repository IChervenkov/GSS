import 'dart:async';

import 'package:flutter/material.dart';

import '../screens/bike_operations_screen.dart';
import '../screens/login_screen.dart';
import '../services/bike_api_client.dart';
import '../services/late_bike_notification_service.dart';
import '../services/session_store.dart';

/// Chooses the authenticated or unauthenticated app shell.
class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  final SecureSessionStore _store = const SecureSessionStore();
  late final BikeApiClient _api = BikeApiClient(store: _store);
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
    final authenticated = tokens.hasBoth;
    if (!mounted) return;
    setState(() {
      _authenticated = authenticated;
      if (authenticated) _authGeneration++;
      _booting = false;
    });
    if (authenticated) {
      unawaited(LateBikeNotificationService.registerDevice(_api));
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
          unawaited(LateBikeNotificationService.registerDevice(_api));
        },
      );
    }

    final authGeneration = _authGeneration;
    return BikeOperationsScreen(
      api: _api,
      onLogout: _logout,
      onAuthExpired: () => _expireAuth(authGeneration),
    );
  }
}
