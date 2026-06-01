import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/bike_models.dart';
import '../services/bike_api_client.dart';
import '../services/bike_socket_client.dart';
import '../services/native_bridge.dart';
import '../utils/formatters.dart';
import '../widgets/asset_dialog.dart';
import '../widgets/common_widgets.dart';
import '../widgets/rental_dialogs.dart';

class BikeOperationsScreen extends StatefulWidget {
  const BikeOperationsScreen({
    required this.api,
    required this.onLogout,
    required this.onAuthExpired,
    super.key,
  });

  final BikeApiClient api;
  final Future<void> Function() onLogout;
  final Future<void> Function() onAuthExpired;

  @override
  State<BikeOperationsScreen> createState() => _BikeOperationsScreenState();
}

class _BikeOperationsScreenState extends State<BikeOperationsScreen>
    with WidgetsBindingObserver {
  late final BikeSocketClient _socket = BikeSocketClient(
    api: widget.api,
    onChanged: _scheduleRealtimeRefresh,
    onCampsChanged: _scheduleCampRefresh,
    onSoldiersChanged: () => _scheduleRealtimeRefresh(includeSoldiers: true),
    onPermissionsChanged: _schedulePermissionRefresh,
    onBikeStatusChanged: _handleRealtimeBikeStatusChanged,
    onConnectionState: (value) {
      if (mounted) setState(() => _connection = value);
    },
    onAuthExpired: () {
      unawaited(_handleAuthExpired());
    },
  );

  bool _loading = true;
  String _connection = 'Offline';
  int _selectedTab = 0;
  String _selectedCampId = '';
  InventorySummary _summary = const InventorySummary();
  int _totalBicycles = 0;
  int _helmetPairingCount = 0;
  int _needsAttention = 0;
  BikeAppPermissions _permissions = const BikeAppPermissions();
  List<Camp> _camps = const [];
  List<BicycleAsset> _inventoryBicycles = const [];
  List<HelmetAsset> _inventoryHelmets = const [];
  List<BicycleAsset> _bicycles = const [];
  List<HelmetAsset> _helmets = const [];
  List<Soldier> _soldiers = const [];
  TablePageMeta _bikeMeta = const TablePageMeta();
  TablePageMeta _helmetMeta = const TablePageMeta();
  int _bikePage = 1;
  int _helmetPage = 1;
  String? _bikeSortColumn;
  String _bikeSortDirection = 'default';
  String? _helmetSortColumn;
  String _helmetSortDirection = 'default';
  final Map<String, String> _bikeFilters = {
    'name': '',
    'nfcCode': '',
    'status': '',
    'assignedSoldier': '',
    'helmetCode': '',
    'rentedAt': '',
  };
  final Map<String, String> _helmetFilters = {
    'code': '',
    'nfcCode': '',
    'status': '',
    'bicycleName': '',
    'assignedSoldier': '',
  };
  final Map<String, String> _soldierFilters = {
    'name': '',
    'country': '',
    'activeAssignmentCount': '',
  };
  Timer? _refreshDebounce;
  Timer? _campRefreshDebounce;
  Timer? _permissionRefreshDebounce;
  Timer? _bikeTableDebounce;
  Timer? _helmetTableDebounce;
  StreamSubscription<String>? _nfcSubscription;
  final StreamController<List<Camp>> _campUpdates =
      StreamController<List<Camp>>.broadcast();
  final StreamController<BikeAppPermissions> _permissionUpdates =
      StreamController<BikeAppPermissions>.broadcast();
  final StreamController<List<Soldier>> _soldierUpdates =
      StreamController<List<Soldier>>.broadcast();
  final StreamController<List<HelmetAsset>> _helmetUpdates =
      StreamController<List<HelmetAsset>>.broadcast();
  final StreamController<List<BicycleAsset>> _bicycleUpdates =
      StreamController<List<BicycleAsset>>.broadcast();
  bool _refreshInFlight = false;
  bool _refreshAgain = false;
  bool _refreshSoldiersOnNextRealtime = false;
  bool _inventoryLoaded = false;
  bool _nfcHandledByDialog = false;
  bool _rentDialogOpening = false;
  bool _updatePromptOpen = false;
  bool _authExpired = false;
  _NfcScanResult? _scanResult;
  final Map<String, String> _lastBikeStatuses = {};
  final Set<String> _lateBikeNotificationKeys = {};
  final Set<String> _appUpdateNotificationVersions = {};
  bool _bikePageLoadInFlight = false;
  bool _helmetPageLoadInFlight = false;
  int? _pendingBikePage;
  int? _pendingHelmetPage;
  int _bikeRequestToken = 0;
  int _helmetRequestToken = 0;

  int get _activeTab =>
      _selectedTab < 0 ? 0 : (_selectedTab > 3 ? 3 : _selectedTab);

  bool get _canLoadSoldiers => _permissions.hasSectionAccess;

  void _selectTab(int index) {
    final nextTab = index < 0 ? 0 : (index > 3 ? 3 : index);
    final bikes = _inventoryLoaded && nextTab == 1
        ? _bicyclePageFromInventory(_inventoryBicycles, page: _bikePage)
        : null;
    final helmets = _inventoryLoaded && nextTab == 2
        ? _helmetPageFromInventory(_inventoryHelmets, page: _helmetPage)
        : null;

    setState(() {
      _selectedTab = nextTab;
      if (bikes != null) {
        _bicycles = bikes.rows;
        _bikeMeta = bikes.meta;
        _bikePage = bikes.meta.page;
      }
      if (helmets != null) {
        _helmets = helmets.rows;
        _helmetMeta = helmets.meta;
        _helmetPage = helmets.meta.page;
      }
    });
    if (nextTab == 3 && _canLoadSoldiers && _soldiers.isEmpty) {
      unawaited(_refresh(quiet: true, includeSoldiers: true));
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _listenForNfcScans();
    unawaited(_loadInitial());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refreshDebounce?.cancel();
    _campRefreshDebounce?.cancel();
    _permissionRefreshDebounce?.cancel();
    _bikeTableDebounce?.cancel();
    _helmetTableDebounce?.cancel();
    unawaited(_nfcSubscription?.cancel());
    unawaited(_socket.disconnect());
    unawaited(_campUpdates.close());
    unawaited(_permissionUpdates.close());
    unawaited(_soldierUpdates.close());
    unawaited(_helmetUpdates.close());
    unawaited(_bicycleUpdates.close());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_handlePendingUpdateNotificationTap());
    }
  }

  Future<void> _handlePendingUpdateNotificationTap() async {
    if (!await NativeBridge.consumeAppUpdateNotificationTap()) return;
    await _checkForUpdate(manual: true);
  }

  Future<void> _loadInitial() async {
    try {
      final camps = await widget.api.camps();
      final permissions = await widget.api.permissions();
      if (!mounted) return;
      setState(() {
        _camps = camps;
        _permissions = permissions;
        _selectedCampId = camps.isNotEmpty ? camps.first.id : '';
      });
      _publishCampOptions();
      _publishPermissionOptions();
      await _socket.connect();
      await _refresh(includeSoldiers: _canLoadSoldiers);
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

  void _listenForNfcScans() {
    _nfcSubscription = NativeBridge.nfcScans.listen(
      (nfcCode) => unawaited(_handleNfcScan(nfcCode)),
      onError: (_) {},
    );
  }

  void _publishCampOptions() {
    if (!_campUpdates.isClosed) _campUpdates.add(_camps);
  }

  void _publishPermissionOptions() {
    if (!_permissionUpdates.isClosed) _permissionUpdates.add(_permissions);
  }

  void _publishAssignmentOptions() {
    if (!_soldierUpdates.isClosed) _soldierUpdates.add(_soldiers);
    if (!_helmetUpdates.isClosed) _helmetUpdates.add(_inventoryHelmets);
  }

  void _scheduleRealtimeRefresh({bool includeSoldiers = false}) {
    _refreshSoldiersOnNextRealtime =
        _refreshSoldiersOnNextRealtime || includeSoldiers;
    _refreshDebounce?.cancel();
    _refreshDebounce = Timer(const Duration(milliseconds: 800), () {
      unawaited(_coalescedRefresh());
    });
  }

  void _scheduleCampRefresh() {
    _campRefreshDebounce?.cancel();
    _campRefreshDebounce = Timer(const Duration(milliseconds: 500), () {
      unawaited(_refreshCamps());
    });
  }

  void _schedulePermissionRefresh() {
    _permissionRefreshDebounce?.cancel();
    _permissionRefreshDebounce = Timer(const Duration(milliseconds: 500), () {
      unawaited(_refreshPermissions());
    });
  }

  Future<void> _handleAuthExpired() async {
    if (_authExpired) return;
    _authExpired = true;
    if (mounted) _show('Session access changed. Sign in again.');
    await _socket.disconnect();
    await widget.onAuthExpired();
  }

  Future<void> _refreshPermissions() async {
    try {
      final permissions = await widget.api.permissions();
      if (!mounted) return;
      final hadUse = _permissions.canUse;
      final hadSoldierAccess = _canLoadSoldiers;
      final hadSectionAccess = _permissions.hasSectionAccess;
      setState(() {
        _permissions = permissions;
        if (hadSoldierAccess && !_canLoadSoldiers) {
          _soldiers = const [];
        }
      });
      _publishPermissionOptions();
      if (hadSoldierAccess && !_canLoadSoldiers) {
        _publishAssignmentOptions();
      }
      if (permissions.hasSectionAccess && !hadSectionAccess) {
        await _socket.connect();
      }
      if (!permissions.canUse) {
        _closeOpenModalWindows();
      }
      if (permissions.canUse && !hadUse) {
        await _refresh(quiet: true, includeSoldiers: _canLoadSoldiers);
      } else if (!hadSoldierAccess && _canLoadSoldiers && _activeTab == 3) {
        await _refresh(quiet: true, includeSoldiers: true);
      }
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else {
        _show(errorMessage(error));
      }
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
      final selectedStillExists =
          _selectedCampId.isNotEmpty &&
          camps.any((camp) => camp.id == _selectedCampId);
      final nextSelectedCampId = selectedStillExists
          ? _selectedCampId
          : (camps.isNotEmpty ? camps.first.id : '');
      final campChanged = nextSelectedCampId != _selectedCampId;
      setState(() {
        _camps = camps;
        _selectedCampId = nextSelectedCampId;
        if (campChanged) {
          _bikePage = 1;
          _helmetPage = 1;
          _inventoryLoaded = false;
          _inventoryBicycles = const [];
          _inventoryHelmets = const [];
          if (nextSelectedCampId.isEmpty) {
            _summary = const InventorySummary();
            _totalBicycles = 0;
            _helmetPairingCount = 0;
            _needsAttention = 0;
            _bicycles = const [];
            _helmets = const [];
            _soldiers = const [];
          }
        }
      });
      _publishCampOptions();
      if (campChanged && nextSelectedCampId.isEmpty) {
        _publishAssignmentOptions();
      }
      if (campChanged && nextSelectedCampId.isNotEmpty) {
        await _refresh(quiet: true, includeSoldiers: _canLoadSoldiers);
      }
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      }
    }
  }

  bool _isAuthFailure(Object error) {
    if (error is! BikeApiException) return false;
    final code = (error.code ?? '').toUpperCase();
    return error.statusCode == 401 ||
        error.statusCode == 423 ||
        code == 'INVALID_TOKEN' ||
        code == 'INVALID_REFRESH_TOKEN' ||
        code == 'SOCKET_TOKEN_REVOKED' ||
        code == 'SOCKET_SESSION_INVALID' ||
        code == 'ACCOUNT_LOCKED';
  }

  Future<void> _coalescedRefresh() async {
    if (_refreshInFlight) {
      _refreshAgain = true;
      return;
    }

    _refreshInFlight = true;
    try {
      do {
        final includeSoldiers =
            _canLoadSoldiers &&
            (_refreshSoldiersOnNextRealtime || _activeTab == 3);
        _refreshSoldiersOnNextRealtime = false;
        _refreshAgain = false;
        await _refresh(quiet: true, includeSoldiers: includeSoldiers);
      } while (_refreshAgain);
    } finally {
      _refreshInFlight = false;
    }
  }

  Future<void> _refresh({
    bool quiet = false,
    bool includeSoldiers = true,
  }) async {
    if (_selectedCampId.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    if (!quiet && mounted) setState(() => _loading = true);
    try {
      final results = await Future.wait<Object>([
        widget.api.inventory(_selectedCampId),
        includeSoldiers && _canLoadSoldiers
            ? widget.api.soldiers(_selectedCampId, '')
            : Future.value(_soldiers),
      ]);
      final snapshot = results[0] as InventorySnapshot;
      final soldiers = results[1] as List<Soldier>;
      final loadBicycles = !quiet || _activeTab == 1;
      final loadHelmets = !quiet || _activeTab == 2;
      final bikes = loadBicycles
          ? _bicyclePageFromInventory(snapshot.bicycles, page: _bikePage)
          : PagedBicycleAssets(rows: _bicycles, meta: _bikeMeta);
      final helmets = loadHelmets
          ? _helmetPageFromInventory(snapshot.helmets, page: _helmetPage)
          : PagedHelmetAssets(rows: _helmets, meta: _helmetMeta);
      if (!mounted) return;
      final previousBikeStatuses = Map<String, String>.from(_lastBikeStatuses);
      setState(() {
        _summary = snapshot.summary;
        _totalBicycles = snapshot.totalBicycles;
        _helmetPairingCount = snapshot.helmetPairingCount;
        _needsAttention = snapshot.needsAttention;
        _inventoryBicycles = snapshot.bicycles;
        _inventoryHelmets = snapshot.helmets;
        _inventoryLoaded = true;
        _bicycles = bikes.rows;
        _bikeMeta = bikes.meta;
        _bikePage = bikes.meta.page;
        _helmets = helmets.rows;
        _helmetMeta = helmets.meta;
        _helmetPage = helmets.meta.page;
        _soldiers = soldiers;
        _loading = false;
      });
      _publishAssignmentOptions();
      if (!_bicycleUpdates.isClosed) _bicycleUpdates.add(snapshot.bicycles);
      _notifyNewLateBikes(previousBikeStatuses, snapshot.bicycles);
      _rememberBikeStatuses(snapshot.bicycles);
      unawaited(_refreshCurrentScanResult());
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
        return;
      }
      _show(errorMessage(error));
      if (mounted) setState(() => _loading = false);
    }
  }

  PagedBicycleAssets _bicyclePageFromInventory(
    List<BicycleAsset> source, {
    required int page,
  }) {
    final rows = source.where(_matchesBikeFilters).toList();
    _sortRows<BicycleAsset>(
      rows,
      sortColumn: _bikeSortColumn,
      sortDirection: _bikeSortDirection,
      valueForColumn: _bikeColumnValue,
    );
    final boundedPage = _boundedTablePage(page, rows.length);
    return PagedBicycleAssets(
      rows: _pageRows(rows, boundedPage),
      meta: _localTableMeta(
        page: boundedPage,
        total: rows.length,
        sourceTotal: source.length,
        sortColumn: _bikeSortColumn,
        sortDirection: _bikeSortDirection,
      ),
    );
  }

  PagedHelmetAssets _helmetPageFromInventory(
    List<HelmetAsset> source, {
    required int page,
  }) {
    final rows = source.where(_matchesHelmetFilters).toList();
    _sortRows<HelmetAsset>(
      rows,
      sortColumn: _helmetSortColumn,
      sortDirection: _helmetSortDirection,
      valueForColumn: _helmetColumnValue,
    );
    final boundedPage = _boundedTablePage(page, rows.length);
    return PagedHelmetAssets(
      rows: _pageRows(rows, boundedPage),
      meta: _localTableMeta(
        page: boundedPage,
        total: rows.length,
        sourceTotal: source.length,
        sortColumn: _helmetSortColumn,
        sortDirection: _helmetSortDirection,
      ),
    );
  }

  bool _matchesBikeFilters(BicycleAsset bike) {
    for (final entry in _bikeFilters.entries) {
      final needle = entry.value.trim();
      if (needle.isEmpty) continue;
      if (!_matchesFilter(_bikeColumnValue(bike, entry.key), needle)) {
        return false;
      }
    }
    return true;
  }

  bool _matchesHelmetFilters(HelmetAsset helmet) {
    for (final entry in _helmetFilters.entries) {
      final needle = entry.value.trim();
      if (needle.isEmpty) continue;
      if (!_matchesFilter(_helmetColumnValue(helmet, entry.key), needle)) {
        return false;
      }
    }
    return true;
  }

  List<Soldier> _soldierRowsForTable() {
    final rows = _soldiers.where(_matchesSoldierFilters).toList();
    return rows;
  }

  bool _matchesSoldierFilters(Soldier soldier) {
    for (final entry in _soldierFilters.entries) {
      final needle = entry.value.trim();
      if (needle.isEmpty) continue;
      if (!_matchesFilter(_soldierColumnValue(soldier, entry.key), needle)) {
        return false;
      }
    }
    return true;
  }

  bool _matchesFilter(String value, String needle) {
    return value.toLowerCase().contains(needle.toLowerCase());
  }

  String _bikeColumnValue(BicycleAsset bike, String column) {
    return switch (column) {
      'name' => bike.name,
      'nfcCode' => bike.nfcCode,
      'status' => bike.status,
      'assignedSoldier' => bike.assignedSoldier ?? '',
      'helmetCode' => bike.helmetCode ?? '',
      'rentedAt' => [
        bike.rentedAt ?? '',
        _formatTableDateTime(bike.rentedAt),
      ].where((value) => value != '-').join(' '),
      _ => '',
    };
  }

  String _helmetColumnValue(HelmetAsset helmet, String column) {
    return switch (column) {
      'code' => helmet.code,
      'nfcCode' => helmet.nfcCode,
      'status' => helmet.status,
      'bicycleName' => helmet.bicycleName ?? '',
      'assignedSoldier' => helmet.assignedSoldier ?? '',
      _ => '',
    };
  }

  String _soldierColumnValue(Soldier soldier, String column) {
    return switch (column) {
      'name' => soldier.name,
      'country' => soldier.country ?? '',
      'activeAssignmentCount' => _bikeBalanceForSoldier(
        soldier,
      ).toString().padLeft(6, '0'),
      _ => '',
    };
  }

  int _bikeBalanceForSoldier(Soldier soldier) {
    final soldierId = soldier.id.trim();
    if (soldierId.isEmpty) return soldier.activeAssignmentCount;
    final liveBalance = _inventoryBicycles
        .where(
          (bike) =>
              bike.assignedSoldierId == soldierId &&
              _countsTowardSoldierBikeBalance(bike.status),
        )
        .length;
    return _inventoryLoaded ? liveBalance : soldier.activeAssignmentCount;
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

  Future<PagedBicycleAssets> _fetchBicycles({required int page}) {
    return widget.api.bicycles(
      _selectedCampId,
      page: page,
      filters: _bikeFilters,
      sortColumn: _bikeSortColumn,
      sortDirection: _bikeSortDirection,
    );
  }

  Future<PagedHelmetAssets> _fetchHelmets({required int page}) {
    return widget.api.helmets(
      _selectedCampId,
      page: page,
      filters: _helmetFilters,
      sortColumn: _helmetSortColumn,
      sortDirection: _helmetSortDirection,
    );
  }

  void _handleRealtimeBikeStatusChanged(BikeStatusChange change) {
    if (!_isLateStatus(change.status)) {
      _forgetLateBikeNotification(
        bicycleId: change.bicycleId,
        bicycleName: change.bicycleName,
      );
      return;
    }
    if (!change.movedFromRentToLate) return;
    _notifyLateBike(
      bicycleId: change.bicycleId,
      bicycleName: change.bicycleName,
      soldierName: change.soldierName,
      rentedAt: change.rentedAt,
    );
  }

  void _notifyNewLateBikes(
    Map<String, String> previousStatuses,
    List<BicycleAsset> bikes,
  ) {
    for (final bike in bikes) {
      if (!_isLateStatus(bike.status)) {
        _forgetLateBikeNotification(bicycleId: bike.id, bicycleName: bike.name);
      }
      final previousStatus = previousStatuses[bike.id];
      if (previousStatus == null) continue;
      if (_isRentStatus(previousStatus) && _isLateStatus(bike.status)) {
        _notifyLateBike(
          bicycleId: bike.id,
          bicycleName: bike.name,
          soldierName: bike.assignedSoldier,
          rentedAt: bike.rentedAt,
        );
      }
    }
  }

  void _rememberBikeStatuses(List<BicycleAsset> bikes) {
    _lastBikeStatuses
      ..clear()
      ..addEntries(bikes.map((bike) => MapEntry(bike.id, bike.status)));
  }

  void _notifyLateBike({
    required String bicycleId,
    required String bicycleName,
    String? soldierName,
    String? rentedAt,
  }) {
    final identity = bicycleId.isNotEmpty ? bicycleId : bicycleName;
    final key = '$identity|${rentedAt ?? ''}';
    if (!_lateBikeNotificationKeys.add(key)) return;
    unawaited(
      NativeBridge.showLateBikeNotification(
        bicycleName: bicycleName,
        soldierName: soldierName,
        rentedAt: rentedAt,
      ),
    );
  }

  void _forgetLateBikeNotification({
    required String bicycleId,
    required String bicycleName,
  }) {
    final identity = bicycleId.isNotEmpty ? bicycleId : bicycleName;
    _lateBikeNotificationKeys.removeWhere(
      (key) => key.startsWith('$identity|'),
    );
  }

  bool _isRentStatus(String status) {
    final normalized = status.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
    return normalized == 'rent' || normalized == 'rented';
  }

  bool _isLateStatus(String status) {
    final normalized = status.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
    return normalized == 'late' || normalized == 'overdue';
  }

  void _show(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _handleNfcScan(String rawNfcCode) async {
    if (_nfcHandledByDialog) return;
    final nfcCode = rawNfcCode.trim();
    if (nfcCode.isEmpty) return;
    if (_selectedCampId.isEmpty) {
      _show('Choose a camp before scanning NFC.');
      return;
    }

    if (_activeTab == 0) setState(() => _selectedTab = 1);
    if (_activeTab == 2) return _handleHelmetSectionNfcScan(nfcCode);
    if (_activeTab == 3) return _handleSoldierSectionNfcScan(nfcCode);
    return _handleBicycleSectionNfcScan(nfcCode);
  }

  Future<void> _handleBicycleSectionNfcScan(String nfcCode) async {
    final lookup = await _lookupAssetByNfc(nfcCode);
    if (lookup != null && lookup.assetType == 'bicycle') {
      await _showBicycleNfcHistory(lookup, nfcCode);
      return;
    }

    if (lookup != null) {
      _showCrossSectionScanResult(
        tabIndex: 1,
        title: 'Bicycle not found',
        message: 'This NFC belongs to ${lookup.assetType}: ${lookup.label}.',
      );
      return;
    }

    final soldier = await _lookupSoldierByNfc(nfcCode);
    if (soldier != null) {
      _showCrossSectionScanResult(
        tabIndex: 1,
        title: 'Bicycle not found',
        message: 'This NFC belongs to soldier: ${soldier.name}.',
      );
      return;
    }

    _showCrossSectionScanResult(
      tabIndex: 1,
      title: 'Bicycle not found',
      message: 'No bicycle was found for this NFC code.',
    );
  }

  Future<void> _handleHelmetSectionNfcScan(String nfcCode) async {
    final lookup = await _lookupAssetByNfc(nfcCode);
    if (lookup != null && lookup.assetType == 'helmet') {
      await _showHelmetNfcHistory(lookup, nfcCode);
      return;
    }

    if (lookup != null) {
      _showCrossSectionScanResult(
        tabIndex: 2,
        title: 'Helmet not found',
        message: 'This NFC belongs to ${lookup.assetType}: ${lookup.label}.',
      );
      return;
    }

    final soldier = await _lookupSoldierByNfc(nfcCode);
    if (soldier != null) {
      _showCrossSectionScanResult(
        tabIndex: 2,
        title: 'Helmet not found',
        message: 'This NFC belongs to soldier: ${soldier.name}.',
      );
      return;
    }

    _showCrossSectionScanResult(
      tabIndex: 2,
      title: 'Helmet not found',
      message: 'No helmet was found for this NFC code.',
    );
  }

  Future<void> _handleSoldierSectionNfcScan(String nfcCode) async {
    final soldier = await _lookupSoldierByNfc(nfcCode);
    if (soldier != null) {
      await _showSoldierNfcHistory(soldier, nfcCode);
      return;
    }

    final lookup = await _lookupAssetByNfc(nfcCode);
    if (lookup != null) {
      _showCrossSectionScanResult(
        tabIndex: 3,
        title: 'Soldier not found',
        message: 'This NFC belongs to ${lookup.assetType}: ${lookup.label}.',
      );
      return;
    }

    _showCrossSectionScanResult(
      tabIndex: 3,
      title: 'Soldier not found',
      message: 'No soldier was found for this key NFC.',
    );
  }

  Future<NfcLookupResult?> _lookupAssetByNfc(String nfcCode) async {
    try {
      return await widget.api.nfcLookup(_selectedCampId, nfcCode);
    } catch (_) {
      return null;
    }
  }

  Future<Soldier?> _lookupSoldierByNfc(String nfcCode) async {
    try {
      final soldiers = await widget.api.soldiers(_selectedCampId, nfcCode);
      if (soldiers.isEmpty) return null;
      return _bestSoldierMatch(soldiers, nfcCode);
    } catch (_) {
      return null;
    }
  }

  void _showCrossSectionScanResult({
    required int tabIndex,
    required String title,
    required String message,
  }) {
    if (!mounted) return;
    setState(() {
      _scanResult = _NfcScanResult.error(
        tabIndex: tabIndex,
        title: title,
        message: message,
      );
    });
  }

  Future<void> _showBicycleNfcHistory(
    NfcLookupResult lookup,
    String nfcCode, {
    bool focusTable = true,
  }) async {
    setState(() {
      if (focusTable) {
        _bikeFilters['nfcCode'] = nfcCode;
        _bikePage = 1;
      }
      _scanResult = _NfcScanResult.loading(
        tabIndex: 1,
        title: focusTable ? 'Scanning bicycle NFC' : 'Loading bicycle history',
        message: nfcCode,
      );
    });

    try {
      final rentals = await widget.api.recentRentals(
        campId: _selectedCampId,
        assetType: 'bicycle',
        assetId: lookup.assetId,
        limit: 2,
      );
      final bicycles = focusTable
          ? (_inventoryLoaded
                ? _bicyclePageFromInventory(_inventoryBicycles, page: 1)
                : await _fetchBicycles(page: 1))
          : null;
      if (!mounted) return;
      setState(() {
        if (bicycles != null) {
          _bicycles = bicycles.rows;
          _bikeMeta = bicycles.meta;
          _bikePage = bicycles.meta.page;
        }
        _scanResult = _NfcScanResult.asset(
          tabIndex: 1,
          title: 'Bicycle rental history',
          message: lookup.label,
          assetType: 'bicycle',
          assetId: lookup.assetId,
          nfcCode: nfcCode,
          rentals: rentals,
        );
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _scanResult = _NfcScanResult.error(
          tabIndex: 1,
          title: 'Bicycle not found',
          message: errorMessage(error),
        );
      });
    }
  }

  Future<void> _showBicycleHistoryFromUi(BicycleAsset bike) async {
    await _showBicycleNfcHistory(
      NfcLookupResult(
        assetType: 'bicycle',
        assetId: bike.id,
        label: bike.name,
        status: bike.status,
        bicycle: bike,
      ),
      bike.nfcCode,
      focusTable: false,
    );
  }

  Future<void> _showHelmetNfcHistory(
    NfcLookupResult lookup,
    String nfcCode, {
    bool focusTable = true,
  }) async {
    setState(() {
      if (focusTable) {
        _helmetFilters['nfcCode'] = nfcCode;
        _helmetPage = 1;
      }
      _scanResult = _NfcScanResult.loading(
        tabIndex: 2,
        title: focusTable ? 'Scanning helmet NFC' : 'Loading helmet history',
        message: nfcCode,
      );
    });

    try {
      final rentals = await widget.api.recentRentals(
        campId: _selectedCampId,
        assetType: 'helmet',
        assetId: lookup.assetId,
        limit: 2,
      );
      final helmets = focusTable
          ? (_inventoryLoaded
                ? _helmetPageFromInventory(_inventoryHelmets, page: 1)
                : await _fetchHelmets(page: 1))
          : null;
      if (!mounted) return;
      setState(() {
        if (helmets != null) {
          _helmets = helmets.rows;
          _helmetMeta = helmets.meta;
          _helmetPage = helmets.meta.page;
        }
        _scanResult = _NfcScanResult.asset(
          tabIndex: 2,
          title: 'Helmet rental history',
          message: lookup.label,
          assetType: 'helmet',
          assetId: lookup.assetId,
          nfcCode: nfcCode,
          rentals: rentals,
        );
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _scanResult = _NfcScanResult.error(
          tabIndex: 2,
          title: 'Helmet not found',
          message: errorMessage(error),
        );
      });
    }
  }

  Future<void> _showHelmetHistoryFromUi(HelmetAsset helmet) async {
    await _showHelmetNfcHistory(
      NfcLookupResult(
        assetType: 'helmet',
        assetId: helmet.id,
        label: helmet.code,
        status: helmet.status,
        helmet: helmet,
      ),
      helmet.nfcCode,
      focusTable: false,
    );
  }

  Future<void> _showSoldierNfcHistory(
    Soldier soldier,
    String nfcCode, {
    bool focusList = true,
  }) async {
    setState(() {
      _scanResult = _NfcScanResult.loading(
        tabIndex: 3,
        title: focusList ? 'Scanning soldier key' : 'Loading soldier details',
        message: soldier.name,
      );
    });

    try {
      final assignments = await widget.api.activeAssignments(
        campId: _selectedCampId,
        soldierId: soldier.id,
      );
      if (!mounted) return;
      setState(() {
        if (focusList) {
          _soldierFilters['name'] = soldier.name;
          _soldierFilters['country'] = '';
          _soldierFilters['activeAssignmentCount'] = '';
        }
        if (focusList && !_soldiers.any((row) => row.id == soldier.id)) {
          _soldiers = [soldier, ..._soldiers];
        }
        _scanResult = _NfcScanResult.soldier(
          tabIndex: 3,
          title: 'Soldier key scanned',
          message: soldier.name,
          soldier: soldier,
          soldierId: soldier.id,
          nfcCode: nfcCode,
          assignments: assignments,
        );
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _scanResult = _NfcScanResult.error(
          tabIndex: 3,
          title: 'Soldier lookup failed',
          message: errorMessage(error),
        );
      });
    }
  }

  Future<void> _showSoldierHistoryFromUi(Soldier soldier) async {
    await _showSoldierNfcHistory(soldier, soldier.name, focusList: false);
  }

  Soldier _bestSoldierMatch(List<Soldier> soldiers, String nfcCode) {
    final normalized = nfcCode.toLowerCase();
    for (final soldier in soldiers) {
      if ((soldier.mealCard ?? '').toLowerCase() == normalized) {
        return soldier;
      }
    }
    return soldiers.first;
  }

  Future<void> _refreshCurrentScanResult() async {
    final current = _scanResult;
    if (current == null ||
        current.loading ||
        current.isError ||
        _selectedCampId.isEmpty) {
      return;
    }

    try {
      if (current.assetType == 'bicycle' && current.assetId != null) {
        final bike = _findBicycleById(current.assetId!);
        if (bike == null) {
          if (mounted && identical(_scanResult, current)) {
            setState(() => _scanResult = null);
          }
          return;
        }
        final rentals = await widget.api.recentRentals(
          campId: _selectedCampId,
          assetType: 'bicycle',
          assetId: bike.id,
          limit: 2,
        );
        if (!mounted || !identical(_scanResult, current)) return;
        setState(() {
          if ((_bikeFilters['nfcCode'] ?? '') == (current.nfcCode ?? '')) {
            _bikeFilters['nfcCode'] = bike.nfcCode;
          }
          _scanResult = _NfcScanResult.asset(
            tabIndex: current.tabIndex,
            title: 'Bicycle rental history',
            message: bike.name,
            assetType: 'bicycle',
            assetId: bike.id,
            nfcCode: bike.nfcCode,
            rentals: rentals,
          );
        });
        return;
      }

      if (current.assetType == 'helmet' && current.assetId != null) {
        final helmet = _findHelmetById(current.assetId!);
        if (helmet == null) {
          if (mounted && identical(_scanResult, current)) {
            setState(() => _scanResult = null);
          }
          return;
        }
        final rentals = await widget.api.recentRentals(
          campId: _selectedCampId,
          assetType: 'helmet',
          assetId: helmet.id,
          limit: 2,
        );
        if (!mounted || !identical(_scanResult, current)) return;
        setState(() {
          if ((_helmetFilters['nfcCode'] ?? '') == (current.nfcCode ?? '')) {
            _helmetFilters['nfcCode'] = helmet.nfcCode;
          }
          _scanResult = _NfcScanResult.asset(
            tabIndex: current.tabIndex,
            title: 'Helmet rental history',
            message: helmet.code,
            assetType: 'helmet',
            assetId: helmet.id,
            nfcCode: helmet.nfcCode,
            rentals: rentals,
          );
        });
        return;
      }

      if (current.soldierId != null) {
        final soldier = _findSoldierById(current.soldierId!);
        if (soldier == null) {
          if (mounted && identical(_scanResult, current)) {
            setState(() => _scanResult = null);
          }
          return;
        }
        final assignments = await widget.api.activeAssignments(
          campId: _selectedCampId,
          soldierId: soldier.id,
        );
        if (!mounted || !identical(_scanResult, current)) return;
        setState(() {
          if ((_soldierFilters['name'] ?? '') == current.message) {
            _soldierFilters['name'] = soldier.name;
          }
          _scanResult = _NfcScanResult.soldier(
            tabIndex: current.tabIndex,
            title: 'Soldier key scanned',
            message: soldier.name,
            soldier: soldier,
            soldierId: soldier.id,
            nfcCode: soldier.mealCard ?? current.nfcCode ?? soldier.name,
            assignments: assignments,
          );
        });
      }
    } catch (_) {}
  }

  BicycleAsset? _findBicycleById(String id) {
    for (final bike in _inventoryBicycles) {
      if (bike.id == id) return bike;
    }
    for (final bike in _bicycles) {
      if (bike.id == id) return bike;
    }
    return null;
  }

  HelmetAsset? _findHelmetById(String id) {
    for (final helmet in _inventoryHelmets) {
      if (helmet.id == id) return helmet;
    }
    for (final helmet in _helmets) {
      if (helmet.id == id) return helmet;
    }
    return null;
  }

  Soldier? _findSoldierById(String id) {
    for (final soldier in _soldiers) {
      if (soldier.id == id) return soldier;
    }
    return null;
  }

  Future<void> _checkForUpdate({bool manual = false}) async {
    if (_authExpired) return;
    if (!_permissions.canDownloadBikeApp) {
      if (manual) _show("You don't have permission to check for app updates.");
      return;
    }
    try {
      final results = await Future.wait<Object>([
        NativeBridge.appBuildInfo(),
        widget.api.appVersion(),
      ]);
      if (_authExpired || !mounted) return;
      final buildInfo = results[0] as AppBuildInfo;
      final updateInfo = results[1] as AppUpdateInfo;
      final latestVersion = updateInfo.version;
      final updateUrl = _platformUpdateUrl(updateInfo);
      if (latestVersion == null || latestVersion.isEmpty) {
        if (manual) _show('No update is available.');
        return;
      }
      if (!_isNewerVersion(latestVersion, buildInfo.versionName)) {
        if (manual) _show('You are using the latest version.');
        return;
      }
      if (updateUrl == null || updateUrl.isEmpty) {
        if (manual) {
          _show(
            'Version $latestVersion is available, but no install link is configured for this device.',
          );
        }
        return;
      }
      if (!manual) {
        if (_appUpdateNotificationVersions.add(latestVersion)) {
          unawaited(
            NativeBridge.showAppUpdateNotification(version: latestVersion),
          );
        }
        return;
      }
      if (!mounted || _updatePromptOpen) return;
      _updatePromptOpen = true;
      final install = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Update available'),
          content: Text(
            'Version $latestVersion is available. Install the new version now?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Later'),
            ),
            FilledButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: const Icon(Icons.system_update_alt),
              label: const Text('Install'),
            ),
          ],
        ),
      );
      _updatePromptOpen = false;
      if (install == true) {
        await _installUpdate(updateInfo, updateUrl);
      }
    } catch (error) {
      _updatePromptOpen = false;
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
        return;
      }
      if (manual) _show('Update check failed: ${errorMessage(error)}');
    }
  }

  String? _platformUpdateUrl(AppUpdateInfo updateInfo) {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return updateInfo.apkUrl;
    }
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return updateInfo.iosUrl;
    }
    return null;
  }

  Future<void> _installUpdate(
    AppUpdateInfo updateInfo,
    String updateUrl,
  ) async {
    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        final bearerToken = await widget.api.accessToken;
        if (bearerToken.isEmpty) return;
        _show('Downloading update...');
        await NativeBridge.downloadAndInstallUpdate(
          url: widget.api.absoluteUrl(updateUrl),
          bearerToken: bearerToken,
          sha256: updateInfo.sha256,
        );
        _show('Opening update installer.');
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        await NativeBridge.openUpdateUrl(widget.api.absoluteUrl(updateUrl));
      }
    } catch (error) {
      _show('Update install failed: ${errorMessage(error)}');
    }
  }

  bool _isNewerVersion(String latest, String current) {
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
    return latest.trim().isNotEmpty &&
        current.trim().isNotEmpty &&
        latest.trim() != current.trim();
  }

  List<int> _versionParts(String value) {
    final version = value.split('+').first;
    return version
        .split(RegExp(r'[^0-9]+'))
        .where((part) => part.isNotEmpty)
        .map((part) => int.tryParse(part) ?? 0)
        .toList();
  }

  Future<void> _loadBicyclesPage(int page) async {
    if (_inventoryLoaded) {
      _applyLocalBicyclesPage(page);
      return;
    }

    if (_bikePageLoadInFlight) {
      _pendingBikePage = page;
      return;
    }

    _bikePageLoadInFlight = true;
    var nextPage = page;
    try {
      while (mounted) {
        _pendingBikePage = null;
        final requestToken = ++_bikeRequestToken;
        final result = await _fetchBicycles(page: nextPage);
        if (!mounted || requestToken != _bikeRequestToken) return;

        final queuedPage = _pendingBikePage;
        if (queuedPage != null) {
          nextPage = queuedPage;
          continue;
        }

        setState(() {
          _bicycles = result.rows;
          _bikeMeta = result.meta;
          _bikePage = result.meta.page;
        });
        return;
      }
    } catch (error) {
      _show(errorMessage(error));
    } finally {
      _bikePageLoadInFlight = false;
      final queuedPage = _pendingBikePage;
      if (queuedPage != null && mounted) {
        _pendingBikePage = null;
        scheduleMicrotask(() => _loadBicyclesPage(queuedPage));
      }
    }
  }

  Future<void> _loadHelmetsPage(int page) async {
    if (_inventoryLoaded) {
      _applyLocalHelmetsPage(page);
      return;
    }

    if (_helmetPageLoadInFlight) {
      _pendingHelmetPage = page;
      return;
    }

    _helmetPageLoadInFlight = true;
    var nextPage = page;
    try {
      while (mounted) {
        _pendingHelmetPage = null;
        final requestToken = ++_helmetRequestToken;
        final result = await _fetchHelmets(page: nextPage);
        if (!mounted || requestToken != _helmetRequestToken) return;

        final queuedPage = _pendingHelmetPage;
        if (queuedPage != null) {
          nextPage = queuedPage;
          continue;
        }

        setState(() {
          _helmets = result.rows;
          _helmetMeta = result.meta;
          _helmetPage = result.meta.page;
        });
        return;
      }
    } catch (error) {
      _show(errorMessage(error));
    } finally {
      _helmetPageLoadInFlight = false;
      final queuedPage = _pendingHelmetPage;
      if (queuedPage != null && mounted) {
        _pendingHelmetPage = null;
        scheduleMicrotask(() => _loadHelmetsPage(queuedPage));
      }
    }
  }

  void _scheduleBicyclesPageLoad(int page) {
    if (_inventoryLoaded) {
      _bikeTableDebounce?.cancel();
      _applyLocalBicyclesPage(page);
      return;
    }

    _bikeTableDebounce?.cancel();
    _bikeTableDebounce = Timer(
      const Duration(milliseconds: 350),
      () => unawaited(_loadBicyclesPage(page)),
    );
  }

  void _scheduleHelmetsPageLoad(int page) {
    if (_inventoryLoaded) {
      _helmetTableDebounce?.cancel();
      _applyLocalHelmetsPage(page);
      return;
    }

    _helmetTableDebounce?.cancel();
    _helmetTableDebounce = Timer(
      const Duration(milliseconds: 350),
      () => unawaited(_loadHelmetsPage(page)),
    );
  }

  void _applyLocalBicyclesPage(int page) {
    final result = _bicyclePageFromInventory(_inventoryBicycles, page: page);
    if (!mounted) return;
    setState(() {
      _bicycles = result.rows;
      _bikeMeta = result.meta;
      _bikePage = result.meta.page;
    });
  }

  void _applyLocalHelmetsPage(int page) {
    final result = _helmetPageFromInventory(_inventoryHelmets, page: page);
    if (!mounted) return;
    setState(() {
      _helmets = result.rows;
      _helmetMeta = result.meta;
      _helmetPage = result.meta.page;
    });
  }

  Future<void> _changeBicyclesPage(int page) async {
    setState(() {
      _bikePage = page;
    });
    _scheduleBicyclesPageLoad(page);
  }

  Future<void> _changeHelmetsPage(int page) async {
    setState(() {
      _helmetPage = page;
    });
    _scheduleHelmetsPageLoad(page);
  }

  void _applyBikeFilter(String column, String value) {
    setState(() {
      _bikeFilters[column] = value;
      _bikePage = 1;
    });
    _scheduleBicyclesPageLoad(1);
  }

  void _applyHelmetFilter(String column, String value) {
    setState(() {
      _helmetFilters[column] = value;
      _helmetPage = 1;
    });
    _scheduleHelmetsPageLoad(1);
  }

  void _applySoldierFilter(String column, String value) {
    setState(() {
      _soldierFilters[column] = value;
    });
  }

  Future<void> _sortBikes(String column) async {
    setState(() {
      if (_bikeSortColumn == column) {
        _bikeSortDirection = _nextSortDirection(_bikeSortDirection);
      } else {
        _bikeSortColumn = column;
        _bikeSortDirection = 'asc';
      }
      if (_bikeSortDirection == 'default') _bikeSortColumn = null;
      _bikePage = 1;
    });
    _scheduleBicyclesPageLoad(1);
  }

  Future<void> _sortHelmets(String column) async {
    setState(() {
      if (_helmetSortColumn == column) {
        _helmetSortDirection = _nextSortDirection(_helmetSortDirection);
      } else {
        _helmetSortColumn = column;
        _helmetSortDirection = 'asc';
      }
      if (_helmetSortDirection == 'default') _helmetSortColumn = null;
      _helmetPage = 1;
    });
    _scheduleHelmetsPageLoad(1);
  }

  String _nextSortDirection(String current) {
    return switch (current) {
      'asc' => 'desc',
      'desc' => 'default',
      _ => 'asc',
    };
  }

  Future<_BikeAssignmentOptions> _loadBikeAssignmentOptions(
    BicycleAsset bike,
  ) async {
    final results = await Future.wait<Object>([
      widget.api.soldiers(_selectedCampId, ''),
      _inventoryLoaded
          ? Future.value(_inventoryHelmets)
          : widget.api
                .helmets(_selectedCampId, limit: 100)
                .then((result) => result.rows),
    ]);
    final sourceSoldiers = results[0] as List<Soldier>;
    final soldiers = [
      if ((bike.assignedSoldierId ?? '').isNotEmpty &&
          !sourceSoldiers.any(
            (soldier) => soldier.id == bike.assignedSoldierId,
          ))
        Soldier(
          id: bike.assignedSoldierId!,
          name: bike.assignedSoldier ?? 'Assigned soldier',
        ),
      ...sourceSoldiers,
    ];
    final sourceHelmets = results[1] as List<HelmetAsset>;
    final helmets = sourceHelmets
        .where(
          (helmet) => helmet.isAvailable || helmet.id == (bike.helmetId ?? ''),
        )
        .toList();
    return _BikeAssignmentOptions(soldiers: soldiers, helmets: helmets);
  }

  Future<Soldier?> _findSoldierByNfcCode(String nfcCode) async {
    final soldiers = await widget.api.soldiers(_selectedCampId, nfcCode);
    if (soldiers.isEmpty) return null;
    return _bestSoldierMatch(soldiers, nfcCode);
  }

  Future<Soldier?> _lookupSoldierById(String soldierId) async {
    final soldiers = await widget.api.soldiers(_selectedCampId, soldierId);
    for (final soldier in soldiers) {
      if (soldier.id == soldierId) return soldier;
    }
    return null;
  }

  DateTime? _parseLocalDateTime(String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) return null;
    return DateTime.tryParse(text)?.toLocal();
  }

  Future<void> _saveBike([BicycleAsset? bike]) async {
    if (bike == null && !_permissions.canAddBike) {
      _show("You don't have permission to add bicycles.");
      return;
    }
    if (bike != null && !_permissions.canEditBike) {
      _show("You don't have permission to edit bicycles.");
      return;
    }
    final assignmentEditable = bike != null && !bike.isAvailable;
    var soldiers = const <Soldier>[];
    var helmets = const <HelmetAsset>[];
    if (assignmentEditable) {
      final options = await _loadBikeAssignmentOptions(bike);
      soldiers = options.soldiers;
      helmets = options.helmets;
      if (!mounted) return;
    }

    late final AssetFormResult? result;
    _nfcHandledByDialog = true;
    try {
      result = await showDialog<AssetFormResult>(
        context: context,
        builder: (_) => AssetDialog(
          title: bike == null ? 'Add bike' : 'Edit bike',
          label: 'Bike name',
          initialName: bike?.name,
          initialNfcCode: bike?.nfcCode,
          assignmentEditable: assignmentEditable,
          initialStatus: bike?.status,
          initialSoldierId: bike?.assignedSoldierId,
          initialHelmetId: bike?.helmetId,
          initialRentedAt: _parseLocalDateTime(bike?.rentedAt),
          soldiers: soldiers,
          helmets: helmets,
          soldierUpdates: assignmentEditable ? _soldierUpdates.stream : null,
          helmetUpdates: assignmentEditable ? _helmetUpdates.stream : null,
          soldierByNfc: assignmentEditable ? _findSoldierByNfcCode : null,
          soldierById: assignmentEditable ? _lookupSoldierById : null,
          canSubmit: bike == null
              ? _permissions.canAddBike
              : _permissions.canEditBike,
          canSubmitUpdates: _permissionUpdates.stream.map(
            (permissions) =>
                bike == null ? permissions.canAddBike : permissions.canEditBike,
          ),
        ),
      );
    } finally {
      _nfcHandledByDialog = false;
    }
    if (result == null) return;
    final stillAllowed = bike == null
        ? _permissions.canAddBike
        : _permissions.canEditBike;
    if (!stillAllowed) {
      _show('Your bicycle permissions changed. The action was not saved.');
      return;
    }
    if (!mounted) return;
    final confirmed = await confirm(
      context,
      bike == null ? 'Create bike?' : 'Save bike changes?',
      bike == null
          ? 'Create bike ${result.name} with NFC ${result.nfcCode} in the selected camp.'
          : 'Update ${bike.name} with the edited details, NFC code, and assignment fields.',
      messageBuilder: bike == null
          ? null
          : () {
              final current = _findBicycleById(bike.id) ?? bike;
              return 'Update ${current.name} with the edited details, NFC code, and assignment fields.';
            },
      contentUpdates: bike == null ? null : _bicycleUpdates.stream,
      canConfirm: stillAllowed,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) =>
            bike == null ? permissions.canAddBike : permissions.canEditBike,
      ),
    );
    if (!confirmed) return;
    final allowedAfterConfirm = bike == null
        ? _permissions.canAddBike
        : _permissions.canEditBike;
    if (!allowedAfterConfirm) {
      _show('Your bicycle permissions changed. The action was not saved.');
      return;
    }
    try {
      if (bike == null) {
        await widget.api.addBicycle(
          _selectedCampId,
          result.name,
          result.nfcCode,
        );
      } else {
        await widget.api.editBicycle(
          _selectedCampId,
          bike,
          result.name,
          result.nfcCode,
          status: result.status,
          soldierId: result.soldierId,
          helmetId: result.helmetId,
          rentedAt: result.rentedAt,
        );
      }
      _show('Bike saved.');
      await _refresh(quiet: true, includeSoldiers: _canLoadSoldiers);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  Future<void> _saveHelmet([HelmetAsset? helmet]) async {
    if (helmet == null && !_permissions.canAddHelmet) {
      _show("You don't have permission to add helmets.");
      return;
    }
    if (helmet != null && !_permissions.canEditHelmet) {
      _show("You don't have permission to edit helmets.");
      return;
    }
    late final AssetFormResult? result;
    _nfcHandledByDialog = true;
    try {
      result = await showDialog<AssetFormResult>(
        context: context,
        builder: (_) => AssetDialog(
          title: helmet == null ? 'Add helmet' : 'Edit helmet',
          label: 'Helmet code',
          initialName: helmet?.code,
          initialNfcCode: helmet?.nfcCode,
          canSubmit: helmet == null
              ? _permissions.canAddHelmet
              : _permissions.canEditHelmet,
          canSubmitUpdates: _permissionUpdates.stream.map(
            (permissions) => helmet == null
                ? permissions.canAddHelmet
                : permissions.canEditHelmet,
          ),
        ),
      );
    } finally {
      _nfcHandledByDialog = false;
    }
    if (result == null) return;
    final stillAllowed = helmet == null
        ? _permissions.canAddHelmet
        : _permissions.canEditHelmet;
    if (!stillAllowed) {
      _show('Your helmet permissions changed. The action was not saved.');
      return;
    }
    if (!mounted) return;
    final confirmed = await confirm(
      context,
      helmet == null ? 'Create helmet?' : 'Save helmet changes?',
      helmet == null
          ? 'Create helmet ${result.name} with NFC ${result.nfcCode} in the selected camp.'
          : 'Update helmet ${helmet.code} with the edited code and NFC tag.',
      messageBuilder: helmet == null
          ? null
          : () {
              final current = _findHelmetById(helmet.id) ?? helmet;
              return 'Update helmet ${current.code} with the edited code and NFC tag.';
            },
      contentUpdates: helmet == null ? null : _helmetUpdates.stream,
      canConfirm: stillAllowed,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => helmet == null
            ? permissions.canAddHelmet
            : permissions.canEditHelmet,
      ),
    );
    if (!confirmed) return;
    final allowedAfterConfirm = helmet == null
        ? _permissions.canAddHelmet
        : _permissions.canEditHelmet;
    if (!allowedAfterConfirm) {
      _show('Your helmet permissions changed. The action was not saved.');
      return;
    }
    try {
      if (helmet == null) {
        await widget.api.addHelmet(
          _selectedCampId,
          result.name,
          result.nfcCode,
        );
      } else {
        await widget.api.editHelmet(
          _selectedCampId,
          helmet,
          result.name,
          result.nfcCode,
        );
      }
      _show('Helmet saved.');
      await _refresh(quiet: true, includeSoldiers: _canLoadSoldiers);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  Future<void> _deleteBike(BicycleAsset bike) async {
    if (!_permissions.canDeleteBike) {
      _show("You don't have permission to remove bicycles.");
      return;
    }
    if (!await confirm(
      context,
      'Delete bike',
      'Remove ${bike.name} from the selected camp. The server will block deletion if active history prevents it.',
      messageBuilder: () {
        final current = _findBicycleById(bike.id) ?? bike;
        return 'Remove ${current.name} from the selected camp. The server will block deletion if active history prevents it.';
      },
      contentUpdates: _bicycleUpdates.stream,
      canConfirm: _permissions.canDeleteBike,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => permissions.canDeleteBike,
      ),
    )) {
      return;
    }
    if (!_permissions.canDeleteBike) {
      _show('Your bicycle permissions changed. The bike was not removed.');
      return;
    }
    try {
      await widget.api.deleteBicycle(_selectedCampId, bike.id);
      _show('Bike deleted.');
      await _refresh(quiet: true, includeSoldiers: _canLoadSoldiers);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  Future<void> _deleteHelmet(HelmetAsset helmet) async {
    if (!_permissions.canDeleteHelmet) {
      _show("You don't have permission to remove helmets.");
      return;
    }
    if (!await confirm(
      context,
      'Delete helmet',
      'Remove helmet ${helmet.code} from the selected camp. The server will block deletion if it is still in use.',
      messageBuilder: () {
        final current = _findHelmetById(helmet.id) ?? helmet;
        return 'Remove helmet ${current.code} from the selected camp. The server will block deletion if it is still in use.';
      },
      contentUpdates: _helmetUpdates.stream,
      canConfirm: _permissions.canDeleteHelmet,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => permissions.canDeleteHelmet,
      ),
    )) {
      return;
    }
    if (!_permissions.canDeleteHelmet) {
      _show('Your helmet permissions changed. The helmet was not removed.');
      return;
    }
    try {
      await widget.api.deleteHelmet(_selectedCampId, helmet.id);
      _show('Helmet deleted.');
      await _refresh(quiet: true, includeSoldiers: _canLoadSoldiers);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  Future<void> _rentBike(BicycleAsset bike) async {
    if (!_permissions.canSaveBikeStatus) {
      _show("You don't have permission to rent bicycles.");
      return;
    }
    if (_rentDialogOpening) return;
    _rentDialogOpening = true;
    try {
      final results = await Future.wait<Object>([
        widget.api.soldiers(_selectedCampId, ''),
        _inventoryLoaded
            ? Future.value(_inventoryHelmets)
            : widget.api
                  .helmets(_selectedCampId, limit: 100)
                  .then((result) => result.rows),
      ]);
      if (!mounted) return;
      final soldiers = results[0] as List<Soldier>;
      final helmets = results[1] as List<HelmetAsset>;
      late final RentFormResult? result;
      _nfcHandledByDialog = true;
      try {
        result = await showDialog<RentFormResult>(
          context: context,
          builder: (_) => RentDialog(
            bike: bike,
            soldiers: soldiers,
            helmets: helmets.where((helmet) => helmet.isAvailable).toList(),
            soldierUpdates: _soldierUpdates.stream,
            helmetUpdates: _helmetUpdates.stream,
            soldierByNfc: _findSoldierByNfcCode,
            soldierById: _lookupSoldierById,
            canSubmit: _permissions.canSaveBikeStatus,
            canSubmitUpdates: _permissionUpdates.stream.map(
              (permissions) => permissions.canSaveBikeStatus,
            ),
          ),
        );
      } finally {
        _nfcHandledByDialog = false;
      }
      if (result == null) return;
      final rentResult = result;
      if (!_permissions.canSaveBikeStatus) {
        _show(
          'Your bicycle status permission changed. The bike was not rented.',
        );
        return;
      }
      if (!mounted) return;
      final confirmed = await confirm(
        context,
        rentResult.repair ? 'Mark bike for repair?' : 'Rent bike?',
        rentResult.repair
            ? 'Move ${bike.name} into Repair so it is no longer available for rental.'
            : 'Rent ${bike.name} to the selected soldier with the selected helmet and rental time.',
        messageBuilder: () {
          final current = _findBicycleById(bike.id) ?? bike;
          return rentResult.repair
              ? 'Move ${current.name} into Repair so it is no longer available for rental.'
              : 'Rent ${current.name} to the selected soldier with the selected helmet and rental time.';
        },
        contentUpdates: _bicycleUpdates.stream,
        canConfirm: _permissions.canSaveBikeStatus,
        canConfirmUpdates: _permissionUpdates.stream.map(
          (permissions) => permissions.canSaveBikeStatus,
        ),
      );
      if (!confirmed) return;
      if (!_permissions.canSaveBikeStatus) {
        _show(
          'Your bicycle status permission changed. The bike was not rented.',
        );
        return;
      }
      await widget.api.rentBicycle(
        campId: _selectedCampId,
        identifier: bike.id,
        rentedAt: rentResult.rentedAt.toUtc().toIso8601String(),
        repair: rentResult.repair,
        soldierId: rentResult.soldierId,
        helmetId: rentResult.helmetId,
        longTerm: rentResult.longTerm,
      );
      _show(rentResult.repair ? 'Bike marked for repair.' : 'Bike rented.');
      await _refresh(quiet: true, includeSoldiers: _canLoadSoldiers);
    } catch (error) {
      _show(errorMessage(error));
    } finally {
      _rentDialogOpening = false;
    }
  }

  Future<void> _returnBike(BicycleAsset bike) async {
    if (!_permissions.canSaveBikeStatus) {
      _show("You don't have permission to return bicycles.");
      return;
    }
    final returnedAt = await showDialog<DateTime>(
      context: context,
      builder: (_) => ReturnDialog(
        bike: bike,
        bikeUpdates: _bicycleUpdates.stream,
        canReturn: _permissions.canSaveBikeStatus,
        canReturnUpdates: _permissionUpdates.stream.map(
          (permissions) => permissions.canSaveBikeStatus,
        ),
      ),
    );
    if (returnedAt == null) return;
    if (!_permissions.canSaveBikeStatus) {
      _show(
        'Your bicycle status permission changed. The bike was not returned.',
      );
      return;
    }
    if (!mounted) return;
    final confirmed = await confirm(
      context,
      'Return bike?',
      'Complete the rental for ${bike.name} using the selected return time and make the bike available again.',
      messageBuilder: () {
        final current = _findBicycleById(bike.id) ?? bike;
        return 'Complete the rental for ${current.name} using the selected return time and make the bike available again.';
      },
      contentUpdates: _bicycleUpdates.stream,
      canConfirm: _permissions.canSaveBikeStatus,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => permissions.canSaveBikeStatus,
      ),
    );
    if (!confirmed) return;
    if (!_permissions.canSaveBikeStatus) {
      _show(
        'Your bicycle status permission changed. The bike was not returned.',
      );
      return;
    }
    try {
      await widget.api.returnBicycle(
        campId: _selectedCampId,
        identifier: bike.id,
        returnedAt: returnedAt.toUtc().toIso8601String(),
      );
      _show('Bike returned.');
      await _refresh(quiet: true, includeSoldiers: _canLoadSoldiers);
    } catch (error) {
      _show(errorMessage(error));
    }
  }

  Future<void> _changeCamp(String campId) async {
    setState(() {
      _selectedCampId = campId;
      _bikePage = 1;
      _helmetPage = 1;
      for (final column in _soldierFilters.keys) {
        _soldierFilters[column] = '';
      }
      _inventoryLoaded = false;
      _summary = const InventorySummary();
      _totalBicycles = 0;
      _helmetPairingCount = 0;
      _needsAttention = 0;
      _inventoryBicycles = const [];
      _inventoryHelmets = const [];
    });
    await _refresh(includeSoldiers: _canLoadSoldiers);
  }

  Future<void> _openSettings() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => _SettingsPage(
          camps: _camps,
          campUpdates: _campUpdates.stream,
          permissionUpdates: _permissionUpdates.stream,
          selectedCampId: _selectedCampId,
          onCampChanged: _changeCamp,
          onCheckForUpdate: () => _checkForUpdate(manual: true),
          canCheckForUpdate: _permissions.canDownloadBikeApp,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Camp? selectedCamp;
    for (final camp in _camps) {
      if (camp.id == _selectedCampId) selectedCamp = camp;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppConfig.appName),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () =>
                unawaited(_refresh(includeSoldiers: _canLoadSoldiers)),
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Settings',
            onPressed: _openSettings,
            icon: const Icon(Icons.settings_outlined),
          ),
          IconButton(
            tooltip: 'Logout',
            onPressed: () async {
              await _socket.disconnect();
              await widget.onLogout();
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _activeTab,
        onDestinationSelected: _selectTab,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.pedal_bike),
            selectedIcon: Icon(Icons.pedal_bike),
            label: 'Bikes',
          ),
          NavigationDestination(
            icon: Icon(Icons.sports_motorsports),
            selectedIcon: Icon(Icons.sports_motorsports),
            label: 'Helmets',
          ),
          NavigationDestination(
            icon: Icon(Icons.badge_outlined),
            selectedIcon: Icon(Icons.badge_outlined),
            label: 'Soldiers',
          ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            RefreshIndicator(
              onRefresh: () => _refresh(includeSoldiers: _canLoadSoldiers),
              child: ListView(
                padding: const EdgeInsets.all(14),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  _Header(
                    connection: _connection,
                    campName: selectedCamp?.name ?? 'No camp selected',
                    canUse: _permissions.canUse,
                  ),
                  const SizedBox(height: 12),
                  _SummaryGrid(summary: _summary),
                  const SizedBox(height: 12),
                  if (!_permissions.canUse)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(18),
                        child: Text(
                          'You do not have permission to use the bicycle mobile app.',
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
    return switch (_activeTab) {
      0 => _sectionFrame(
        _OverviewView(
          totalBicycles: _totalBicycles,
          helmetPairingCount: _helmetPairingCount,
          needsAttention: _needsAttention,
        ),
      ),
      1 => _sectionFrame(
        BikesView(
          rows: _bicycles,
          filters: _bikeFilters,
          meta: _bikeMeta,
          sortColumn: _bikeSortColumn,
          sortDirection: _bikeSortDirection,
          onFilterChanged: _applyBikeFilter,
          onSort: _sortBikes,
          onPageChanged: _changeBicyclesPage,
          onAdd: () => _saveBike(),
          onEdit: _saveBike,
          onDelete: _deleteBike,
          onRent: _rentBike,
          onReturn: _returnBike,
          onShowDetails: (bike) => unawaited(_showBicycleHistoryFromUi(bike)),
          canAdd: _permissions.canAddBike,
          canEdit: _permissions.canEditBike,
          canDelete: _permissions.canDeleteBike,
          canSaveStatus: _permissions.canSaveBikeStatus,
        ),
      ),
      2 => _sectionFrame(
        HelmetsView(
          rows: _helmets,
          filters: _helmetFilters,
          meta: _helmetMeta,
          sortColumn: _helmetSortColumn,
          sortDirection: _helmetSortDirection,
          onFilterChanged: _applyHelmetFilter,
          onSort: _sortHelmets,
          onPageChanged: _changeHelmetsPage,
          onAdd: () => _saveHelmet(),
          onEdit: _saveHelmet,
          onDelete: _deleteHelmet,
          onShowDetails: (helmet) =>
              unawaited(_showHelmetHistoryFromUi(helmet)),
          canAdd: _permissions.canAddHelmet,
          canEdit: _permissions.canEditHelmet,
          canDelete: _permissions.canDeleteHelmet,
        ),
      ),
      _ => _sectionFrame(
        SoldiersView(
          rows: _soldierRowsForTable(),
          filters: _soldierFilters,
          onFilterChanged: _applySoldierFilter,
          onShowDetails: (soldier) =>
              unawaited(_showSoldierHistoryFromUi(soldier)),
          bikeBalanceForSoldier: _bikeBalanceForSoldier,
        ),
      ),
    };
  }

  Widget _sectionFrame(Widget child) {
    final scanResult = _scanResult;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (scanResult != null && scanResult.tabIndex == _activeTab)
          _NfcScanResultPanel(
            result: scanResult,
            onClear: () => setState(() => _scanResult = null),
          ),
        child,
      ],
    );
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
                    'Bike desk',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Status flow and bike inventory',
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
                Chip(
                  avatar: Icon(
                    connection == 'Live'
                        ? Icons.wifi_tethering
                        : Icons.wifi_tethering_off,
                    size: 18,
                  ),
                  label: Text(connection),
                ),
                Chip(
                  avatar: Icon(
                    canUse ? Icons.lock_open_outlined : Icons.lock_outline,
                    size: 18,
                  ),
                  label: Text(canUse ? 'Access granted' : 'Restricted'),
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
  const _SummaryGrid({required this.summary});

  final InventorySummary summary;

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
        _SummaryTile(
          label: 'Available',
          value: '${summary.available}',
          icon: Icons.check_circle_outline,
          color: const Color(0xff15803d),
        ),
        _SummaryTile(
          label: 'Rented',
          value: '${summary.rented}',
          icon: Icons.assignment_turned_in_outlined,
          color: const Color(0xff2563eb),
        ),
        _SummaryTile(
          label: 'Repair',
          value: '${summary.repair}',
          icon: Icons.build_outlined,
          color: const Color(0xffb45309),
        ),
        _SummaryTile(
          label: 'Late',
          value: '${summary.late}',
          icon: Icons.warning_amber_outlined,
          color: const Color(0xffb91c1c),
        ),
        _SummaryTile(
          label: 'Long term',
          value: '${summary.longTerm}',
          icon: Icons.event_repeat_outlined,
          color: const Color(0xff475569),
        ),
      ],
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.icon,
    this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.labelLarge?.copyWith(color: Colors.black54),
                  ),
                ),
                Icon(icon, color: effectiveColor, size: 20),
              ],
            ),
            Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

class _OverviewView extends StatelessWidget {
  const _OverviewView({
    required this.totalBicycles,
    required this.helmetPairingCount,
    required this.needsAttention,
  });

  final int totalBicycles;
  final int helmetPairingCount;
  final int needsAttention;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return ListSurface(
      title: 'Operational overview',
      subtitle: 'Fleet pressure and return follow-up.',
      child: GridView.count(
        crossAxisCount: width > 900
            ? 3
            : width > 620
            ? 2
            : 1,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 2.4,
        children: [
          _SummaryTile(
            label: 'Total tracked bikes',
            value: '$totalBicycles',
            icon: Icons.pedal_bike,
          ),
          _SummaryTile(
            label: 'Helmet pairings',
            value: '$helmetPairingCount',
            icon: Icons.sports_motorsports_outlined,
          ),
          _SummaryTile(
            label: 'Needs attention',
            value: '$needsAttention',
            icon: Icons.warning_amber_outlined,
          ),
        ],
      ),
    );
  }
}

