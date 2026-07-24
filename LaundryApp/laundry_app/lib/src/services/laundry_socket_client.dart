import 'package:flutter/widgets.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'laundry_api_client.dart';

class LaundrySocketClient {
  LaundrySocketClient({
    required this.api,
    required this.onChanged,
    required this.onCampsChanged,
    required this.onPermissionsChanged,
    required this.onLaundryOverdue,
    required this.onConnectionState,
    required this.onAuthExpired,
  });

  final LaundryApiClient api;
  final VoidCallback onChanged;
  final VoidCallback onCampsChanged;
  final VoidCallback onPermissionsChanged;
  final ValueChanged<Map<String, dynamic>> onLaundryOverdue;
  final ValueChanged<String> onConnectionState;
  final VoidCallback onAuthExpired;
  io.Socket? _socket;
  int _connectionGeneration = 0;

  Future<void> connect() async {
    await disconnect();
    final generation = _connectionGeneration;
    try {
      await api.refreshTokens();
    } catch (_) {}
    if (generation != _connectionGeneration) return;
    final token = await api.accessToken;
    if (generation != _connectionGeneration || token.isEmpty) return;

    final socket = io.io(
      api.baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableForceNew()
          .disableAutoConnect()
          .setAuth({'token': token})
          .setExtraHeaders({'Authorization': 'Bearer $token'})
          .build(),
    );
    _socket = socket;

    socket.onConnect((_) {
      onConnectionState('Live');
      socket.emit('rooms:subscribe', {
        'rooms': ['ui:laundry:list', 'ui:camp:list'],
        'subscriptionId':
            'gss_laundry_${DateTime.now().millisecondsSinceEpoch}',
      });
    });
    socket.onDisconnect((reason) {
      onConnectionState('Offline');
      if (_isAuthDisconnect(reason)) onAuthExpired();
    });
    socket.onConnectError((error) {
      onConnectionState('Reconnecting');
      if (_isAuthError(error)) onAuthExpired();
    });
    socket.on('socket:access:changed', (_) => onAuthExpired());
    socket.on('user:deleted', (_) => onAuthExpired());
    socket.on('user:record:deleted', (_) => onAuthExpired());
    socket.on('permission:self:refresh', (_) => onPermissionsChanged());
    socket.on('permission:self:refreshed', (_) => onPermissionsChanged());
    socket.on('permission:access:changed', (_) => onPermissionsChanged());
    socket.on('permission:access:updated', (_) => onPermissionsChanged());

    socket.on('laundry:overdue', (payload) {
      if (payload is Map) {
        onLaundryOverdue(payload.map((key, value) => MapEntry('$key', value)));
      } else {
        onChanged();
      }
    });

    for (final eventName in [
      'laundry:changed',
      'laundry:bag:changed',
      'laundry:bag:add',
      'laundry:bag:updated',
      'laundry:bag:deleted',
      'laundry:record:changed',
      'soldier:changed',
    ]) {
      socket.on(eventName, (_) => onChanged());
    }

    for (final eventName in [
      'camp:add',
      'camp:updated',
      'camp:deleted',
      'camp:record:created',
      'camp:record:updated',
      'camp:record:deleted',
      'camp:access:changed',
      'camp:access:updated',
      'camp:access:self:refresh',
      'camp:access:self:refreshed',
    ]) {
      socket.on(eventName, (_) => onCampsChanged());
    }

    socket.connect();
  }

  Future<void> disconnect() async {
    _connectionGeneration++;
    _socket?.dispose();
    _socket = null;
    onConnectionState('Offline');
  }

  bool _isAuthError(Object? error) {
    final code = _socketErrorCode(error).toUpperCase();
    return code == 'INVALID_TOKEN' ||
        code == 'SOCKET_TOKEN_REVOKED' ||
        code == 'SOCKET_SESSION_INVALID' ||
        code == 'UNAUTHORIZED' ||
        code == 'ACCOUNT_LOCKED';
  }

  bool _isAuthDisconnect(Object? reason) =>
      reason?.toString().trim().toLowerCase() == 'io server disconnect';

  String _socketErrorCode(Object? error) {
    if (error is Map) {
      final data = error['data'];
      if (data is Map && data['code'] != null) return data['code'].toString();
      if (error['code'] != null) return error['code'].toString();
      if (error['message'] != null) return error['message'].toString();
    }
    final dynamic dynamicError = error;
    try {
      final data = dynamicError?.data;
      if (data is Map && data['code'] != null) return data['code'].toString();
    } catch (_) {}
    return error?.toString() ?? '';
  }
}
