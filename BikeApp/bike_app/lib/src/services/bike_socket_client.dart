import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'bike_api_client.dart';

/// Socket.IO client for realtime fleet refreshes.
class BikeSocketClient {
  BikeSocketClient({
    required this.api,
    required this.onChanged,
    required this.onCampsChanged,
    required this.onSoldiersChanged,
    required this.onPermissionsChanged,
    required this.onBikeStatusChanged,
    required this.onConnectionState,
    required this.onAuthExpired,
  });

  final BikeApiClient api;
  final VoidCallback onChanged;
  final VoidCallback onCampsChanged;
  final VoidCallback onSoldiersChanged;
  final VoidCallback onPermissionsChanged;
  final ValueChanged<BikeStatusChange> onBikeStatusChanged;
  final ValueChanged<String> onConnectionState;
  final VoidCallback onAuthExpired;
  io.Socket? _socket;
  int _connectionGeneration = 0;

  Future<void> connect({bool allowRefreshOnAuthError = true}) async {
    await disconnect();
    final generation = _connectionGeneration;
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
        'rooms': ['ui:bicycle:list', 'ui:camp:list'],
        'subscriptionId': 'gss_bike_${DateTime.now().millisecondsSinceEpoch}',
      });
    });
    socket.onDisconnect((reason) {
      onConnectionState('Offline');
      if (_isAuthDisconnect(reason)) onAuthExpired();
    });
    socket.onConnectError((error) {
      onConnectionState('Reconnecting');
      if (_isAuthError(error)) {
        unawaited(
          _handleConnectAuthError(
            error,
            generation,
            allowRefreshOnAuthError: allowRefreshOnAuthError,
          ),
        );
      }
    });
    socket.on('socket:access:changed', (_) => onAuthExpired());
    socket.on('user:deleted', (_) => onAuthExpired());
    socket.on('user:record:deleted', (_) => onAuthExpired());
    socket.on('permission:self:refresh', (_) => onPermissionsChanged());
    socket.on('permission:self:refreshed', (_) => onPermissionsChanged());
    socket.on('permission:access:changed', (_) => onPermissionsChanged());
    socket.on('permission:access:updated', (_) => onPermissionsChanged());
    for (final eventName in [
      'bicycle:status:changed',
      'bicycle:record:status_changed',
    ]) {
      socket.on(eventName, (payload) {
        final change = BikeStatusChange.fromPayload(payload);
        if (change != null) onBikeStatusChanged(change);
        onChanged();
      });
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

    for (final eventName in ['soldier:changed', 'soldier:record:changed']) {
      socket.on(eventName, (_) => onSoldiersChanged());
    }

    for (final eventName in [
      'bicycle:add',
      'bicycle:updated',
      'bicycle:deleted',
      'bicycle:record:created',
      'bicycle:record:updated',
      'bicycle:record:deleted',
    ]) {
      socket.on(eventName, (_) => onChanged());
    }
    socket.connect();
  }

  Future<void> disconnect() async {
    _connectionGeneration++;
    _socket?.dispose();
    _socket = null;
    onConnectionState('Offline');
  }

  Future<void> _handleConnectAuthError(
    Object? error,
    int generation, {
    required bool allowRefreshOnAuthError,
  }) async {
    if (generation != _connectionGeneration) return;
    if (allowRefreshOnAuthError && _isRefreshableAuthError(error)) {
      var refreshed = false;
      try {
        refreshed = await api.refreshTokens();
      } catch (_) {
        refreshed = false;
      }
      if (refreshed && generation == _connectionGeneration) {
        await connect(allowRefreshOnAuthError: false);
        return;
      }
    }
    if (generation == _connectionGeneration) onAuthExpired();
  }

  bool _isAuthError(Object? error) {
    final code = _socketErrorCode(error).toUpperCase();
    return code == 'INVALID_TOKEN' ||
        code == 'ACCESS_TOKEN_EXPIRED' ||
        code == 'SOCKET_TOKEN_REVOKED' ||
        code == 'SOCKET_SESSION_INVALID' ||
        code == 'UNAUTHORIZED' ||
        code == 'ACCOUNT_LOCKED' ||
        code.contains('EXPIRED');
  }

  bool _isRefreshableAuthError(Object? error) {
    final code = _socketErrorCode(error).toUpperCase();
    return code == 'INVALID_TOKEN' ||
        code == 'ACCESS_TOKEN_EXPIRED' ||
        code == 'UNAUTHORIZED' ||
        code.contains('EXPIRED');
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

class BikeStatusChange {
  const BikeStatusChange({
    required this.bicycleId,
    required this.bicycleName,
    required this.previousStatus,
    required this.status,
    this.soldierName,
    this.rentedAt,
  });

  final String bicycleId;
  final String bicycleName;
  final String previousStatus;
  final String status;
  final String? soldierName;
  final String? rentedAt;

  bool get movedFromRentToLate =>
      _isRentStatus(previousStatus) && _isLateStatus(status);

  static BikeStatusChange? fromPayload(Object? payload) {
    final data = payload is List && payload.isNotEmpty
        ? payload.first
        : payload;
    if (data is! Map) return null;
    final bicycle =
        _mapValue(data['bicycle']) ??
        _mapValue(data['bike']) ??
        _mapValue(data['asset']);
    final bicycleId =
        _text(data['bicycleId']) ??
        _text(data['id']) ??
        _text(bicycle?['id']) ??
        '';
    final bicycleName =
        _text(data['bicycleName']) ??
        _text(data['name']) ??
        _text(bicycle?['name']) ??
        _text(bicycle?['nfcCode']) ??
        'Bicycle';
    final previousStatus =
        _text(data['previousStatus']) ??
        _text(data['oldStatus']) ??
        _text(data['fromStatus']) ??
        _text(data['from']) ??
        '';
    final status =
        _text(data['status']) ??
        _text(data['newStatus']) ??
        _text(data['toStatus']) ??
        _text(data['to']) ??
        _text(bicycle?['status']) ??
        '';
    if (status.isEmpty) return null;
    return BikeStatusChange(
      bicycleId: bicycleId,
      bicycleName: bicycleName,
      previousStatus: previousStatus,
      status: status,
      soldierName:
          _text(data['soldierName']) ??
          _text(data['assignedSoldier']) ??
          _text(bicycle?['assignedSoldier']),
      rentedAt: _text(data['rentedAt']) ?? _text(bicycle?['rentedAt']),
    );
  }

  static Map<Object?, Object?>? _mapValue(Object? value) {
    return value is Map ? value.cast<Object?, Object?>() : null;
  }

  static String? _text(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}

bool _isRentStatus(String status) {
  final normalized = status.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
  return normalized == 'rent' || normalized == 'rented';
}

bool _isLateStatus(String status) {
  final normalized = status.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
  return normalized == 'late' || normalized == 'overdue';
}