class _NfcScanResult {
  const _NfcScanResult({
    required this.tabIndex,
    required this.title,
    required this.message,
    this.loading = false,
    this.isError = false,
    this.rentals = const [],
    this.soldier,
    this.assetType,
    this.assetId,
    this.nfcCode,
    this.soldierId,
    this.assignments = const [],
  });

  final int tabIndex;
  final String title;
  final String message;
  final bool loading;
  final bool isError;
  final List<RentalRecord> rentals;
  final Soldier? soldier;
  final String? assetType;
  final String? assetId;
  final String? nfcCode;
  final String? soldierId;
  final List<RentalRecord> assignments;

  factory _NfcScanResult.loading({
    required int tabIndex,
    required String title,
    required String message,
  }) {
    return _NfcScanResult(
      tabIndex: tabIndex,
      title: title,
      message: message,
      loading: true,
    );
  }

  factory _NfcScanResult.error({
    required int tabIndex,
    required String title,
    required String message,
  }) {
    return _NfcScanResult(
      tabIndex: tabIndex,
      title: title,
      message: message,
      isError: true,
    );
  }

  factory _NfcScanResult.asset({
    required int tabIndex,
    required String title,
    required String message,
    required String assetType,
    required String assetId,
    required String nfcCode,
    required List<RentalRecord> rentals,
  }) {
    return _NfcScanResult(
      tabIndex: tabIndex,
      title: title,
      message: message,
      assetType: assetType,
      assetId: assetId,
      nfcCode: nfcCode,
      rentals: rentals,
    );
  }

