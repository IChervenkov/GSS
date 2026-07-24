import 'dart:async';
import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../config/app_config.dart';
import '../models/laundry_models.dart';
import '../services/laundry_api_client.dart';
import '../services/laundry_socket_client.dart';
import '../services/native_bridge.dart';
import '../utils/formatters.dart';
import '../widgets/common_widgets.dart';

String _firstAccessibleCampId(Iterable<Camp> camps) {
  for (final camp in camps) {
    if (camp.canAccess) return camp.id;
  }
  return '';
}

const _statusOrder = ['drop_off', 'laundry_facility', 'ready_to_pick_up'];
const _bagFilterColumns = [
  'code',
  'rfidCode',
  'type',
  'status',
  'soldier',
  'count',
];

Map<String, String> _emptyBagFilters() => {
  for (final column in _bagFilterColumns) column: '',
};

class LaundryOperationsScreen extends StatefulWidget {
  const LaundryOperationsScreen({
    required this.api,
    required this.onLogout,
    required this.onAuthExpired,
    super.key,
  });

  final LaundryApiClient api;
  final Future<void> Function() onLogout;
  final Future<void> Function() onAuthExpired;

  @override
  State<LaundryOperationsScreen> createState() =>
      _LaundryOperationsScreenState();
}

class _LaundryOperationsScreenState extends State<LaundryOperationsScreen>
    with WidgetsBindingObserver {
  late final LaundrySocketClient _socket = LaundrySocketClient(
    api: widget.api,
    onChanged: _scheduleRefresh,
    onCampsChanged: _scheduleCampRefresh,
    onPermissionsChanged: _schedulePermissionRefresh,
    onLaundryOverdue: _handleLaundryOverduePayload,
    onConnectionState: (value) {
      if (mounted) setState(() => _connection = value);
    },
    onAuthExpired: () => unawaited(_handleAuthExpired()),
  );

  bool _loading = true;
  String _connection = 'Offline';
  int _selectedTab = 0;
  String _selectedCampId = '';
  List<Camp> _camps = const [];
  LaundryAppPermissions _permissions = const LaundryAppPermissions();
  LaundryOverview _overview = const LaundryOverview();
  final StreamController<List<Camp>> _campUpdates =
      StreamController<List<Camp>>.broadcast();
  final StreamController<LaundryOverview> _overviewUpdates =
      StreamController<LaundryOverview>.broadcast();
  final StreamController<LaundryAppPermissions> _permissionUpdates =
      StreamController<LaundryAppPermissions>.broadcast();
  StreamSubscription<String>? _rfidSubscription;
  Timer? _refreshDebounce;
  Timer? _campRefreshDebounce;
  Timer? _permissionRefreshDebounce;
  bool _refreshInFlight = false;
  bool _refreshAgain = false;
  bool _rfidProcessing = false;
  bool _rfidHandledByDialog = false;
  bool _linenExchangeScanMode = false;
  bool _readyScanToSoldierMode = false;
  int _rfidBatchGeneration = 0;
  int _rfidMovedCount = 0;
  int _rfidSkippedCount = 0;
  int _rfidFailedCount = 0;
  final Queue<String> _rfidQueue = Queue<String>();
  final Set<String> _queuedRfidCodes = {};
  final Set<String> _scannedRfidCodes = {};
  bool _authExpired = false;
  final Set<String> _appUpdateNotificationVersions = {};
  final Set<String> _overdueNotificationKeys = {};
  final Map<String, String> _allFilters = _emptyBagFilters();
  final Map<String, Map<String, String>> _statusFilters = {
    for (final status in _statusOrder) status: _emptyBagFilters(),
  };
  final Map<String, int> _statusPages = {
    for (final status in _statusOrder) status: 1,
  };
  final Map<String, String?> _statusSortColumns = {
    for (final status in _statusOrder) status: null,
  };
  final Map<String, String> _statusSortDirections = {
    for (final status in _statusOrder) status: 'default',
  };
  int _allPage = 1;
  String? _allSortColumn;
  String _allSortDirection = 'default';
  _RfidScanResult? _scanResult;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _listenForRfidScans();
    unawaited(_loadInitial());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refreshDebounce?.cancel();
    _campRefreshDebounce?.cancel();
    _permissionRefreshDebounce?.cancel();
    unawaited(_ignoreNative(NativeBridge.setRfidScanEnabled(false)));
    unawaited(_rfidSubscription?.cancel());
    unawaited(_socket.disconnect());
    unawaited(_campUpdates.close());
    unawaited(_overviewUpdates.close());
    unawaited(_permissionUpdates.close());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncRfidScanAvailability();
      unawaited(_handlePendingUpdateNotificationTap());
    } else if (state == AppLifecycleState.paused) {
      _terminateRfidBatch();
    }
  }

  Future<void> _handlePendingUpdateNotificationTap() async {
    if (!await NativeBridge.consumeAppUpdateNotificationTap()) return;
    await _checkForUpdate(manual: true);
  }

  Future<void> _loadInitial() async {
    try {
      var camps = await widget.api.camps();
      if (camps.isEmpty && await widget.api.refreshTokens()) {
        camps = await widget.api.camps();
      }
      final permissions = await widget.api.permissions();
      if (!mounted) return;
      setState(() {
        _camps = camps;
        _permissions = permissions;
        _selectedCampId = _firstAccessibleCampId(camps);
      });
      _syncRfidScanAvailability();
      _publishCampOptions();
      _publishPermissionOptions();
      await _socket.connect();
      await _refresh();
      final openedFromUpdateNotification =
          await NativeBridge.consumeAppUpdateNotificationTap();
      if (openedFromUpdateNotification) {
        unawaited(_checkForUpdate(manual: true));
      } else {
        unawaited(_checkForUpdate());
      }
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
        return;
      }
      _show(errorMessage(error));
      if (mounted) setState(() => _loading = false);
    }
  }

  String? get _selectedScanTargetStatus {
    return switch (_selectedTab) {
      1 => 'drop_off',
      2 => 'laundry_facility',
      3 => _readyScanToSoldierMode ? 'in_soldier' : 'ready_to_pick_up',
      _ => null,
    };
  }

  bool get _canScanMove =>
      _selectedScanTargetStatus != null &&
      _selectedCampId.isNotEmpty &&
      _permissions.canUse &&
      _permissions.canSaveBagStatus;

  bool get _canScanBags =>
      _selectedTab == 4 && _selectedCampId.isNotEmpty && _permissions.canUse;

  bool get _canScanLinenExchange =>
      _canScanBags && _permissions.canSaveBagStatus;

  bool get _canProcessLinenExchangeScan =>
      _canScanLinenExchange && _linenExchangeScanMode;

  void _listenForRfidScans() {
    _rfidSubscription = NativeBridge.rfidScans.listen(
      (rfidCode) => unawaited(_handleRfidScan(rfidCode)),
      onError: (error) => _show(_rfidErrorMessage(error)),
    );
  }

  void _syncRfidScanAvailability() {
    if (!_canScanMove && !_canScanBags) _clearRfidScanSession();
    unawaited(
      _ignoreNative(
        NativeBridge.setRfidScanEnabled(_canScanMove || _canScanBags),
      ),
    );
  }

  void _clearRfidScanSession() {
    _rfidBatchGeneration++;
    _rfidQueue.clear();
    _queuedRfidCodes.clear();
    _scannedRfidCodes.clear();
    _rfidMovedCount = 0;
    _rfidSkippedCount = 0;
    _rfidFailedCount = 0;
  }

  void _terminateRfidBatch({bool disableReader = true}) {
    _clearRfidScanSession();
    unawaited(
      _ignoreNative(
        disableReader
            ? NativeBridge.setRfidScanEnabled(false)
            : NativeBridge.stopRfidScan(),
      ),
    );
  }

  Future<void> _ignoreNative(Future<void> future) async {
    try {
      await future;
    } catch (_) {}
  }

  void _publishCampOptions() {
    if (!_campUpdates.isClosed) _campUpdates.add(_camps);
  }

  void _publishPermissionOptions() {
    if (!_permissionUpdates.isClosed) _permissionUpdates.add(_permissions);
  }

  void _scheduleRefresh() {
    _refreshDebounce?.cancel();
    _refreshDebounce = Timer(
      const Duration(milliseconds: 700),
      () => unawaited(_coalescedRefresh()),
    );
  }

  void _scheduleCampRefresh() {
    _campRefreshDebounce?.cancel();
    _campRefreshDebounce = Timer(
      const Duration(milliseconds: 500),
      () => unawaited(_refreshCamps()),
    );
  }

  void _schedulePermissionRefresh() {
    _permissionRefreshDebounce?.cancel();
    _permissionRefreshDebounce = Timer(
      const Duration(milliseconds: 500),
      () => unawaited(_refreshPermissions()),
    );
  }

  Future<void> _handleAuthExpired() async {
    if (_authExpired) return;
    _authExpired = true;
    if (mounted) _show('Session access changed. Sign in again.');
    await _socket.disconnect();
    await widget.onAuthExpired();
  }

  bool _isAuthFailure(Object error) {
    if (error is! LaundryApiException) return false;
    final code = (error.code ?? '').toUpperCase();
    return error.statusCode == 401 ||
        error.statusCode == 423 ||
        code == 'INVALID_TOKEN' ||
        code == 'INVALID_REFRESH_TOKEN' ||
        code == 'SOCKET_TOKEN_REVOKED' ||
        code == 'SOCKET_SESSION_INVALID' ||
        code == 'ACCOUNT_LOCKED';
  }

  Future<void> _refreshPermissions() async {
    try {
      final permissions = await widget.api.permissions();
      if (!mounted) return;
      final hadUse = _permissions.canUse;
      setState(() => _permissions = permissions);
      _publishPermissionOptions();
      _syncRfidScanAvailability();
      if (!permissions.canUse) {
        _closeOpenModalWindows();
      }
      if (permissions.canUse && !hadUse) await _refresh(quiet: true);
    } catch (error) {
      if (_isAuthFailure(error)) await _handleAuthExpired();
    }
  }

  void _closeOpenModalWindows() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.of(
        context,
        rootNavigator: true,
      ).popUntil((route) => route is! PopupRoute);
    });
  }

  Future<void> _refreshCamps() async {
    try {
      final camps = await widget.api.camps();
      if (!mounted) return;
      final selectedStillAccessible =
          _selectedCampId.isNotEmpty &&
          camps.any((camp) => camp.id == _selectedCampId && camp.canAccess);
      final nextSelectedCampId = selectedStillAccessible ? _selectedCampId : '';
      final campChanged = nextSelectedCampId != _selectedCampId;
      setState(() {
        _camps = camps;
        _selectedCampId = nextSelectedCampId;
        if (campChanged && nextSelectedCampId.isEmpty) {
          _loading = false;
          _overview = const LaundryOverview();
          _scanResult = null;
        }
        if (campChanged) _clearRfidScanSession();
      });
      _syncRfidScanAvailability();
      _publishCampOptions();
      if (campChanged && nextSelectedCampId.isEmpty) {
        _closeOpenModalWindows();
        if (!_overviewUpdates.isClosed) {
          _overviewUpdates.add(const LaundryOverview());
        }
      }
      if (campChanged && nextSelectedCampId.isNotEmpty) {
        await _refresh(quiet: true);
      }
    } catch (error) {
      if (_isAuthFailure(error)) await _handleAuthExpired();
    }
  }

  Future<void> _coalescedRefresh() async {
    if (_refreshInFlight) {
      _refreshAgain = true;
      return;
    }
    _refreshInFlight = true;
    try {
      do {
        _refreshAgain = false;
        await _refresh(quiet: true);
      } while (_refreshAgain);
    } finally {
      _refreshInFlight = false;
    }
  }

  Future<void> _refresh({bool quiet = false}) async {
    final campId = _selectedCampId;
    if (campId.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    if (!quiet && mounted) setState(() => _loading = true);
    try {
      final overview = await widget.api.overview(campId);
      if (!mounted || _selectedCampId != campId) return;
      setState(() {
        _overview = overview;
        _scanResult = _updatedScanResultFromOverview(_scanResult, overview);
        _loading = false;
      });
      if (!_overviewUpdates.isClosed) _overviewUpdates.add(overview);
    } catch (error) {
      if (!mounted || _selectedCampId != campId) return;
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else {
        _show(errorMessage(error));
      }
      if (mounted) setState(() => _loading = false);
    }
  }

  void _handleLaundryOverduePayload(Map<String, dynamic> payload) {
    final notification = LaundryOverdueNotification.fromJson(payload);
    _notifyOverdueBags([notification]);
  }

  void _notifyOverdueBags(List<LaundryOverdueNotification> notifications) {
    for (final notification in notifications) {
      final key = notification.dedupeKey;
      if (key.trim().isEmpty || _overdueNotificationKeys.contains(key)) {
        continue;
      }
      _overdueNotificationKeys.add(key);
      unawaited(
        _ignoreNative(
          NativeBridge.showLaundryStatusNotification(
            bagCode: notification.bagCode,
            status: 'Overdue',
            soldierName: notification.soldierName,
          ),
        ),
      );
      if (mounted) {
        _show(
          notification.message ??
              '${notification.bagCode} is overdue${(notification.soldierName ?? '').isNotEmpty ? ' for ${notification.soldierName}' : ''}.',
        );
      }
    }
  }

  _RfidScanResult? _updatedScanResultFromOverview(
    _RfidScanResult? result,
    LaundryOverview overview,
  ) {
    if (result == null ||
        result.isLoading ||
        result.isError ||
        result.bag == null) {
      return result;
    }
    final bag = _findBagInOverview(
      overview,
      id: result.bagId ?? result.bag!.id,
      rfidCode: result.rfidCode ?? result.bag!.rfidCode,
    );
    if (bag == null) return null;
    if ((_allFilters['rfidCode'] ?? '') == (result.rfidCode ?? '')) {
      _allFilters['rfidCode'] = bag.rfidCode;
    }
    return _RfidScanResult.bag(
      tabIndex: result.tabIndex,
      title: result.title,
      message: bag.code,
      bag: bag,
    );
  }

  LaundryBag? _findBagInOverview(
    LaundryOverview overview, {
    required String id,
    required String rfidCode,
  }) {
    final normalizedRfid = rfidCode.trim().toLowerCase();
    final sources = [
      overview.rows,
      overview.availableRows,
      for (final rows in overview.statusRows.values) rows,
    ];
    for (final rows in sources) {
      for (final bag in rows) {
        if (bag.id == id) return bag;
        if (normalizedRfid.isNotEmpty &&
            bag.rfidCode.trim().toLowerCase() == normalizedRfid) {
          return bag;
        }
      }
    }
    return null;
  }

  Future<void> _handleRfidScan(String rfidCode) async {
    if (_rfidHandledByDialog) return;
    if (_selectedCampId.isEmpty) {
      _show('Choose a camp before scanning RFID.');
      return;
    }
    final targetStatus = _selectedScanTargetStatus;
    final normalizedCode = rfidCode.trim();
    if (normalizedCode.isEmpty) return;
    if (_selectedTab == 4) {
      if (_linenExchangeScanMode) {
        if (!_canProcessLinenExchangeScan) return;
        _queueRfidCode(normalizedCode, skipPreviouslyScanned: false);
        return;
      }
      await _showBagRfidDetails(normalizedCode);
      return;
    }
    if (!_canScanMove || targetStatus == null) return;
    _queueRfidCode(normalizedCode, skipPreviouslyScanned: false);
  }

  void _queueRfidCode(String rfidCode, {bool skipPreviouslyScanned = true}) {
    final normalizedCode = rfidCode.trim();
    if (normalizedCode.isEmpty) return;
    final codeKey = normalizedCode.toLowerCase();
    if (skipPreviouslyScanned &&
        (_queuedRfidCodes.contains(codeKey) ||
            _scannedRfidCodes.contains(codeKey))) {
      return;
    }
    _rfidQueue.add(normalizedCode);
    if (skipPreviouslyScanned) _queuedRfidCodes.add(codeKey);
    unawaited(_processRfidQueue(_rfidBatchGeneration));
  }

  String _moveRequestStatusForTarget(String status) {
    return status == 'in_soldier' ? 'pick_up' : status;
  }

  Future<void> _processRfidQueue(int generation) async {
    if (_rfidProcessing) return;
    _rfidProcessing = true;
    var shouldRefresh = false;
    try {
      while (mounted &&
          generation == _rfidBatchGeneration &&
          _rfidQueue.isNotEmpty) {
        final targetStatus = _selectedScanTargetStatus;
        final processingLinenExchange = _canProcessLinenExchangeScan;
        if (!processingLinenExchange &&
            (!_canScanMove || targetStatus == null)) {
          break;
        }
        final rfidCode = _rfidQueue.removeFirst();
        final codeKey = rfidCode.toLowerCase();
        _queuedRfidCodes.remove(codeKey);
        _scannedRfidCodes.add(codeKey);
        try {
          final result = await widget.api.rfidLookup(_selectedCampId, rfidCode);
          if (!mounted || generation != _rfidBatchGeneration) break;
          final bag = result.bag;
          if (processingLinenExchange) {
            await widget.api.recordLinenExchange(_selectedCampId, bag.id);
            if (!mounted || generation != _rfidBatchGeneration) break;
            setState(() {
              _allFilters['rfidCode'] = '';
              _allPage = 1;
              _scanResult = null;
            });
            _rfidMovedCount++;
            shouldRefresh = true;
            continue;
          }
          final moveTargetStatus = targetStatus;
          if (moveTargetStatus == null) break;
          if (bag.status == moveTargetStatus) {
            _rfidSkippedCount++;
            continue;
          }
          final allowedStatuses = _moveStatusesForStatus(bag.status);
          if (!allowedStatuses.contains(moveTargetStatus)) {
            _rfidSkippedCount++;
            continue;
          }
          await widget.api.moveBag(
            _selectedCampId,
            bagId: bag.id,
            status: _moveRequestStatusForTarget(moveTargetStatus),
          );
          if (!mounted || generation != _rfidBatchGeneration) break;
          _rfidMovedCount++;
          shouldRefresh = true;
        } catch (error) {
          if (_isAuthFailure(error)) {
            await _handleAuthExpired();
            break;
          }
          _showRfidError(error, tabIndex: _selectedTab);
          _rfidFailedCount++;
        }
      }
    } finally {
      _rfidProcessing = false;
    }
    if (!mounted) return;
    if (generation != _rfidBatchGeneration) {
      if (_rfidQueue.isNotEmpty) {
        unawaited(_processRfidQueue(_rfidBatchGeneration));
      }
      return;
    }
    if (shouldRefresh) await _refresh(quiet: true);
    if (!mounted || generation != _rfidBatchGeneration) return;
    if (_rfidQueue.isNotEmpty) {
      unawaited(_processRfidQueue(generation));
      return;
    }
    _showRfidBatchSummary();
  }

  void _showRfidBatchSummary() {
    final total = _rfidMovedCount + _rfidSkippedCount + _rfidFailedCount;
    if (total == 0) return;
    final parts = <String>[];
    if (_rfidMovedCount > 0) {
      parts.add(
        _selectedTab == 4
            ? 'recorded $_rfidMovedCount'
            : 'moved $_rfidMovedCount',
      );
    }
    if (_rfidSkippedCount > 0) parts.add('skipped $_rfidSkippedCount');
    if (_rfidFailedCount > 0) parts.add('failed $_rfidFailedCount');
    final label = _selectedTab == 4 ? 'RFID linen exchange' : 'RFID scan';
    _show('$label ${parts.join(', ')}.');
    _rfidMovedCount = 0;
    _rfidSkippedCount = 0;
    _rfidFailedCount = 0;
  }

  Future<void> _checkForUpdate({bool manual = false}) async {
    if (_authExpired) return;
    if (!_permissions.canDownloadLaundryApp) {
      if (manual) _show("You don't have permission to check for app updates.");
      return;
    }
    try {
      try {
        await widget.api.refreshTokens();
      } catch (_) {}
      if ((await widget.api.accessToken).isEmpty) return;
      final results = await Future.wait<Object>([
        NativeBridge.appBuildInfo(),
        widget.api.appVersion(),
      ]);
      if (_authExpired || !mounted) return;
      final build = results[0] as AppBuildInfo;
      final update = results[1] as AppUpdateInfo;
      final apkUrl = update.apkUrl;
      if (apkUrl == null || apkUrl.isEmpty) {
        if (manual) _show('No Android update package is published.');
        return;
      }
      final currentVersion = build.versionName.trim();
      final nextVersion = (update.version ?? '').trim();
      if (!_isNewerVersion(nextVersion, currentVersion)) {
        if (manual) _show('This device already has the current version.');
        return;
      }
      if (!manual) {
        if (_appUpdateNotificationVersions.add(nextVersion)) {
          unawaited(
            NativeBridge.showAppUpdateNotification(version: nextVersion),
          );
        }
        return;
      }
      if (!mounted) return;
      final install = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Update available'),
          content: Text(
            'GSS Laundry $nextVersion is ready to install. Current version: ${currentVersion.isEmpty ? 'unknown' : currentVersion}.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Later'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Install'),
            ),
          ],
        ),
      );
      if (install != true) return;
      final bearerToken = await widget.api.accessToken;
      if (bearerToken.isEmpty) return;
      await NativeBridge.downloadAndInstallUpdate(
        url: widget.api.absoluteUrl(apkUrl),
        bearerToken: bearerToken,
        sha256: update.sha256,
      );
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
        return;
      }
      if (manual) _show(errorMessage(error));
    }
  }

  bool _isNewerVersion(String latest, String current) {
    if (latest.trim().isEmpty) return false;
    final latestParts = _versionParts(latest);
    final currentParts = _versionParts(current);
    final length = latestParts.length > currentParts.length
        ? latestParts.length
        : currentParts.length;
    for (var index = 0; index < length; index += 1) {
      final left = index < latestParts.length ? latestParts[index] : 0;
      final right = index < currentParts.length ? currentParts[index] : 0;
      if (left > right) return true;
      if (left < right) return false;
    }
    return false;
  }

  List<int> _versionParts(String value) {
    final version = value.split('+').first;
    return version
        .split(RegExp(r'[^0-9]+'))
        .where((part) => part.isNotEmpty)
        .map((part) => int.tryParse(part) ?? 0)
        .toList();
  }

  Future<void> _changeCamp(String campId) async {
    if (!_camps.any((camp) => camp.id == campId && camp.canAccess)) return;
    _terminateRfidBatch();
    setState(() {
      _selectedCampId = campId;
      _overview = const LaundryOverview();
    });
    _syncRfidScanAvailability();
    await _refresh();
  }

  void _show(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _rfidErrorMessage(Object error) {
    if (error is PlatformException) {
      return error.message?.trim().isNotEmpty == true
          ? error.message!.trim()
          : error.code;
    }
    return errorMessage(error);
  }

  void _showRfidError(Object error, {required int tabIndex}) {
    final message = _rfidErrorMessage(error);
    if (!mounted) return;
    setState(() {
      _scanResult = _RfidScanResult.error(
        tabIndex: tabIndex,
        title: 'RFID scan failed',
        message: message,
      );
    });
    _show(message);
  }

  Future<void> _showBagRfidDetails(String rfidCode) async {
    setState(() {
      _allFilters['rfidCode'] = rfidCode;
      _allPage = 1;
      _scanResult = _RfidScanResult.loading(
        tabIndex: 4,
        title: 'Scanning bag RFID',
        message: rfidCode,
      );
    });
    try {
      final result = await widget.api.rfidLookup(_selectedCampId, rfidCode);
      if (!mounted) return;
      await _refresh(quiet: true);
      if (!mounted) return;
      setState(() {
        _allFilters['rfidCode'] = rfidCode;
        _allPage = 1;
        _scanResult = _RfidScanResult.bag(
          tabIndex: 4,
          title: 'Laundry bag scanned',
          message: result.bag.code,
          bag: result.bag,
        );
      });
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
        return;
      }
      _showRfidError(error, tabIndex: 4);
    }
  }

  void _setLinenExchangeScanMode(bool enabled) {
    if (enabled && !_canScanLinenExchange) return;
    setState(() {
      _linenExchangeScanMode = enabled;
      if (enabled) {
        _allFilters['rfidCode'] = '';
        _allPage = 1;
      }
      _clearRfidScanSession();
    });
    _syncRfidScanAvailability();
  }

  void _setReadyScanToSoldierMode(bool enabled) {
    setState(() {
      _readyScanToSoldierMode = enabled;
      _clearRfidScanSession();
    });
    _syncRfidScanAvailability();
  }

  _PagedBagRows _allBagRowsForTable() {
    return _bagPageFromRows(
      _overview.rows,
      page: _allPage,
      filters: _allFilters,
      sortColumn: _allSortColumn,
      sortDirection: _allSortDirection,
    );
  }

  _PagedBagRows _statusRowsForTable(String status) {
    return _bagPageFromRows(
      _overview.statusRows[status] ?? const <LaundryBag>[],
      page: _statusPages[status] ?? 1,
      filters: _statusFilters[status] ?? _emptyBagFilters(),
      sortColumn: _statusSortColumns[status],
      sortDirection: _statusSortDirections[status] ?? 'default',
    );
  }

  _PagedBagRows _bagPageFromRows(
    List<LaundryBag> source, {
    required int page,
    required Map<String, String> filters,
    required String? sortColumn,
    required String sortDirection,
  }) {
    final rows = source
        .where((bag) => _matchesBagFilters(bag, filters))
        .toList();
    _sortRows<LaundryBag>(
      rows,
      sortColumn: sortColumn,
      sortDirection: sortDirection,
      valueForColumn: _bagColumnValue,
    );
    final boundedPage = _boundedTablePage(page, rows.length);
    return _PagedBagRows(
      rows: _pageRows(rows, boundedPage),
      meta: _localTableMeta(
        page: boundedPage,
        total: rows.length,
        sourceTotal: source.length,
        sortColumn: sortColumn,
        sortDirection: sortDirection,
      ),
    );
  }

  bool _matchesBagFilters(LaundryBag bag, Map<String, String> filters) {
    for (final entry in filters.entries) {
      final needle = entry.value.trim();
      if (needle.isEmpty) continue;
      if (!_matchesFilter(_bagColumnValue(bag, entry.key), needle)) {
        return false;
      }
    }
    return true;
  }

  bool _matchesFilter(String value, String needle) {
    return value.toLowerCase().contains(needle.toLowerCase());
  }

  String _bagColumnValue(LaundryBag bag, String column) {
    return switch (column) {
      'code' => bag.code,
      'rfidCode' => bag.rfidCode,
      'type' => bag.type,
      'status' => '${bag.status} ${bag.displayStatus ?? ''} ${bag.statusLabel}',
      'soldier' => bag.soldierName ?? '',
      'count' =>
        '${bag.laundryCount.toString().padLeft(6, '0')} ${bag.laundryCount}/${bag.maxCountLaundry}',
      _ => '',
    };
  }

  void _sortRows<T>(
    List<T> rows, {
    required String? sortColumn,
    required String sortDirection,
    required String Function(T row, String column) valueForColumn,
  }) {
    if (sortColumn == null || sortDirection == 'default') return;
    final multiplier = sortDirection == 'desc' ? -1 : 1;
    rows.sort((left, right) {
      final leftValue = valueForColumn(left, sortColumn).toLowerCase();
      final rightValue = valueForColumn(right, sortColumn).toLowerCase();
      return leftValue.compareTo(rightValue) * multiplier;
    });
  }

  List<T> _pageRows<T>(List<T> rows, int page) {
    const limit = 10;
    final start = (page - 1) * limit;
    if (start >= rows.length) return const [];
    final end = start + limit > rows.length ? rows.length : start + limit;
    return rows.sublist(start, end);
  }

  int _boundedTablePage(int requestedPage, int total) {
    const limit = 10;
    final totalPages = _localTotalPages(total, limit);
    if (requestedPage < 1) return 1;
    return requestedPage > totalPages ? totalPages : requestedPage;
  }

  TablePageMeta _localTableMeta({
    required int page,
    required int total,
    required int sourceTotal,
    String? sortColumn,
    String sortDirection = 'default',
  }) {
    const limit = 10;
    return TablePageMeta(
      page: page,
      limit: limit,
      total: total,
      totalPages: _localTotalPages(total, limit),
      sourceTotal: sourceTotal,
      sortColumn: sortColumn,
      sortDirection: sortDirection,
    );
  }

  int _localTotalPages(int total, int limit) {
    if (total <= 0) return 1;
    return ((total - 1) ~/ limit) + 1;
  }

  void _applyAllBagFilter(String column, String value) {
    setState(() {
      _allFilters[column] = value;
      _allPage = 1;
    });
  }

  Future<void> _sortAllBags(String column) async {
    setState(() {
      if (_allSortColumn == column) {
        _allSortDirection = _nextSortDirection(_allSortDirection);
      } else {
        _allSortColumn = column;
        _allSortDirection = 'asc';
      }
      if (_allSortDirection == 'default') _allSortColumn = null;
      _allPage = 1;
    });
  }

  Future<void> _changeAllBagPage(int page) async {
    setState(() => _allPage = page);
  }

  void _applyStatusFilter(String status, String column, String value) {
    setState(() {
      (_statusFilters[status] ??= _emptyBagFilters())[column] = value;
      _statusPages[status] = 1;
    });
  }

  Future<void> _sortStatusBags(String status, String column) async {
    setState(() {
      if (_statusSortColumns[status] == column) {
        _statusSortDirections[status] = _nextSortDirection(
          _statusSortDirections[status] ?? 'default',
        );
      } else {
        _statusSortColumns[status] = column;
        _statusSortDirections[status] = 'asc';
      }
      if (_statusSortDirections[status] == 'default') {
        _statusSortColumns[status] = null;
      }
      _statusPages[status] = 1;
    });
  }

  Future<void> _changeStatusPage(String status, int page) async {
    setState(() => _statusPages[status] = page);
  }

  String _nextSortDirection(String current) {
    return switch (current) {
      'asc' => 'desc',
      'desc' => 'default',
      _ => 'asc',
    };
  }

  Widget _statusLaneView(String title, String status) {
    final pagedRows = _statusRowsForTable(status);
    return _StatusLaneView(
      title: title,
      rows: pagedRows.rows,
      meta: pagedRows.meta,
      filters: _statusFilters[status] ?? _emptyBagFilters(),
      sortColumn: _statusSortColumns[status],
      sortDirection: _statusSortDirections[status] ?? 'default',
      breakdown:
          _overview.statusTypeBreakdown[status] ??
          const <LaundryTypeBreakdown>[],
      canSaveStatus: _permissions.canSaveBagStatus,
      canEdit: _permissions.canEditBag,
      canDelete: _permissions.canDeleteBag,
      scanToSoldierMode: status == 'ready_to_pick_up'
          ? _readyScanToSoldierMode
          : null,
      onScanToSoldierModeChanged: status == 'ready_to_pick_up'
          ? _setReadyScanToSoldierMode
          : null,
      onFilterChanged: (column, value) =>
          _applyStatusFilter(status, column, value),
      onSort: (column) => _sortStatusBags(status, column),
      onPageChanged: (page) => _changeStatusPage(status, page),
      onEdit: (bag) => unawaited(_showBagEditor(bag: bag)),
      onDelete: _deleteBag,
      onMove: (bag) =>
          _showMoveDialog(bag, statuses: _moveStatusesForLane(status)),
      onLinenExchange: _recordLinenExchange,
    );
  }

  Widget _allBagsView() {
    final pagedRows = _allBagRowsForTable();
    return _AllBagsView(
      rows: pagedRows.rows,
      meta: pagedRows.meta,
      filters: _allFilters,
      sortColumn: _allSortColumn,
      sortDirection: _allSortDirection,
      onFilterChanged: _applyAllBagFilter,
      onSort: _sortAllBags,
      onPageChanged: _changeAllBagPage,
      canAdd: _permissions.canAddBag,
      canEdit: _permissions.canEditBag,
      canDelete: _permissions.canDeleteBag,
      canSaveStatus: _permissions.canSaveBagStatus,
      onAdd: () => unawaited(_showBagEditor()),
      onEdit: (bag) => unawaited(_showBagEditor(bag: bag)),
      onDelete: _deleteBag,
      onMove: (bag) =>
          _showMoveDialog(bag, statuses: _moveStatusesForStatus(bag.status)),
      onLinenExchange: _recordLinenExchange,
      linenExchangeScanMode: _linenExchangeScanMode,
      canScanLinenExchange: _canScanLinenExchange,
      onLinenExchangeScanModeChanged: _setLinenExchangeScanMode,
    );
  }

  void _selectTab(int index) {
    if (index == _selectedTab) return;
    final nextTabCanScan = index == 1 || index == 2 || index == 3 || index == 4;
    _terminateRfidBatch(disableReader: !nextTabCanScan);
    setState(() {
      _selectedTab = index;
      if (index != 4) _linenExchangeScanMode = false;
    });
    _syncRfidScanAvailability();
  }

  @override
  Widget build(BuildContext context) {
    Camp? selectedCamp;
    for (final camp in _camps) {
      if (camp.id == _selectedCampId && camp.canAccess) {
        selectedCamp = camp;
      }
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppConfig.appName),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => unawaited(_refresh()),
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Settings',
            onPressed: _openSettings,
            icon: const Icon(Icons.settings_outlined),
          ),
          IconButton(
            tooltip: 'Logout',
            onPressed: () => unawaited(widget.onLogout()),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTab,
        onDestinationSelected: _selectTab,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.move_to_inbox_outlined),
            selectedIcon: Icon(Icons.move_to_inbox),
            label: 'Drop-off',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_laundry_service_outlined),
            selectedIcon: Icon(Icons.local_laundry_service),
            label: 'Facility',
          ),
          NavigationDestination(
            icon: Icon(Icons.task_alt_outlined),
            selectedIcon: Icon(Icons.task_alt),
            label: 'Ready',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'Bags',
          ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  _Header(
                    connection: _connection,
                    campName: selectedCamp?.name ?? 'No camp selected',
                    canUse: _permissions.canUse,
                  ),
                  const SizedBox(height: 12),
                  _SummaryGrid(overview: _overview),
                  const SizedBox(height: 12),
                  if (_scanResult != null &&
                      _scanResult!.tabIndex == _selectedTab) ...[
                    _RfidScanResultPanel(
                      result: _scanResult!,
                      onClear: () => setState(() => _scanResult = null),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (!_permissions.canUse)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(18),
                        child: Text(
                          'You do not have permission to use the laundry mobile app.',
                        ),
                      ),
                    )
                  else
                    _activeView(),
                ],
              ),
            ),
            if (_loading)
              const Positioned.fill(
                child: ColoredBox(
                  color: Color(0x55ffffff),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _activeView() {
    return switch (_selectedTab) {
      0 => _OverviewView(overview: _overview),
      1 => _statusLaneView('Drop-off bags', 'drop_off'),
      2 => _statusLaneView('Laundry facility bags', 'laundry_facility'),
      3 => _statusLaneView('Ready to pick up bags', 'ready_to_pick_up'),
      _ => _allBagsView(),
    };
  }

  Future<void> _openSettings() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => _SettingsScreen(
          camps: _camps,
          selectedCampId: _selectedCampId,
          campUpdates: _campUpdates.stream,
          permissionUpdates: _permissionUpdates.stream,
          canCheckForUpdate: _permissions.canDownloadLaundryApp,
          onCampChanged: _changeCamp,
          onCheckForUpdate: () => _checkForUpdate(manual: true),
        ),
      ),
    );
  }

  Future<void> _showBagEditor({LaundryBag? bag}) async {
    final editing = bag != null;
    final canSubmit = editing
        ? _permissions.canEditBag
        : _permissions.canAddBag;
    if (!canSubmit) {
      _show(
        editing
            ? 'You do not have permission to edit laundry bags.'
            : 'You do not have permission to add laundry bags.',
      );
      return;
    }

    late final _BagFormResult? result;
    _rfidHandledByDialog = true;
    try {
      result = await showDialog<_BagFormResult>(
        context: context,
        builder: (context) => _BagEditorDialog(
          bag: bag,
          canSubmit: canSubmit,
          permissionUpdates: _permissionUpdates.stream,
        ),
      );
    } finally {
      _rfidHandledByDialog = false;
      _syncRfidScanAvailability();
    }
    if (result == null) return;
    final stillAllowed = editing
        ? _permissions.canEditBag
        : _permissions.canAddBag;
    if (!stillAllowed) {
      _show('Your laundry bag permissions changed. The action was not saved.');
      return;
    }
    final confirmed = await _confirm(
      bag == null ? 'Create bag?' : 'Save bag changes?',
      bag == null
          ? 'Create bag ${result.code} with RFID ${result.rfidCode} and make it available in the selected camp.'
          : 'Update ${bag.code} with the edited code, RFID, type, and laundry-count limit.',
      messageBuilder: bag == null
          ? null
          : () {
              final current =
                  _findBagInOverview(
                    _overview,
                    id: bag.id,
                    rfidCode: bag.rfidCode,
                  ) ??
                  bag;
              return 'Update ${current.code} with the edited code, RFID, type, and laundry-count limit.';
            },
      contentUpdates: bag == null ? null : _overviewUpdates.stream,
      canConfirm: stillAllowed,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) =>
            editing ? permissions.canEditBag : permissions.canAddBag,
      ),
    );
    if (!confirmed) return;
    try {
      if (bag == null) {
        await widget.api.addBag(
          _selectedCampId,
          code: result.code,
          rfidCode: result.rfidCode,
          type: result.type,
          maxCountLaundry: result.maxCountLaundry,
        );
        _show('Bag added.');
      } else {
        await widget.api.editBag(
          _selectedCampId,
          bag,
          code: result.code,
          rfidCode: result.rfidCode,
          type: result.type,
          maxCountLaundry: result.maxCountLaundry,
        );
        _show('Bag updated.');
      }
      await _refresh(quiet: true);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  Future<void> _deleteBag(LaundryBag bag) async {
    final confirmed = await _confirm(
      'Delete ${bag.code}?',
      'Remove this bag from the selected camp. The server will block deletion if the bag is still assigned or active.',
      titleBuilder: () {
        final current =
            _findBagInOverview(_overview, id: bag.id, rfidCode: bag.rfidCode) ??
            bag;
        return 'Delete ${current.code}?';
      },
      contentUpdates: _overviewUpdates.stream,
      canConfirm: _permissions.canDeleteBag,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => permissions.canDeleteBag,
      ),
    );
    if (!confirmed) return;
    try {
      await widget.api.deleteBag(_selectedCampId, bag.id);
      _show('Bag deleted.');
      await _refresh(quiet: true);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  Future<void> _showMoveDialog(
    LaundryBag bag, {
    required List<String> statuses,
  }) async {
    if (statuses.isEmpty) {
      _show('No moves are available for ${bag.code}.');
      return;
    }
    if (!_permissions.canSaveBagStatus) {
      _show('You do not have permission to move laundry bags.');
      return;
    }
    final status = await showDialog<String>(
      context: context,
      builder: (context) => _MoveBagDialog(
        bag: bag,
        statuses: statuses,
        canMove: _permissions.canSaveBagStatus,
        permissionUpdates: _permissionUpdates.stream,
      ),
    );
    if (status == null || status.isEmpty) return;
    if (!_permissions.canSaveBagStatus) {
      _show('Your laundry status permission changed. The bag was not moved.');
      return;
    }
    final confirmed = await _confirm(
      'Move ${bag.code}?',
      'Move this bag from ${bag.statusLabel} to ${labelForLaundryStatus(status)} and refresh the laundry status tables.',
      titleBuilder: () {
        final current =
            _findBagInOverview(_overview, id: bag.id, rfidCode: bag.rfidCode) ??
            bag;
        return 'Move ${current.code}?';
      },
      messageBuilder: () {
        final current =
            _findBagInOverview(_overview, id: bag.id, rfidCode: bag.rfidCode) ??
            bag;
        return 'Move this bag from ${current.statusLabel} to ${labelForLaundryStatus(status)} and refresh the laundry status tables.';
      },
      contentUpdates: _overviewUpdates.stream,
      canConfirm: _permissions.canSaveBagStatus,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => permissions.canSaveBagStatus,
      ),
    );
    if (!confirmed) return;
    try {
      await widget.api.moveBag(_selectedCampId, bagId: bag.id, status: status);
      _show('${bag.code} moved to ${labelForLaundryStatus(status)}.');
      await _refresh(quiet: true);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  List<String> _moveStatusesForLane(String status) {
    return switch (status) {
      'drop_off' => const ['laundry_facility', 'ready_to_pick_up'],
      'laundry_facility' => const ['drop_off', 'ready_to_pick_up'],
      'ready_to_pick_up' => const ['in_soldier'],
      'in_soldier' => const ['drop_off', 'laundry_facility'],
      'pick_up' => const ['drop_off', 'laundry_facility'],
      _ => const ['drop_off', 'laundry_facility'],
    };
  }

  List<String> _moveStatusesForStatus(String status) {
    return switch (status) {
      'drop_off' => const ['laundry_facility', 'ready_to_pick_up'],
      'laundry_facility' => const ['drop_off', 'ready_to_pick_up'],
      'ready_to_pick_up' => const ['in_soldier'],
      'in_soldier' => const ['drop_off', 'laundry_facility'],
      'pick_up' => const ['drop_off', 'laundry_facility'],
      _ => const ['drop_off', 'laundry_facility'],
    };
  }

  Future<void> _recordLinenExchange(LaundryBag bag) async {
    final confirmed = await _confirm(
      'Record linen exchange?',
      'Record a completed linen exchange for ${bag.code}; this adds the exchange to the laundry reports.',
      messageBuilder: () {
        final current =
            _findBagInOverview(_overview, id: bag.id, rfidCode: bag.rfidCode) ??
            bag;
        return 'Record a completed linen exchange for ${current.code}; this adds the exchange to the laundry reports.';
      },
      contentUpdates: _overviewUpdates.stream,
      canConfirm: _permissions.canSaveBagStatus,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => permissions.canSaveBagStatus,
      ),
    );
    if (!confirmed) return;
    try {
      await widget.api.recordLinenExchange(_selectedCampId, bag.id);
      _show('Linen exchange recorded.');
      await _refresh(quiet: true);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  Future<bool> _confirm(
    String title,
    String message, {
    String Function()? titleBuilder,
    String Function()? messageBuilder,
    bool canConfirm = true,
    Stream<bool>? canConfirmUpdates,
    Stream<Object?>? contentUpdates,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => StreamBuilder<Object?>(
        stream: contentUpdates,
        builder: (context, _) => StreamBuilder<bool>(
          initialData: canConfirm,
          stream: canConfirmUpdates,
          builder: (context, snapshot) {
            final confirmEnabled = snapshot.data ?? canConfirm;
            return AlertDialog(
              title: Text(titleBuilder?.call() ?? title),
              content: Text(messageBuilder?.call() ?? message),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: confirmEnabled
                      ? () => Navigator.pop(context, true)
                      : null,
                  child: const Text('Confirm'),
                ),
              ],
            );
          },
        ),
      ),
    );
    return result == true;
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.connection,
    required this.campName,
    required this.canUse,
  });

  final String connection;
  final String campName;
  final bool canUse;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: 560,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Laundry desk',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Status flow and bag inventory',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 6),
                  Text('Camp: $campName', overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                CapabilityChip(
                  icon: connection == 'Live' ? Icons.wifi : Icons.wifi_off,
                  label: connection,
                ),
                CapabilityChip(
                  icon: canUse ? Icons.lock_open_outlined : Icons.lock_outline,
                  label: canUse ? 'Access granted' : 'Restricted',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryGrid extends StatelessWidget {
  const _SummaryGrid({required this.overview});

  final LaundryOverview overview;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return GridView.count(
      crossAxisCount: width > 1000
          ? 6
          : width > 680
          ? 3
          : 2,
      childAspectRatio: 1.45,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 8,
      mainAxisSpacing: 8,
      children: [
        SummaryTile(
          label: 'Total',
          value: '${overview.total}',
          icon: Icons.inventory_2_outlined,
        ),
        SummaryTile(
          label: 'Available',
          value: '${overview.pickUp}',
          icon: Icons.check_circle_outline,
          color: const Color(0xff15803d),
        ),
        SummaryTile(
          label: 'Drop-off',
          value: '${overview.dropOff}',
          icon: Icons.move_to_inbox_outlined,
          color: const Color(0xffb45309),
        ),
        SummaryTile(
          label: 'Facility',
          value: '${overview.laundryFacility}',
          icon: Icons.local_laundry_service_outlined,
          color: const Color(0xff2563eb),
        ),
        SummaryTile(
          label: 'Ready',
          value: '${overview.readyToPickUp}',
          icon: Icons.task_alt_outlined,
          color: const Color(0xff0f766e),
        ),
        SummaryTile(
          label: 'In soldier',
          value: '${overview.inSoldier}',
          icon: Icons.person_outline,
          color: const Color(0xff475569),
        ),
      ],
    );
  }
}

class _OverviewView extends StatelessWidget {
  const _OverviewView({required this.overview});

  final LaundryOverview overview;

  @override
  Widget build(BuildContext context) {
    final availableShare = overview.total == 0
        ? 0
        : ((overview.pickUp / overview.total) * 100).round();
    return ListSurface(
      title: 'Operational overview',
      subtitle: 'Laundry flow pressure and pickup readiness.',
      child: GridView.count(
        crossAxisCount: MediaQuery.sizeOf(context).width > 700 ? 2 : 1,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 2.4,
        children: [
          SummaryTile(
            label: 'Active status bags',
            value: '${overview.active}',
            icon: Icons.sync_alt_outlined,
          ),
          SummaryTile(
            label: 'Available share',
            value: '$availableShare%',
            icon: Icons.pie_chart_outline,
          ),
        ],
      ),
    );
  }
}

class _RfidScanResult {
  const _RfidScanResult({
    required this.tabIndex,
    required this.title,
    required this.message,
    this.bag,
    this.bagId,
    this.rfidCode,
    this.isLoading = false,
    this.isError = false,
  });

  final int tabIndex;
  final String title;
  final String message;
  final LaundryBag? bag;
  final String? bagId;
  final String? rfidCode;
  final bool isLoading;
  final bool isError;

  factory _RfidScanResult.loading({
    required int tabIndex,
    required String title,
    required String message,
  }) {
    return _RfidScanResult(
      tabIndex: tabIndex,
      title: title,
      message: message,
      isLoading: true,
    );
  }

  factory _RfidScanResult.error({
    required int tabIndex,
    required String title,
    required String message,
  }) {
    return _RfidScanResult(
      tabIndex: tabIndex,
      title: title,
      message: message,
      isError: true,
    );
  }

  factory _RfidScanResult.bag({
    required int tabIndex,
    required String title,
    required String message,
    required LaundryBag bag,
  }) {
    return _RfidScanResult(
      tabIndex: tabIndex,
      title: title,
      message: message,
      bag: bag,
      bagId: bag.id,
      rfidCode: bag.rfidCode,
    );
  }
}

class _RfidScanResultPanel extends StatelessWidget {
  const _RfidScanResultPanel({required this.result, required this.onClear});

  final _RfidScanResult result;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color = result.isError ? colorScheme.error : colorScheme.primary;
    final bag = result.bag;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (result.isLoading)
                  const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  )
                else
                  Icon(
                    result.isError ? Icons.error_outline : Icons.sensors,
                    color: color,
                  ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        result.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        result.message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(
                          context,
                        ).textTheme.bodyMedium?.copyWith(color: Colors.black54),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Clear RFID result',
                  onPressed: onClear,
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            if (bag != null) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Chip(
                    avatar: const Icon(Icons.inventory_2_outlined, size: 18),
                    label: Text(bag.code),
                  ),
                  Chip(
                    avatar: const Icon(Icons.sensors_outlined, size: 18),
                    label: Text(bag.rfidCode.isEmpty ? '-' : bag.rfidCode),
                  ),
                  Chip(
                    avatar: const Icon(Icons.category_outlined, size: 18),
                    label: Text(bag.type),
                  ),
                  StatusChip(
                    status: bag.displayStatus ?? bag.status,
                    label: bag.statusLabel,
                  ),
                  Chip(
                    avatar: const Icon(Icons.numbers_outlined, size: 18),
                    label: Text('${bag.laundryCount}/${bag.maxCountLaundry}'),
                  ),
                  if ((bag.soldierName ?? '').isNotEmpty)
                    Chip(
                      avatar: const Icon(Icons.person_outline, size: 18),
                      label: Text(bag.soldierName!),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PagedBagRows {
  const _PagedBagRows({required this.rows, required this.meta});

  final List<LaundryBag> rows;
  final TablePageMeta meta;
}

class _StatusLaneView extends StatelessWidget {
  const _StatusLaneView({
    required this.title,
    required this.rows,
    required this.meta,
    required this.filters,
    required this.sortColumn,
    required this.sortDirection,
    required this.breakdown,
    required this.canSaveStatus,
    required this.canEdit,
    required this.canDelete,
    this.scanToSoldierMode,
    this.onScanToSoldierModeChanged,
    required this.onFilterChanged,
    required this.onSort,
    required this.onPageChanged,
    required this.onEdit,
    required this.onDelete,
    required this.onMove,
    required this.onLinenExchange,
  });

  final String title;
  final List<LaundryBag> rows;
  final TablePageMeta meta;
  final Map<String, String> filters;
  final String? sortColumn;
  final String sortDirection;
  final List<LaundryTypeBreakdown> breakdown;
  final bool canSaveStatus;
  final bool canEdit;
  final bool canDelete;
  final bool? scanToSoldierMode;
  final ValueChanged<bool>? onScanToSoldierModeChanged;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;
  final Future<void> Function(int page) onPageChanged;
  final ValueChanged<LaundryBag> onEdit;
  final ValueChanged<LaundryBag> onDelete;
  final Future<void> Function(LaundryBag bag) onMove;
  final Future<void> Function(LaundryBag bag) onLinenExchange;

  @override
  Widget build(BuildContext context) {
    return ListSurface(
      title: title,
      subtitle: breakdown.isEmpty
          ? 'No bag types loaded.'
          : breakdown.map((item) => '${item.type}: ${item.count}').join(' | '),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (scanToSoldierMode != null &&
              onScanToSoldierModeChanged != null) ...[
            Align(
              alignment: Alignment.centerLeft,
              child: SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(
                    value: false,
                    icon: Icon(Icons.task_alt_outlined),
                    label: Text('Ready to pick up'),
                  ),
                  ButtonSegment(
                    value: true,
                    icon: Icon(Icons.person_outline),
                    label: Text('In soldier'),
                  ),
                ],
                selected: {scanToSoldierMode!},
                onSelectionChanged: canSaveStatus
                    ? (values) => onScanToSoldierModeChanged!(values.first)
                    : null,
              ),
            ),
            const SizedBox(height: 12),
          ],
          _BagTable(
            rows: rows,
            meta: meta,
            filters: filters,
            sortColumn: sortColumn,
            sortDirection: sortDirection,
            onFilterChanged: onFilterChanged,
            onSort: onSort,
            onPageChanged: onPageChanged,
            compact: true,
            emptyMessage: 'No bags match this status table.',
            actionsBuilder: (bag) => [
              IconButton(
                tooltip: 'Edit',
                onPressed: canEdit ? () => onEdit(bag) : null,
                icon: const Icon(Icons.edit_outlined),
              ),
              IconButton(
                tooltip: 'Delete',
                onPressed: canDelete ? () => onDelete(bag) : null,
                icon: const Icon(Icons.delete_outline),
              ),
              IconButton(
                tooltip: 'Move',
                onPressed: canSaveStatus ? () => unawaited(onMove(bag)) : null,
                icon: const Icon(Icons.drive_file_move_outline),
              ),
              IconButton(
                tooltip: 'Linen exchange',
                onPressed: canSaveStatus
                    ? () => unawaited(onLinenExchange(bag))
                    : null,
                icon: const Icon(Icons.cleaning_services_outlined),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AllBagsView extends StatelessWidget {
  const _AllBagsView({
    required this.rows,
    required this.meta,
    required this.filters,
    required this.sortColumn,
    required this.sortDirection,
    required this.onFilterChanged,
    required this.onSort,
    required this.onPageChanged,
    required this.canAdd,
    required this.canEdit,
    required this.canDelete,
    required this.canSaveStatus,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
    required this.onMove,
    required this.onLinenExchange,
    required this.linenExchangeScanMode,
    required this.canScanLinenExchange,
    required this.onLinenExchangeScanModeChanged,
  });

  final List<LaundryBag> rows;
  final TablePageMeta meta;
  final Map<String, String> filters;
  final String? sortColumn;
  final String sortDirection;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;
  final Future<void> Function(int page) onPageChanged;
  final bool canAdd;
  final bool canEdit;
  final bool canDelete;
  final bool canSaveStatus;
  final VoidCallback onAdd;
  final ValueChanged<LaundryBag> onEdit;
  final ValueChanged<LaundryBag> onDelete;
  final ValueChanged<LaundryBag> onMove;
  final ValueChanged<LaundryBag> onLinenExchange;
  final bool linenExchangeScanMode;
  final bool canScanLinenExchange;
  final ValueChanged<bool> onLinenExchangeScanModeChanged;

  @override
  Widget build(BuildContext context) {
    return ListSurface(
      title: 'All laundry bags',
      subtitle:
          'Add, edit, delete, move, and search the same inventory shown in the web Laundry workspace.',
      actionLabel: 'Add bag',
      onAction: canAdd ? onAdd : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: false,
                  icon: Icon(Icons.sensors_outlined),
                  label: Text('Lookup'),
                ),
                ButtonSegment(
                  value: true,
                  icon: Icon(Icons.cleaning_services_outlined),
                  label: Text('Linen exchange'),
                ),
              ],
              selected: {linenExchangeScanMode},
              onSelectionChanged: canScanLinenExchange
                  ? (values) => onLinenExchangeScanModeChanged(values.first)
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          _BagTable(
            rows: rows,
            meta: meta,
            filters: filters,
            sortColumn: sortColumn,
            sortDirection: sortDirection,
            onFilterChanged: onFilterChanged,
            onSort: onSort,
            onPageChanged: onPageChanged,
            emptyMessage: 'No laundry bags match the current table filters.',
            actionsBuilder: (bag) => [
              IconButton(
                tooltip: 'Edit',
                onPressed: canEdit ? () => onEdit(bag) : null,
                icon: const Icon(Icons.edit_outlined),
              ),
              IconButton(
                tooltip: 'Delete',
                onPressed: canDelete ? () => onDelete(bag) : null,
                icon: const Icon(Icons.delete_outline),
              ),
              IconButton(
                tooltip: 'Move',
                onPressed: canSaveStatus ? () => onMove(bag) : null,
                icon: const Icon(Icons.drive_file_move_outline),
              ),
              IconButton(
                tooltip: 'Record linen exchange',
                onPressed: canSaveStatus ? () => onLinenExchange(bag) : null,
                icon: const Icon(Icons.cleaning_services_outlined),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BagTable extends StatelessWidget {
  const _BagTable({
    required this.rows,
    required this.meta,
    required this.filters,
    required this.sortColumn,
    required this.sortDirection,
    required this.onFilterChanged,
    required this.onSort,
    required this.onPageChanged,
    required this.emptyMessage,
    this.actionsBuilder,
    this.compact = false,
  });

  final List<LaundryBag> rows;
  final TablePageMeta meta;
  final Map<String, String> filters;
  final String? sortColumn;
  final String sortDirection;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;
  final Future<void> Function(int page) onPageChanged;
  final String emptyMessage;
  final List<Widget> Function(LaundryBag bag)? actionsBuilder;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    const actionWidth = 200.0;
    return Column(
      children: [
        _DataTableViewport(
          child: DataTable(
            headingRowHeight: 96,
            dataRowMinHeight: 58,
            dataRowMaxHeight: 72,
            columnSpacing: 18,
            horizontalMargin: 12,
            columns: [
              _column('Code', 'code', width: 150),
              if (!compact) _column('RFID code', 'rfidCode', width: 160),
              _column('Type', 'type', width: 120),
              _column('Status', 'status', width: 150),
              _column('Soldier', 'soldier', width: 180),
              if (!compact)
                _column('Count', 'count', width: 120, searchable: false),
              if (actionsBuilder != null)
                DataColumn(
                  label: SizedBox(
                    width: actionWidth,
                    child: const Text('Actions'),
                  ),
                ),
            ],
            rows: rows.map(_row).toList(),
          ),
        ),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: EmptyState(message: emptyMessage),
          ),
        _PaginationBar(meta: meta, onPageChanged: onPageChanged),
      ],
    );
  }

  DataColumn _column(
    String title,
    String column, {
    required double width,
    bool searchable = true,
  }) {
    return DataColumn(
      label: _TableHeader(
        title: title,
        column: column,
        width: width,
        filterValue: filters[column] ?? '',
        activeSortColumn: sortColumn,
        sortDirection: sortDirection,
        onFilterChanged: onFilterChanged,
        onSort: onSort,
        searchable: searchable,
      ),
    );
  }

  DataRow _row(LaundryBag bag) {
    return DataRow(
      cells: [
        DataCell(_cellText(bag.code, 150)),
        if (!compact)
          DataCell(_cellText(bag.rfidCode.isEmpty ? '-' : bag.rfidCode, 160)),
        DataCell(_cellText(bag.type, 120)),
        DataCell(
          SizedBox(
            width: 150,
            child: StatusChip(
              status: bag.displayStatus ?? bag.status,
              label: bag.statusLabel,
            ),
          ),
        ),
        DataCell(_cellText(bag.soldierName ?? '-', 180)),
        if (!compact)
          DataCell(
            _cellText('${bag.laundryCount}/${bag.maxCountLaundry}', 120),
          ),
        if (actionsBuilder != null)
          DataCell(
            SizedBox(
              width: 200,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: actionsBuilder!(bag),
              ),
            ),
          ),
      ],
    );
  }
}

class _DataTableViewport extends StatefulWidget {
  const _DataTableViewport({required this.child});

  final Widget child;

  @override
  State<_DataTableViewport> createState() => _DataTableViewportState();
}

class _DataTableViewportState extends State<_DataTableViewport> {
  final _horizontal = ScrollController();

  @override
  void dispose() {
    _horizontal.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final minWidth = constraints.hasBoundedWidth
            ? constraints.maxWidth
            : 0.0;
        return Scrollbar(
          controller: _horizontal,
          thumbVisibility: true,
          notificationPredicate: (notification) =>
              notification.metrics.axis == Axis.horizontal,
          child: SingleChildScrollView(
            controller: _horizontal,
            scrollDirection: Axis.horizontal,
            child: ConstrainedBox(
              constraints: BoxConstraints(minWidth: minWidth),
              child: Align(alignment: Alignment.topLeft, child: widget.child),
            ),
          ),
        );
      },
    );
  }
}

class _TableHeader extends StatefulWidget {
  const _TableHeader({
    required this.title,
    required this.column,
    required this.width,
    required this.filterValue,
    required this.activeSortColumn,
    required this.sortDirection,
    required this.onFilterChanged,
    required this.onSort,
    required this.searchable,
  });

  final String title;
  final String column;
  final double width;
  final String filterValue;
  final String? activeSortColumn;
  final String sortDirection;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;
  final bool searchable;

  @override
  State<_TableHeader> createState() => _TableHeaderState();
}

class _TableHeaderState extends State<_TableHeader> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.filterValue,
  );
  Timer? _debounce;

  @override
  void didUpdateWidget(covariant _TableHeader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.filterValue != _controller.text) {
      _controller.text = widget.filterValue;
      _controller.selection = TextSelection.collapsed(
        offset: _controller.text.length,
      );
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _scheduleFilter(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      widget.onFilterChanged(widget.column, value);
    });
  }

  void _submitFilter(String value) {
    _debounce?.cancel();
    widget.onFilterChanged(widget.column, value);
  }

  @override
  Widget build(BuildContext context) {
    final active =
        widget.activeSortColumn == widget.column &&
        widget.sortDirection != 'default';
    final icon = active
        ? (widget.sortDirection == 'desc'
              ? Icons.arrow_downward
              : Icons.arrow_upward)
        : Icons.unfold_more;

    return SizedBox(
      width: widget.width,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.searchable)
            SizedBox(
              height: 38,
              child: TextField(
                controller: _controller,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search ${widget.title.toLowerCase()}',
                  prefixIcon: const Icon(Icons.search, size: 18),
                  suffixIcon: _controller.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Clear ${widget.title}',
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _controller.clear();
                            _submitFilter('');
                            setState(() {});
                          },
                        ),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 8,
                  ),
                ),
                onChanged: (value) {
                  setState(() {});
                  _scheduleFilter(value);
                },
                onSubmitted: _submitFilter,
              ),
            )
          else
            const SizedBox(height: 38),
          const SizedBox(height: 6),
          InkWell(
            onTap: () => unawaited(widget.onSort(widget.column)),
            borderRadius: BorderRadius.circular(6),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ),
                  Icon(icon, size: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaginationBar extends StatelessWidget {
  const _PaginationBar({required this.meta, required this.onPageChanged});

  final TablePageMeta meta;
  final Future<void> Function(int page) onPageChanged;

  @override
  Widget build(BuildContext context) {
    final page = meta.page < 1 ? 1 : meta.page;
    final totalPages = meta.totalPages < 1 ? 1 : meta.totalPages;
    final firstRow = meta.total == 0 ? 0 : ((page - 1) * meta.limit) + 1;
    final lastRow = meta.total == 0
        ? 0
        : (firstRow + meta.limit - 1).clamp(0, meta.total);

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '$firstRow-$lastRow of ${meta.total} (${meta.sourceTotal} total)',
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          IconButton(
            tooltip: 'Previous page',
            onPressed: page <= 1
                ? null
                : () => unawaited(onPageChanged(page - 1)),
            icon: const Icon(Icons.chevron_left),
          ),
          Text('Page $page of $totalPages'),
          IconButton(
            tooltip: 'Next page',
            onPressed: page >= totalPages
                ? null
                : () => unawaited(onPageChanged(page + 1)),
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

Widget _cellText(String value, double width) => SizedBox(
  width: width,
  child: Text(value, maxLines: 2, overflow: TextOverflow.ellipsis),
);

class _SettingsScreen extends StatefulWidget {
  const _SettingsScreen({
    required this.camps,
    required this.selectedCampId,
    required this.campUpdates,
    required this.permissionUpdates,
    required this.canCheckForUpdate,
    required this.onCampChanged,
    required this.onCheckForUpdate,
  });

  final List<Camp> camps;
  final String selectedCampId;
  final Stream<List<Camp>> campUpdates;
  final Stream<LaundryAppPermissions> permissionUpdates;
  final bool canCheckForUpdate;
  final Future<void> Function(String campId) onCampChanged;
  final Future<void> Function() onCheckForUpdate;

  @override
  State<_SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<_SettingsScreen> {
  static const _minRfidPower = 1;
  static const _maxRfidPower = 30;

  double? _rfidPower;
  bool _rfidPowerBusy = false;
  String _rfidPowerMessage = 'Loading RFID strength...';
  late List<Camp> _camps = widget.camps;
  late bool _canCheckForUpdate = widget.canCheckForUpdate;
  StreamSubscription<List<Camp>>? _campSubscription;
  StreamSubscription<LaundryAppPermissions>? _permissionSubscription;

  @override
  void initState() {
    super.initState();
    _campSubscription = widget.campUpdates.listen((camps) {
      if (mounted) setState(() => _camps = camps);
    });
    _permissionSubscription = widget.permissionUpdates.listen((permissions) {
      if (!mounted) return;
      setState(() {
        _canCheckForUpdate = permissions.canDownloadLaundryApp;
      });
    });
    unawaited(_loadRfidPower());
  }

  @override
  void didUpdateWidget(covariant _SettingsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(widget.camps, oldWidget.camps)) {
      _camps = widget.camps;
    }
    if (widget.canCheckForUpdate != oldWidget.canCheckForUpdate) {
      _canCheckForUpdate = widget.canCheckForUpdate;
    }
    if (!identical(widget.campUpdates, oldWidget.campUpdates)) {
      unawaited(_campSubscription?.cancel());
      _campSubscription = widget.campUpdates.listen((camps) {
        if (mounted) setState(() => _camps = camps);
      });
    }
    if (!identical(widget.permissionUpdates, oldWidget.permissionUpdates)) {
      unawaited(_permissionSubscription?.cancel());
      _permissionSubscription = widget.permissionUpdates.listen((permissions) {
        if (!mounted) return;
        setState(() {
          _canCheckForUpdate = permissions.canDownloadLaundryApp;
        });
      });
    }
  }

  @override
  void dispose() {
    unawaited(_campSubscription?.cancel());
    unawaited(_permissionSubscription?.cancel());
    super.dispose();
  }

  Future<void> _loadRfidPower() async {
    setState(() {
      _rfidPowerBusy = true;
      _rfidPowerMessage = 'Loading RFID strength...';
    });
    try {
      final power = await NativeBridge.rfidPower();
      if (!mounted) return;
      setState(() {
        _rfidPower = power.clamp(_minRfidPower, _maxRfidPower).toDouble();
        _rfidPowerMessage = 'RFID reading strength: ${_rfidPower!.round()} dBm';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _rfidPower = null;
        _rfidPowerMessage = errorMessage(error);
      });
    } finally {
      if (mounted) setState(() => _rfidPowerBusy = false);
    }
  }

  Future<void> _saveRfidPower(double value) async {
    setState(() {
      _rfidPowerBusy = true;
      _rfidPower = value;
      _rfidPowerMessage = 'Setting RFID reading strength...';
    });
    try {
      final power = await NativeBridge.setRfidPower(value.round());
      if (!mounted) return;
      setState(() {
        _rfidPower = power.clamp(_minRfidPower, _maxRfidPower).toDouble();
        _rfidPowerMessage = 'RFID reading strength: ${_rfidPower!.round()} dBm';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _rfidPowerMessage = errorMessage(error));
    } finally {
      if (mounted) setState(() => _rfidPowerBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    Camp? selectedCamp;
    for (final camp in _camps) {
      if (camp.id == widget.selectedCampId && camp.canAccess) {
        selectedCamp = camp;
      }
    }
    final rfidPower = _rfidPower ?? _maxRfidPower.toDouble();
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ListSurface(
              title: 'Camp',
              subtitle: 'Choose the active camp for laundry records.',
              child: SearchSelectionField<Camp>(
                labelText: 'Camp',
                leadingIcon: Icons.location_city_outlined,
                options: _camps,
                optionsStream: widget.campUpdates,
                selectedValue: selectedCamp,
                itemLabel: (camp) => camp.name,
                itemSubtitle: (camp) =>
                    camp.canAccess ? camp.id : '${camp.id} - No access',
                itemEnabled: (camp) => camp.canAccess,
                onChanged: (camp) async {
                  await widget.onCampChanged(camp.id);
                  if (context.mounted) Navigator.pop(context);
                },
                emptyMessage: 'No camps found.',
              ),
            ),
            const SizedBox(height: 12),
            ListSurface(
              title: 'RFID',
              subtitle: 'Adjust reader strength for handheld bag scans.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(_rfidPowerMessage),
                  Slider(
                    min: _minRfidPower.toDouble(),
                    max: _maxRfidPower.toDouble(),
                    divisions: _maxRfidPower - _minRfidPower,
                    label: '${rfidPower.round()} dBm',
                    value: rfidPower,
                    onChanged: _rfidPowerBusy
                        ? null
                        : (value) => setState(() {
                            _rfidPower = value;
                            _rfidPowerMessage =
                                'RFID reading strength: ${value.round()} dBm';
                          }),
                    onChangeEnd: _rfidPowerBusy
                        ? null
                        : (value) => unawaited(_saveRfidPower(value)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            ListSurface(
              title: 'Updates',
              subtitle: 'Check whether a newer Android package is available.',
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _canCheckForUpdate
                      ? () => unawaited(widget.onCheckForUpdate())
                      : null,
                  icon: const Icon(Icons.system_update_alt),
                  label: const Text('Check for new version'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BagEditorDialog extends StatefulWidget {
  const _BagEditorDialog({
    this.bag,
    required this.canSubmit,
    required this.permissionUpdates,
  });

  final LaundryBag? bag;
  final bool canSubmit;
  final Stream<LaundryAppPermissions> permissionUpdates;

  @override
  State<_BagEditorDialog> createState() => _BagEditorDialogState();
}

class _BagEditorDialogState extends State<_BagEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _code = TextEditingController(text: widget.bag?.code ?? '');
  late final _rfid = TextEditingController(text: widget.bag?.rfidCode ?? '');
  late final _type = TextEditingController(
    text: widget.bag?.type == '-' ? '' : widget.bag?.type ?? '',
  );
  late final _maxCount = TextEditingController(
    text: '${widget.bag?.maxCountLaundry ?? 1}',
  );
  StreamSubscription<String>? _rfidSubscription;
  StreamSubscription<LaundryAppPermissions>? _permissionSubscription;
  bool _acceptingRfidScans = true;
  String _scanMessage = '';
  late bool _canSubmit;

  @override
  void initState() {
    super.initState();
    _canSubmit = widget.canSubmit;
    _bindPermissionUpdates();
    unawaited(_ignoreNative(NativeBridge.setRfidScanEnabled(true)));
    _rfidSubscription = NativeBridge.rfidScans.listen(
      _handleRfidScan,
      onError: (error) {
        if (!mounted) return;
        final message = error is PlatformException
            ? (error.message?.trim().isNotEmpty == true
                  ? error.message!.trim()
                  : error.code)
            : errorMessage(error);
        setState(() => _scanMessage = message);
      },
    );
  }

  @override
  void didUpdateWidget(covariant _BagEditorDialog oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(widget.permissionUpdates, oldWidget.permissionUpdates)) {
      unawaited(_permissionSubscription?.cancel());
      _bindPermissionUpdates();
    }
  }

  @override
  void dispose() {
    unawaited(_permissionSubscription?.cancel());
    _stopRfidScans();
    _code.dispose();
    _rfid.dispose();
    _type.dispose();
    _maxCount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.bag != null;
    final formEnabled = _canSubmit;
    return AlertDialog(
      title: Text(editing ? 'Edit laundry bag' : 'Add laundry bag'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _code,
                enabled: formEnabled,
                decoration: const InputDecoration(
                  labelText: 'Code',
                  prefixIcon: Icon(Icons.inventory_2_outlined),
                ),
                validator: _required,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _rfid,
                enabled: formEnabled,
                decoration: const InputDecoration(
                  labelText: 'RFID code',
                  prefixIcon: Icon(Icons.sensors_outlined),
                ),
                validator: _required,
              ),
              if (_scanMessage.isNotEmpty) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    _scanMessage,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              TextFormField(
                controller: _type,
                enabled: formEnabled,
                decoration: const InputDecoration(
                  labelText: 'Type',
                  prefixIcon: Icon(Icons.category_outlined),
                ),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _maxCount,
                enabled: formEnabled,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Max laundry count',
                  prefixIcon: Icon(Icons.numbers_outlined),
                ),
                validator: _positiveInt,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            _stopRfidScans();
            Navigator.pop(context);
          },
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _canSubmit ? _submit : null,
          child: Text(editing ? 'Save' : 'Create'),
        ),
      ],
    );
  }

  void _bindPermissionUpdates() {
    _permissionSubscription = widget.permissionUpdates.listen((permissions) {
      final nextCanSubmit = widget.bag != null
          ? permissions.canEditBag
          : permissions.canAddBag;
      if (mounted) setState(() => _canSubmit = nextCanSubmit);
    });
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Required.' : null;

  String? _positiveInt(String? value) {
    final parsed = int.tryParse(value ?? '');
    if (parsed == null || parsed < 1) return 'Enter a positive number.';
    return null;
  }

  Future<void> _ignoreNative(Future<void> future) async {
    try {
      await future;
    } catch (_) {}
  }

  void _handleRfidScan(String rfidCode) {
    if (!mounted || !_acceptingRfidScans) return;
    if (!_canSubmit) return;
    final normalizedCode = rfidCode.trim();
    if (normalizedCode.isEmpty) return;
    setState(() {
      _rfid.text = normalizedCode;
      _scanMessage = 'RFID code updated.';
    });
  }

  void _stopRfidScans() {
    if (!_acceptingRfidScans && _rfidSubscription == null) return;
    _acceptingRfidScans = false;
    unawaited(_rfidSubscription?.cancel());
    _rfidSubscription = null;
    unawaited(_ignoreNative(NativeBridge.setRfidScanEnabled(false)));
  }

  void _submit() {
    if (!_canSubmit) return;
    if (!_formKey.currentState!.validate()) return;
    _stopRfidScans();
    Navigator.pop(
      context,
      _BagFormResult(
        code: _code.text.trim(),
        rfidCode: _rfid.text.trim(),
        type: _type.text.trim(),
        maxCountLaundry: int.parse(_maxCount.text.trim()),
      ),
    );
  }
}

class _BagFormResult {
  const _BagFormResult({
    required this.code,
    required this.rfidCode,
    required this.type,
    required this.maxCountLaundry,
  });

  final String code;
  final String rfidCode;
  final String type;
  final int maxCountLaundry;
}

class _MoveBagDialog extends StatefulWidget {
  const _MoveBagDialog({
    required this.bag,
    required this.statuses,
    required this.canMove,
    required this.permissionUpdates,
  });

  final LaundryBag bag;
  final List<String> statuses;
  final bool canMove;
  final Stream<LaundryAppPermissions> permissionUpdates;

  @override
  State<_MoveBagDialog> createState() => _MoveBagDialogState();
}

class _MoveBagDialogState extends State<_MoveBagDialog> {
  StreamSubscription<LaundryAppPermissions>? _permissionSubscription;
  late bool _canMove;

  @override
  void initState() {
    super.initState();
    _canMove = widget.canMove;
    _bindPermissionUpdates();
  }

  @override
  void didUpdateWidget(covariant _MoveBagDialog oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(widget.permissionUpdates, oldWidget.permissionUpdates)) {
      unawaited(_permissionSubscription?.cancel());
      _bindPermissionUpdates();
    }
  }

  @override
  void dispose() {
    unawaited(_permissionSubscription?.cancel());
    super.dispose();
  }

  void _bindPermissionUpdates() {
    _permissionSubscription = widget.permissionUpdates.listen((permissions) {
      if (mounted) setState(() => _canMove = permissions.canSaveBagStatus);
    });
  }

  @override
  Widget build(BuildContext context) {
    return SimpleDialog(
      title: Text('Move ${widget.bag.code}'),
      children: [
        if (!_canMove)
          const Padding(
            padding: EdgeInsets.fromLTRB(24, 0, 24, 12),
            child: Text('You do not have permission to move laundry bags.'),
          ),
        ...widget.statuses.map(
          (status) => ListTile(
            enabled: _canMove,
            leading: const Icon(Icons.drive_file_move_outline),
            title: Text(labelForLaundryStatus(status)),
            onTap: _canMove ? () => Navigator.pop(context, status) : null,
          ),
        ),
      ],
    );
  }
}