  factory _NfcScanResult.soldier({
    required int tabIndex,
    required String title,
    required String message,
    required Soldier soldier,
    required String soldierId,
    required String nfcCode,
    required List<RentalRecord> assignments,
  }) {
    return _NfcScanResult(
      tabIndex: tabIndex,
      title: title,
      message: message,
      soldier: soldier,
      soldierId: soldierId,
      nfcCode: nfcCode,
      assignments: assignments,
    );
  }
}

class _BikeAssignmentOptions {
  const _BikeAssignmentOptions({required this.soldiers, required this.helmets});

  final List<Soldier> soldiers;
  final List<HelmetAsset> helmets;
}

class _NfcScanResultPanel extends StatelessWidget {
  const _NfcScanResultPanel({required this.result, required this.onClear});

  final _NfcScanResult result;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final color = result.isError
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.primary;
    return Card(
      margin: const EdgeInsets.fromLTRB(4, 8, 4, 4),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(
                  result.isError ? Icons.error_outline : Icons.nfc,
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
                      Text(
                        result.message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (result.loading)
                  const SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  IconButton(
                    tooltip: 'Clear scan result',
                    onPressed: onClear,
                    icon: const Icon(Icons.close),
                  ),
              ],
            ),
            if (!result.loading && !result.isError) ...[
              const SizedBox(height: 10),
              if (result.soldier == null)
                _ScanRecordList(
                  title: 'Last two renters',
                  emptyMessage: 'No rental history found for this NFC.',
                  rows: result.rentals,
                )
              else
                _ScanRecordList(
                  title:
                      'Active bike balance: ${_bikeBalanceFromAssignments(result.assignments)}',
                  emptyMessage: 'No active rentals for this soldier.',
                  rows: result.assignments,
                  showBikeDetails: true,
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ScanRecordList extends StatelessWidget {
  const _ScanRecordList({
    required this.title,
    required this.emptyMessage,
    required this.rows,
    this.showBikeDetails = false,
  });

  final String title;
  final String emptyMessage;
  final List<RentalRecord> rows;
  final bool showBikeDetails;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 6),
        if (rows.isEmpty)
          Text(emptyMessage)
        else
          ...rows.map(
            (row) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _ScanRecordTile(
                row: row,
                showBikeDetails: showBikeDetails,
              ),
            ),
          ),
      ],
    );
  }
}

class _ScanRecordTile extends StatelessWidget {
  const _ScanRecordTile({required this.row, required this.showBikeDetails});

  final RentalRecord row;
  final bool showBikeDetails;

  @override
  Widget build(BuildContext context) {
    final title = showBikeDetails
        ? [row.bicycleName, row.bicycleNfcCode].whereType<String>().join(' | ')
        : _renterTitle(row);
    final details = [
      if (!showBikeDetails && row.bicycleName != null) row.bicycleName,
      if (row.helmetCode != null) 'Helmet ${row.helmetCode}',
      'Rented ${_formatTableDateTime(row.rentedAt)}',
      if (row.returnedAt != null)
        'Returned ${_formatTableDateTime(row.returnedAt)}',
    ].join(' | ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title.isEmpty ? 'Rental' : title),
          const SizedBox(height: 2),
          Text(
            details,
            style: Theme.of(context).textTheme.bodySmall,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

String _renterTitle(RentalRecord row) {
  final soldierName = row.soldierName?.trim();
  if (soldierName != null && soldierName.isNotEmpty) return soldierName;
  return row.status.trim().toLowerCase() == 'repair'
      ? 'Repair'
      : 'Unknown renter';
}

class _SettingsPage extends StatefulWidget {
  const _SettingsPage({
    required this.camps,
    required this.campUpdates,
    required this.permissionUpdates,
    required this.selectedCampId,
    required this.onCampChanged,
    required this.onCheckForUpdate,
    required this.canCheckForUpdate,
  });

  final List<Camp> camps;
  final Stream<List<Camp>> campUpdates;
  final Stream<BikeAppPermissions> permissionUpdates;
  final String selectedCampId;
  final Future<void> Function(String campId) onCampChanged;
  final Future<void> Function() onCheckForUpdate;
  final bool canCheckForUpdate;

  @override
  State<_SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<_SettingsPage> {
  late List<Camp> _camps = widget.camps;
  late bool _canCheckForUpdate = widget.canCheckForUpdate;
  StreamSubscription<List<Camp>>? _campSubscription;
  StreamSubscription<BikeAppPermissions>? _permissionSubscription;

  @override
  void initState() {
    super.initState();
    _campSubscription = widget.campUpdates.listen((camps) {
      if (mounted) setState(() => _camps = camps);
    });
    _permissionSubscription = widget.permissionUpdates.listen((permissions) {
      if (!mounted) return;
      setState(() {
        _canCheckForUpdate = permissions.canDownloadBikeApp;
      });
    });
  }

  @override
  void didUpdateWidget(covariant _SettingsPage oldWidget) {
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
          _canCheckForUpdate = permissions.canDownloadBikeApp;
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

  @override
  Widget build(BuildContext context) {
    Camp? selectedCamp;
    for (final camp in _camps) {
      if (camp.id == widget.selectedCampId) {
        selectedCamp = camp;
        break;
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ListSurface(
              title: 'Camp',
              subtitle: 'Choose the active camp for bike records.',
              child: SearchSelectionField<Camp>(
                labelText: 'Camp',
                leadingIcon: Icons.location_city_outlined,
                options: _camps,
                optionsStream: widget.campUpdates,
                selectedValue: selectedCamp,
                itemLabel: (camp) => camp.name,
                itemSubtitle: (camp) => camp.id,
                onChanged: (camp) async {
                  await widget.onCampChanged(camp.id);
                  if (context.mounted) Navigator.pop(context);
                },
                emptyMessage: 'No camps found.',
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

class BikesView extends StatelessWidget {
  const BikesView({
    required this.rows,
    required this.filters,
    required this.meta,
    required this.sortColumn,
    required this.sortDirection,
    required this.onFilterChanged,
    required this.onSort,
    required this.onPageChanged,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
    required this.onRent,
    required this.onReturn,
    required this.onShowDetails,
    required this.canAdd,
    required this.canEdit,
    required this.canDelete,
    required this.canSaveStatus,
    super.key,
  });

  final List<BicycleAsset> rows;
  final Map<String, String> filters;
  final TablePageMeta meta;
  final String? sortColumn;
  final String sortDirection;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;
  final Future<void> Function(int page) onPageChanged;
  final VoidCallback onAdd;
  final ValueChanged<BicycleAsset> onEdit;
  final ValueChanged<BicycleAsset> onDelete;
  final ValueChanged<BicycleAsset> onRent;
  final ValueChanged<BicycleAsset> onReturn;
  final ValueChanged<BicycleAsset> onShowDetails;
  final bool canAdd;
  final bool canEdit;
  final bool canDelete;
  final bool canSaveStatus;

  @override
  Widget build(BuildContext context) {
    return ListSurface(
      title: 'Bicycles',
      subtitle: 'Add, edit, delete, rent, return, repair, and search bikes.',
      actionLabel: 'Add bike',
      onAction: canAdd ? onAdd : null,
      child: Column(
        children: [
          _DataTableViewport(
            child: DataTable(
              headingRowHeight: 96,
              dataRowMinHeight: 58,
              dataRowMaxHeight: 72,
              columnSpacing: 18,
              horizontalMargin: 12,
              columns: [
                _column('Bike', 'name', width: 170),
                _column('NFC code', 'nfcCode', width: 170),
                _column('Status', 'status', width: 130),
                _column('Soldier', 'assignedSoldier', width: 190),
                _column('Helmet', 'helmetCode', width: 150),
                _column('Rented at', 'rentedAt', width: 170),
                const DataColumn(
                  label: SizedBox(width: 172, child: Text('Actions')),
                ),
              ],
              rows: rows.map(_bikeRow).toList(),
            ),
          ),
          _PaginationBar(meta: meta, onPageChanged: onPageChanged),
        ],
      ),
    );
  }

  DataColumn _column(String title, String column, {required double width}) {
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
      ),
    );
  }

  DataRow _bikeRow(BicycleAsset bike) {
    return DataRow(
      cells: [
        DataCell(_tableText(bike.name, width: 170)),
        DataCell(_tableText(bike.nfcCode, width: 170)),
        DataCell(SizedBox(width: 130, child: StatusChip(status: bike.status))),
        DataCell(_tableText(bike.assignedSoldier ?? '-', width: 190)),
        DataCell(_tableText(bike.helmetCode ?? '-', width: 150)),
        DataCell(_tableText(_formatTableDateTime(bike.rentedAt), width: 170)),
        DataCell(
          SizedBox(
            width: 172,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ActionIconButton(
                  tooltip: 'Show NFC details',
                  onPressed: () => onShowDetails(bike),
                  icon: Icons.manage_search_outlined,
                ),
                _ActionIconButton(
                  tooltip: 'Edit bike',
                  onPressed: canEdit ? () => onEdit(bike) : null,
                  icon: Icons.edit_outlined,
                ),
                _ActionIconButton(
                  tooltip: 'Delete bike',
                  onPressed: canDelete ? () => onDelete(bike) : null,
                  icon: Icons.delete_outline,
                ),
                if (bike.isAvailable)
                  _ActionIconButton(
                    tooltip: 'Rent bike',
                    onPressed: canSaveStatus ? () => onRent(bike) : null,
                    icon: Icons.assignment_turned_in_outlined,
                  )
                else
                  _ActionIconButton(
                    tooltip: 'Return bike',
                    onPressed: canSaveStatus ? () => onReturn(bike) : null,
                    icon: Icons.keyboard_return,
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class HelmetsView extends StatelessWidget {
  const HelmetsView({
    required this.rows,
    required this.filters,
    required this.meta,
    required this.sortColumn,
    required this.sortDirection,
    required this.onFilterChanged,
    required this.onSort,
    required this.onPageChanged,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
    required this.onShowDetails,
    required this.canAdd,
    required this.canEdit,
    required this.canDelete,
    super.key,
  });

  final List<HelmetAsset> rows;
  final Map<String, String> filters;
  final TablePageMeta meta;
  final String? sortColumn;
  final String sortDirection;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;
  final Future<void> Function(int page) onPageChanged;
  final VoidCallback onAdd;
  final ValueChanged<HelmetAsset> onEdit;
  final ValueChanged<HelmetAsset> onDelete;
  final ValueChanged<HelmetAsset> onShowDetails;
  final bool canAdd;
  final bool canEdit;
  final bool canDelete;

  @override
  Widget build(BuildContext context) {
    return ListSurface(
      title: 'Helmets',
      subtitle: 'Add, edit, delete, and search helmets.',
      actionLabel: 'Add helmet',
      onAction: canAdd ? onAdd : null,
      child: Column(
        children: [
          _DataTableViewport(
            child: DataTable(
              headingRowHeight: 96,
              dataRowMinHeight: 58,
              dataRowMaxHeight: 72,
              columnSpacing: 18,
              horizontalMargin: 12,
              columns: [
                _column('Helmet', 'code', width: 170),
                _column('NFC code', 'nfcCode', width: 170),
                _column('Status', 'status', width: 130),
                _column('Bike', 'bicycleName', width: 190),
                _column('Soldier', 'assignedSoldier', width: 190),
                const DataColumn(
                  label: SizedBox(width: 128, child: Text('Actions')),
                ),
              ],
              rows: rows.map(_helmetRow).toList(),
            ),
          ),
          _PaginationBar(meta: meta, onPageChanged: onPageChanged),
        ],
      ),
    );
  }

  DataColumn _column(String title, String column, {required double width}) {
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
      ),
    );
  }

  DataRow _helmetRow(HelmetAsset helmet) {
    return DataRow(
      cells: [
        DataCell(_tableText(helmet.code, width: 170)),
        DataCell(_tableText(helmet.nfcCode, width: 170)),
        DataCell(
          SizedBox(width: 130, child: StatusChip(status: helmet.status)),
        ),
        DataCell(_tableText(helmet.bicycleName ?? '-', width: 190)),
        DataCell(_tableText(helmet.assignedSoldier ?? '-', width: 190)),
        DataCell(
          SizedBox(
            width: 128,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ActionIconButton(
                  tooltip: 'Show NFC details',
                  onPressed: () => onShowDetails(helmet),
                  icon: Icons.manage_search_outlined,
                ),
                _ActionIconButton(
                  tooltip: 'Edit helmet',
                  onPressed: canEdit ? () => onEdit(helmet) : null,
                  icon: Icons.edit_outlined,
                ),
                _ActionIconButton(
                  tooltip: 'Delete helmet',
                  onPressed: canDelete ? () => onDelete(helmet) : null,
                  icon: Icons.delete_outline,
                ),
              ],
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
  });

  final String title;
  final String column;
  final double width;
  final String filterValue;
  final String? activeSortColumn;
  final String sortDirection;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;

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
          ),
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

class _ActionIconButton extends StatelessWidget {
  const _ActionIconButton({
    required this.tooltip,
    required this.onPressed,
    required this.icon,
  });

  final String tooltip;
  final VoidCallback? onPressed;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: 40,
      child: IconButton(
        tooltip: tooltip,
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        visualDensity: VisualDensity.compact,
        icon: Icon(icon, size: 21),
      ),
    );
  }
}

Widget _tableText(String value, {required double width}) {
  return SizedBox(
    width: width,
    child: Text(value, maxLines: 2, overflow: TextOverflow.ellipsis),
  );
}

String _formatTableDateTime(String? value) {
  final text = (value ?? '').trim();
  if (text.isEmpty) return '-';
  final date = DateTime.tryParse(text);
  if (date == null) return text;
  return formatDateTime(date.toLocal());
}

bool _countsTowardSoldierBikeBalance(String status) {
  return switch (status.trim().toLowerCase()) {
    'rented' || 'late' || 'long_term' => true,
    _ => false,
  };
}

int _bikeBalanceFromAssignments(List<RentalRecord> assignments) {
  return assignments
      .where((assignment) => _countsTowardSoldierBikeBalance(assignment.status))
      .length;
}

class SoldiersView extends StatelessWidget {
  const SoldiersView({
    required this.rows,
    required this.filters,
    required this.onFilterChanged,
    required this.onShowDetails,
    required this.bikeBalanceForSoldier,
    super.key,
  });

  final List<Soldier> rows;
  final Map<String, String> filters;
  final void Function(String column, String value) onFilterChanged;
  final ValueChanged<Soldier> onShowDetails;
  final int Function(Soldier soldier) bikeBalanceForSoldier;

  @override
  Widget build(BuildContext context) {
    return ListSurface(
      title: '',
      subtitle: '',
      showHeader: false,
      searchLabel: 'Search soldier',
      search: filters['name'] ?? '',
      onSearch: (value) => onFilterChanged('name', value),
      child: Column(
        children: [
          if (rows.isEmpty) ...[
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: EmptyState(
                message: 'No hired soldiers match the current filters.',
              ),
            ),
          ] else ...[
            const SizedBox(height: 12),
            GridView.builder(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 320,
                mainAxisExtent: 132,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: rows.length,
              itemBuilder: (context, index) {
                final soldier = rows[index];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                soldier.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            ),
                            _ActionIconButton(
                              tooltip: 'Show NFC details',
                              onPressed: () => onShowDetails(soldier),
                              icon: Icons.manage_search_outlined,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          soldier.country ?? '',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const Spacer(),
                        Text(
                          '${bikeBalanceForSoldier(soldier)} '
                          'active bike assignment(s)',
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
