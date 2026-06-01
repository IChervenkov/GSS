import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../config/app_config.dart';
import '../models/inventory_models.dart';
import '../services/inventory_api_client.dart';
import '../services/inventory_socket_client.dart';
import '../services/native_bridge.dart';
import '../utils/formatters.dart';
import '../widgets/common_widgets.dart';

const _assetFilterColumns = [
  'code',
  'rfidCode',
  'name',
  'typeName',
  'location',
  'status',
  'inventoryStatus',
  'lastInventoryDate',
  'owner',
  'category',
  'service',
  'expandable',
  'isFixedLabel',
  'isQuantitativeLabel',
  'description',
  'mrah',
  'comments',
  'replacedOff',
  'replacedBy',
  'purchaseDate',
  'writtenOffDate',
  'createdAt',
  'updatedAt',
];

const _notFoundFilterColumns = ['code', 'rfidCode', 'name', 'typeName', 'room'];

Map<String, String> _emptyAssetFilters([
  List<String> columns = _assetFilterColumns,
]) => {for (final column in columns) column: ''};

class InventoryOperationsScreen extends StatefulWidget {
  const InventoryOperationsScreen({
    required this.api,
    required this.onLogout,
    required this.onAuthExpired,
    super.key,
  });

  final InventoryApiClient api;
  final Future<void> Function() onLogout;
  final Future<void> Function() onAuthExpired;

  @override
  State<InventoryOperationsScreen> createState() =>
      _InventoryOperationsScreenState();
}

class _InventoryOperationsScreenState extends State<InventoryOperationsScreen>
    with WidgetsBindingObserver {
  late final InventorySocketClient _socket = InventorySocketClient(
    api: widget.api,
    onChanged: _scheduleRefresh,
    onCampsChanged: _scheduleCampRefresh,
    onPermissionsChanged: _schedulePermissionRefresh,
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
  InventoryAppPermissions _permissions = const InventoryAppPermissions();
  AssetsOverview _overview = const AssetsOverview();
  final StreamController<List<Camp>> _campUpdates =
      StreamController<List<Camp>>.broadcast();
  final StreamController<AssetsOverview> _overviewUpdates =
      StreamController<AssetsOverview>.broadcast();
  final StreamController<AssetLookupData> _lookupUpdates =
      StreamController<AssetLookupData>.broadcast();
  final StreamController<InventoryAppPermissions> _permissionUpdates =
      StreamController<InventoryAppPermissions>.broadcast();
  StreamSubscription<String>? _rfidSubscription;
  Timer? _refreshDebounce;
  Timer? _campRefreshDebounce;
  Timer? _permissionRefreshDebounce;
  bool _refreshInFlight = false;
  bool _refreshAgain = false;
  bool _permissionRefreshInFlight = false;
  bool _updatePromptOpen = false;
  bool _authExpired = false;
  bool _rfidProcessing = false;
  bool _rfidHandledByDialog = false;
  bool _inventoryLocationResetting = false;
  final Set<String> _appUpdateNotificationVersions = {};
  final Map<String, String> _assetFilters = _emptyAssetFilters();
  final Map<String, String> _notFoundFilters = _emptyAssetFilters(
    _notFoundFilterColumns,
  );
  int _assetPage = 1;
  int _notFoundPage = 1;
  String? _assetSortColumn;
  String _assetSortDirection = 'default';
  String? _notFoundSortColumn;
  String _notFoundSortDirection = 'default';
  AssetRoom? _selectedRoom;
  String _inventoryMessage = 'Choose a room to start inventory.';
  List<_RoomScanFinding> _roomScanFindings = const [];
  final Set<String> _roomFindingActions = {};
  final Set<String> _scannedRoomRfidCodes = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _rfidSubscription = NativeBridge.rfidScans.listen(
      (rfidCode) => unawaited(_handleRfidScan(rfidCode)),
      onError: (error) => _show(_rfidErrorMessage(error)),
    );
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
    unawaited(_lookupUpdates.close());
    unawaited(_permissionUpdates.close());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncRfidScanAvailability();
      unawaited(_handlePendingUpdateNotificationTap());
    } else if (state == AppLifecycleState.paused) {
      unawaited(_ignoreNative(NativeBridge.setRfidScanEnabled(false)));
    }
  }

  bool get _canInventoryScan =>
      _selectedTab == 2 &&
      _selectedCampId.isNotEmpty &&
      _selectedRoom != null &&
      _permissions.canSaveInventory &&
      !_inventoryLocationResetting;

  bool get _canAssetLookupScan =>
      _selectedTab == 1 && _selectedCampId.isNotEmpty && _permissions.canUse;

  bool get _canRfidScan => _canAssetLookupScan || _canInventoryScan;

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
        _selectedCampId = camps.isNotEmpty ? camps.first.id : '';
      });
      _publishCampOptions();
      _publishPermissionOptions();
      await _socket.connect();
      await _refresh();
      if (await NativeBridge.consumeAppUpdateNotificationTap()) {
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

  Future<void> _handlePendingUpdateNotificationTap() async {
    if (await NativeBridge.consumeAppUpdateNotificationTap()) {
      await _checkForUpdate(manual: true);
    }
  }

  Future<void> _ignoreNative(Future<void> future) async {
    try {
      await future;
    } catch (_) {}
  }

  void _syncRfidScanAvailability() {
    unawaited(
      _ignoreNative(
        NativeBridge.setRfidScanEnabled(!_rfidHandledByDialog && _canRfidScan),
      ),
    );
  }

  void _publishCampOptions() {
    if (!_campUpdates.isClosed) _campUpdates.add(_camps);
  }

  void _publishLookupOptions() {
    if (!_lookupUpdates.isClosed) _lookupUpdates.add(_overview.lookups);
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
    if (error is! InventoryApiException) return false;
    final code = (error.code ?? '').toUpperCase();
    return error.statusCode == 401 ||
        error.statusCode == 423 ||
        code == 'INVALID_TOKEN' ||
        code == 'INVALID_REFRESH_TOKEN' ||
        code == 'SOCKET_TOKEN_REVOKED' ||
        code == 'SOCKET_SESSION_INVALID' ||
        code == 'ACCOUNT_LOCKED';
  }

  bool _samePermissions(
    InventoryAppPermissions left,
    InventoryAppPermissions right,
  ) {
    if (left.names.length != right.names.length) return false;
    return left.names.every(right.names.contains);
  }

  Future<void> _refreshPermissions({bool quiet = false}) async {
    if (_authExpired || _permissionRefreshInFlight) return;
    _permissionRefreshInFlight = true;
    try {
      final permissions = await widget.api.permissions();
      if (!mounted) return;
      final changed = !_samePermissions(_permissions, permissions);
      final hadUse = _permissions.canUse;
      if (changed) {
        setState(() => _permissions = permissions);
        _publishPermissionOptions();
        _syncRfidScanAvailability();
      }
      if (!permissions.canUse) {
        _closeOpenModalWindows();
      }
      if (permissions.canUse && !hadUse) {
        await _socket.connect();
        await _refresh(quiet: true);
      }
      if (!quiet && !changed) _publishPermissionOptions();
    } catch (error) {
      if (_isAuthFailure(error)) await _handleAuthExpired();
    } finally {
      _permissionRefreshInFlight = false;
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
      final stillExists =
          _selectedCampId.isNotEmpty &&
          camps.any((camp) => camp.id == _selectedCampId);
      final nextCampId = stillExists
          ? _selectedCampId
          : (camps.isNotEmpty ? camps.first.id : '');
      final changed = nextCampId != _selectedCampId;
      setState(() {
        _camps = camps;
        _selectedCampId = nextCampId;
        if (changed) {
          _overview = const AssetsOverview();
          _selectedRoom = null;
          _roomScanFindings = const [];
          _roomFindingActions.clear();
          _scannedRoomRfidCodes.clear();
          _inventoryMessage = 'Choose a room to start inventory.';
        }
      });
      _publishCampOptions();
      _publishLookupOptions();
      _syncRfidScanAvailability();
      if (changed && nextCampId.isNotEmpty) await _refresh(quiet: true);
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

  Map<String, dynamic> _tableState() {
    return {
      'allAssets': {'page': 1, 'limit': 100},
      'notFoundRows': {'page': 1, 'limit': 100},
    };
  }

  Future<void> _refresh({bool quiet = false}) async {
    if (_selectedCampId.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    if (!quiet && mounted) setState(() => _loading = true);
    try {
      final overview = await widget.api.overview(
        _selectedCampId,
        tableState: _tableState(),
      );
      if (!mounted) return;
      setState(() {
        _overview = overview;
        _loading = false;
        _selectedRoom = _resolveRoom(_selectedRoom);
      });
      if (!_overviewUpdates.isClosed) _overviewUpdates.add(overview);
      _publishLookupOptions();
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else {
        _show(errorMessage(error));
      }
      if (mounted) setState(() => _loading = false);
    }
  }

  AssetRoom? _resolveRoom(AssetRoom? room) {
    if (room == null) return null;
    for (final candidate in _overview.lookups.rooms) {
      if (candidate.id == room.id) return candidate;
    }
    return null;
  }

  Asset? _findAssetById(String id) {
    for (final asset in _overview.allAssets) {
      if (asset.id == id) return asset;
    }
    for (final asset in _overview.notFoundRows) {
      if (asset.id == id) return asset;
    }
    return null;
  }

  Future<void> _handleRfidScan(String rfidCode) async {
    if (_rfidHandledByDialog || _rfidProcessing) return;
    final normalizedCode = rfidCode.trim();
    if (normalizedCode.isEmpty) return;
    if (_canAssetLookupScan) {
      await _handleAssetLookupRfidScan(normalizedCode);
      return;
    }
    if (!_canInventoryScan) return;
    if (_scannedRoomRfidCodes.contains(normalizedCode.toLowerCase())) return;
    final room = _selectedRoom;
    if (room == null) return;
    _rfidProcessing = true;
    setState(() {
      _inventoryMessage = 'Scanning asset...';
    });
    try {
      final result = await widget.api.rfidLookup(
        _selectedCampId,
        normalizedCode,
      );
      final asset = result.asset;
      if (asset.locationRoomId != room.id) {
        _addRoomScanFinding(
          _RoomScanFinding.offLocation(rfidCode: normalizedCode, asset: asset),
        );
        return;
      }
      await widget.api.recordInventory(
        _selectedCampId,
        assetId: asset.id,
        locationRoomId: room.id,
      );
      _scannedRoomRfidCodes.add(normalizedCode.toLowerCase());
      await _refresh(quiet: true);
      if (mounted) {
        setState(() => _inventoryMessage = 'Asset marked completed.');
      }
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else if (_isMissingAssetRfid(error)) {
        _scannedRoomRfidCodes.add(normalizedCode.toLowerCase());
        _addRoomScanFinding(
          _RoomScanFinding.newAsset(rfidCode: normalizedCode),
        );
      } else {
        final message = _rfidErrorMessage(error);
        setState(() {
          _inventoryMessage = message;
        });
        _show(message);
      }
    } finally {
      _rfidProcessing = false;
    }
  }

  Future<void> _handleAssetLookupRfidScan(String rfidCode) async {
    _rfidProcessing = true;
    setState(() {
      _assetFilters['rfidCode'] = rfidCode;
      _assetPage = 1;
    });
    try {
      final result = await widget.api.rfidLookup(_selectedCampId, rfidCode);
      if (!mounted) return;
      setState(() {
        _assetFilters['rfidCode'] = result.asset.rfidCode.isNotEmpty
            ? result.asset.rfidCode
            : rfidCode;
        _assetPage = 1;
      });
      await _refresh(quiet: true);
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else {
        _show(
          _isMissingAssetRfid(error)
              ? 'Asset not found.'
              : _rfidErrorMessage(error),
        );
      }
    } finally {
      _rfidProcessing = false;
    }
  }

  bool _isMissingAssetRfid(Object error) {
    return error is InventoryApiException &&
        error.statusCode == 404 &&
        (error.code == null || error.code == 'ASSET_NOT_FOUND');
  }

  void _addRoomScanFinding(_RoomScanFinding finding) {
    _scannedRoomRfidCodes.add(finding.rfidCode.trim().toLowerCase());
    final existingIndex = _roomScanFindings.indexWhere(
      (item) => item.identity == finding.identity,
    );
    setState(() {
      if (existingIndex == -1) {
        _roomScanFindings = [..._roomScanFindings, finding];
      } else {
        final nextFindings = [..._roomScanFindings];
        nextFindings[existingIndex] = _roomScanFindings[existingIndex].copyWith(
          asset: finding.asset,
        );
        _roomScanFindings = nextFindings;
      }
      _inventoryMessage = finding.isNewAsset
          ? 'Unknown RFID listed for asset creation.'
          : 'Off-location asset listed for relocation.';
    });
  }

  Future<void> _checkForUpdate({bool manual = false}) async {
    if (_authExpired || _updatePromptOpen) return;
    try {
      try {
        await widget.api.refreshTokens();
      } catch (_) {}
      if ((await widget.api.accessToken).isEmpty) return;
      final update = await widget.api.appVersion();
      if (_authExpired || !mounted) return;
      final apkUrl = update.apkUrl;
      if (apkUrl == null || apkUrl.isEmpty) {
        if (manual) _show('No Android update package is published.');
        return;
      }
      final build = await NativeBridge.appBuildInfo();
      final currentVersion = build.versionName.trim();
      final nextVersion = (update.version ?? '').trim();
      final changed = nextVersion.isNotEmpty && nextVersion != currentVersion;
      if (!changed) {
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
      _updatePromptOpen = true;
      final install = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Update available'),
          content: Text(
            'GSS Inventory $nextVersion is ready to install. Current version: ${currentVersion.isEmpty ? 'unknown' : currentVersion}.',
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
      _updatePromptOpen = false;
      if (install != true) return;
      final bearerToken = await widget.api.accessToken;
      if (bearerToken.isEmpty) return;
      await NativeBridge.downloadAndInstallUpdate(
        url: widget.api.absoluteUrl(apkUrl),
        bearerToken: bearerToken,
        sha256: update.sha256,
      );
    } catch (error) {
      _updatePromptOpen = false;
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
        return;
      }
      if (manual) _show(errorMessage(error));
    }
  }

  Future<void> _changeCamp(String campId) async {
    setState(() {
      _selectedCampId = campId;
      _overview = const AssetsOverview();
      _selectedRoom = null;
      _roomScanFindings = const [];
      _roomFindingActions.clear();
      _inventoryMessage = 'Choose a room to start inventory.';
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
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'Assets',
          ),
          NavigationDestination(
            icon: Icon(Icons.meeting_room_outlined),
            selectedIcon: Icon(Icons.meeting_room),
            label: 'Inventory',
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
                  if (!_permissions.canUse)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(18),
                        child: Text(
                          'You do not have permission to use the assets mobile app.',
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

  void _selectTab(int index) {
    if (index == _selectedTab) return;
    setState(() {
      _selectedTab = index;
      if (index != 2) _scannedRoomRfidCodes.clear();
    });
    _syncRfidScanAvailability();
  }

  Widget _activeView() {
    return switch (_selectedTab) {
      0 => _buildOverviewTab(),
      1 => _buildAssetsTab(),
      2 => _buildInventoryTab(),
      _ => _buildOverviewTab(),
    };
  }

  Widget _buildOverviewTab() {
    final pagedRows = _notFoundRowsForTable();
    return _OverviewView(
      overview: _overview,
      notFoundRows: pagedRows.rows,
      notFoundMeta: pagedRows.meta,
      notFoundFilters: _notFoundFilters,
      notFoundSortColumn: _notFoundSortColumn,
      notFoundSortDirection: _notFoundSortDirection,
      onNotFoundFilterChanged: (column, value) {
        setState(() {
          _notFoundFilters[column] = value;
          _notFoundPage = 1;
        });
      },
      onNotFoundSort: _sortNotFound,
      onNotFoundPageChanged: (page) async {
        setState(() => _notFoundPage = page);
      },
    );
  }

  Widget _buildAssetsTab() {
    final pagedRows = _assetRowsForTable();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListSurface(
          title: 'All assets',
          subtitle:
              'Search, sort, add, edit, and remove assets for the selected camp.',
          actionLabel: 'Add asset',
          onAction: _permissions.canAddAsset
              ? () => unawaited(_showAssetEditor())
              : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _AssetsTable(
                rows: pagedRows.rows,
                filters: _assetFilters,
                sortColumn: _assetSortColumn,
                sortDirection: _assetSortDirection,
                canEdit: _permissions.canEditAsset,
                canDelete: _permissions.canDeleteAsset,
                onFilterChanged: (column, value) {
                  setState(() {
                    _assetFilters[column] = value;
                    _assetPage = 1;
                  });
                },
                onSort: _sortAssets,
                onEdit: (asset) => unawaited(_showAssetEditor(asset: asset)),
                onDelete: (asset) => unawaited(_deleteAsset(asset)),
              ),
              _PaginationBar(
                meta: pagedRows.meta,
                onPageChanged: (page) async {
                  setState(() => _assetPage = page);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _sortAssets(String column) async {
    setState(() {
      if (_assetSortColumn != column) {
        _assetSortColumn = column;
        _assetSortDirection = 'asc';
      } else {
        _assetSortDirection = _nextSortDirection(_assetSortDirection);
      }
      if (_assetSortDirection == 'default') _assetSortColumn = null;
      _assetPage = 1;
    });
  }

  Future<void> _sortNotFound(String column) async {
    setState(() {
      if (_notFoundSortColumn != column) {
        _notFoundSortColumn = column;
        _notFoundSortDirection = 'asc';
      } else {
        _notFoundSortDirection = _nextSortDirection(_notFoundSortDirection);
      }
      if (_notFoundSortDirection == 'default') _notFoundSortColumn = null;
      _notFoundPage = 1;
    });
  }

  String _nextSortDirection(String current) {
    return switch (current) {
      'asc' => 'desc',
      'desc' => 'default',
      _ => 'asc',
    };
  }

  _PagedAssetRows _assetRowsForTable() {
    return _assetPageFromRows(
      _overview.allAssets,
      page: _assetPage,
      filters: _assetFilters,
      sortColumn: _assetSortColumn,
      sortDirection: _assetSortDirection,
    );
  }

  _PagedAssetRows _notFoundRowsForTable() {
    return _assetPageFromRows(
      _overview.notFoundRows,
      page: _notFoundPage,
      filters: _notFoundFilters,
      sortColumn: _notFoundSortColumn,
      sortDirection: _notFoundSortDirection,
    );
  }

  _PagedAssetRows _assetPageFromRows(
    List<Asset> source, {
    required int page,
    required Map<String, String> filters,
    required String? sortColumn,
    required String sortDirection,
  }) {
    final rows = source
        .where((asset) => _matchesAssetFilters(asset, filters))
        .toList();
    _sortRows<Asset>(
      rows,
      sortColumn: sortColumn,
      sortDirection: sortDirection,
      valueForColumn: _assetColumnValue,
    );
    final boundedPage = _boundedTablePage(page, rows.length);
    return _PagedAssetRows(
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

  bool _matchesAssetFilters(Asset asset, Map<String, String> filters) {
    for (final entry in filters.entries) {
      final needle = entry.value.trim();
      if (needle.isEmpty) continue;
      if (!_matchesFilter(_assetColumnValue(asset, entry.key), needle)) {
        return false;
      }
    }
    return true;
  }

  bool _matchesFilter(String value, String needle) {
    return value.toLowerCase().contains(needle.toLowerCase());
  }

  String _assetColumnValue(Asset asset, String column) {
    return switch (column) {
      'code' => asset.code,
      'rfidCode' => asset.rfidCode,
      'name' => asset.name,
      'typeName' => asset.typeName,
      'room' => asset.locationRoomName ?? asset.location,
      'location' => asset.location,
      'status' => asset.status,
      'inventoryStatus' =>
        '${asset.inventoryStatus} ${asset.inventoryStatusLabel}',
      'lastInventoryDate' => asset.lastInventoryDate ?? '',
      'owner' => asset.owner ?? '',
      'category' => asset.category ?? '',
      'service' => asset.service ?? '',
      'expandable' => asset.expandable ?? '',
      'isFixedLabel' => asset.isFixedLabel ?? (asset.isFixed ? 'Yes' : 'No'),
      'isQuantitativeLabel' =>
        asset.isQuantitativeLabel ?? (asset.isQuantitative ? 'Yes' : 'No'),
      'description' => asset.description ?? '',
      'mrah' => asset.mrah ?? '',
      'comments' => asset.comments ?? '',
      'replacedOff' => asset.replacedOff ?? '',
      'replacedBy' => asset.replacedBy ?? '',
      'purchaseDate' => asset.purchaseDate ?? '',
      'writtenOffDate' => asset.writtenOffDate ?? '',
      'createdAt' => asset.createdAt ?? '',
      'updatedAt' => asset.updatedAt ?? '',
      'm2Inside' => _numberSortValue(asset.m2Inside),
      'yearOfLifeCycle' => _numberSortValue(asset.yearOfLifeCycle),
      'restOfLifeCycle' => _numberSortValue(asset.restOfLifeCycle),
      'restValue' => _numberSortValue(asset.restValue),
      'purchasePrice' => _numberSortValue(asset.purchasePrice),
      'quantity' => _numberSortValue(asset.quantity),
      _ => '',
    };
  }

  String _numberSortValue(String? value) {
    final parsed = double.tryParse((value ?? '').replaceAll(',', '.')) ?? 0;
    return parsed.toStringAsFixed(6).padLeft(18, '0');
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

  Future<void> _openSettings() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => _SettingsScreen(
          camps: _camps,
          selectedCampId: _selectedCampId,
          campUpdates: _campUpdates.stream,
          permissionUpdates: _permissionUpdates.stream,
          canCheckForUpdate: _permissions.canDownloadAssetsApp,
          onCampChanged: _changeCamp,
          onCheckForUpdate: () => _checkForUpdate(manual: true),
        ),
      ),
    );
  }

  Widget _buildInventoryTab() {
    final room = _selectedRoom;
    final roomAssets = room == null
        ? const <Asset>[]
        : _overview.allAssets
              .where((asset) => asset.locationRoomId == room.id)
              .toList();
    final completed = roomAssets.where((asset) => asset.isFound).length;
    final missing = roomAssets.where((asset) => asset.isMissing).length;
    final unexpected = _roomScanFindings.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListSurface(
          title: 'Inventory by room',
          subtitle:
              'Select a room, scan asset RFID tags, and mark found assets as completed.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SearchSelectionField<AssetRoom>(
                labelText: 'Room',
                leadingIcon: Icons.meeting_room_outlined,
                options: _overview.lookups.rooms,
                optionsStream: _lookupUpdates.stream.map(
                  (lookups) => lookups.rooms,
                ),
                selectedValue: room,
                itemLabel: (room) => room.label,
                itemSubtitle: (room) => room.meta,
                onChanged: _selectInventoryRoom,
                emptyMessage: 'No rooms found for this camp.',
              ),
              const SizedBox(height: 12),
              Center(
                child: Wrap(
                  alignment: WrapAlignment.center,
                  runAlignment: WrapAlignment.center,
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _MiniMetric(
                      label: 'Expected',
                      value: '${roomAssets.length}',
                    ),
                    _MiniMetric(label: 'Completed', value: '$completed'),
                    _MiniMetric(label: 'Not found', value: '$missing'),
                    _MiniMetric(label: 'New/off-room', value: '$unexpected'),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              ListTile(
                leading: const Icon(Icons.sensors_outlined),
                title: Text(
                  room == null
                      ? 'Choose a room to scan'
                      : 'Ready for direct scanning',
                ),
                subtitle: Text(_inventoryMessage),
              ),
              if (room != null && _roomScanFindings.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  'Off-location and new scans',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                ..._roomScanFindings.map(
                  (finding) => _RoomScanFindingTile(
                    finding: finding,
                    busy: _roomFindingActions.contains(finding.identity),
                    canSave: _permissions.canSaveInventory,
                    onAddAsset: finding.isNewAsset && !finding.completed
                        ? () => unawaited(_addScannedAsset(finding))
                        : null,
                    onEditAsset: finding.isOffLocation && !finding.completed
                        ? () => unawaited(_editScannedAsset(finding))
                        : null,
                  ),
                ),
              ],
              const SizedBox(height: 12),
              if (room == null)
                const EmptyState(message: 'Choose a room to see its assets.')
              else if (roomAssets.isEmpty)
                const EmptyState(message: 'No assets found in this room.')
              else
                ...roomAssets.map(
                  (asset) => Card(
                    child: ListTile(
                      leading: StatusChip(
                        status: asset.inventoryStatus,
                        label: asset.inventoryStatusLabel,
                      ),
                      title: Text(asset.code),
                      subtitle: Text('${asset.name} | ${asset.typeName}'),
                      trailing: IconButton(
                        tooltip: 'Mark completed',
                        onPressed: _permissions.canSaveInventory
                            ? () => unawaited(_markAssetCompleted(asset))
                            : null,
                        icon: const Icon(Icons.check_circle_outline),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _addScannedAsset(_RoomScanFinding finding) async {
    final room = _selectedRoom;
    if (room == null) return;
    final saved = await _showAssetEditor(
      initialRfidCode: finding.rfidCode,
      initialRoom: room,
      initialInventoryStatus: 'completed',
      roomInventoryMode: true,
    );
    if (!saved || !mounted) return;
    _markRoomScanFindingCompleted(finding.identity);
    setState(() => _inventoryMessage = 'New scanned asset completed.');
  }

  Future<void> _editScannedAsset(_RoomScanFinding finding) async {
    final room = _selectedRoom;
    final asset = finding.asset;
    if (room == null || asset == null) return;
    setState(() => _roomFindingActions.add(finding.identity));
    final saved = await _showAssetEditor(
      asset: asset,
      initialRoom: room,
      initialInventoryStatus: 'completed',
      roomInventoryMode: true,
    );
    if (!mounted) return;
    setState(() => _roomFindingActions.remove(finding.identity));
    if (saved) {
      _markRoomScanFindingCompleted(finding.identity);
      setState(() => _inventoryMessage = '${asset.code} updated.');
    }
  }

  void _markRoomScanFindingCompleted(String identity) {
    final index = _roomScanFindings.indexWhere(
      (finding) => finding.identity == identity,
    );
    if (index == -1) return;
    final nextFindings = [..._roomScanFindings];
    nextFindings[index] = nextFindings[index].copyWith(completed: true);
    setState(() => _roomScanFindings = nextFindings);
  }

  Future<void> _markAssetCompleted(Asset asset) async {
    final room = _selectedRoom;
    if (room == null) return;
    final confirmed = await _confirm(
      'Mark ${asset.code} completed?',
      'Mark this asset as completed for ${room.name} and refresh the inventory totals.',
      titleBuilder: () {
        final current = _findAssetById(asset.id) ?? asset;
        return 'Mark ${current.code} completed?';
      },
      messageBuilder: () {
        final currentRoom = _resolveRoom(room) ?? room;
        return 'Mark this asset as completed for ${currentRoom.name} and refresh the inventory totals.';
      },
      contentUpdates: _overviewUpdates.stream,
      canConfirm: _permissions.canSaveInventory,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => permissions.canSaveInventory,
      ),
    );
    if (!confirmed) return;
    try {
      await widget.api.recordInventory(
        _selectedCampId,
        assetId: asset.id,
        locationRoomId: room.id,
      );
      await _refresh(quiet: true);
      if (mounted) {
        setState(() => _inventoryMessage = '${asset.code} marked completed.');
      }
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else {
        _show(errorMessage(error));
      }
    }
  }

  Future<void> _selectInventoryRoom(AssetRoom room) async {
    final canPrepareInventory =
        _selectedCampId.isNotEmpty && _permissions.canSaveInventory;
    setState(() {
      _selectedRoom = room;
      _roomScanFindings = const [];
      _roomFindingActions.clear();
      _scannedRoomRfidCodes.clear();
      _inventoryLocationResetting = canPrepareInventory;
      _inventoryMessage = canPrepareInventory
          ? 'Preparing ${room.name} for inventory...'
          : 'You do not have permission to save inventory.';
    });
    _syncRfidScanAvailability();
    if (!canPrepareInventory) return;
    try {
      await widget.api.restartInventory(
        _selectedCampId,
        locationRoomId: room.id,
      );
      await _refresh(quiet: true);
      if (mounted) {
        setState(() {
          _selectedRoom = _resolveRoom(room);
          _inventoryMessage = 'Hold the RFID trigger to scan room assets.';
        });
      }
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else {
        if (mounted) {
          setState(
            () => _inventoryMessage = 'Room inventory could not be prepared.',
          );
        }
        _show(errorMessage(error));
      }
    } finally {
      if (mounted) {
        setState(() => _inventoryLocationResetting = false);
        _syncRfidScanAvailability();
      }
    }
  }

  Future<bool> _showAssetEditor({
    Asset? asset,
    String? initialRfidCode,
    AssetRoom? initialRoom,
    String? initialInventoryStatus,
    bool roomInventoryMode = false,
  }) async {
    final canSubmit = asset == null
        ? _permissions.canAddAsset
        : _permissions.canEditAsset;
    if (!canSubmit) {
      _show(
        asset == null
            ? 'You do not have permission to add assets.'
            : 'You do not have permission to edit assets.',
      );
      return false;
    }
    _rfidHandledByDialog = true;
    _syncRfidScanAvailability();
    final _AssetFormResult? result;
    try {
      result = await showDialog<_AssetFormResult>(
        context: context,
        builder: (context) => _AssetEditorDialog(
          asset: asset,
          lookups: _overview.lookups,
          lookupsStream: _lookupUpdates.stream,
          initialRfidCode: initialRfidCode,
          initialRoom: initialRoom,
          initialInventoryStatus: initialInventoryStatus,
          roomInventoryMode: roomInventoryMode,
          canSubmit: canSubmit,
          permissionUpdates: _permissionUpdates.stream,
        ),
      );
    } finally {
      _rfidHandledByDialog = false;
      _syncRfidScanAvailability();
    }
    if (result == null) return false;
    final stillAllowed = asset == null
        ? _permissions.canAddAsset
        : _permissions.canEditAsset;
    if (!stillAllowed) {
      _show('Your asset permissions changed. The action was not saved.');
      return false;
    }
    final confirmed = await _confirm(
      asset == null ? 'Create asset?' : 'Save asset changes?',
      asset == null
          ? 'Create asset ${result.code} in the selected camp with the entered type, quantity, tag, and assignment details.'
          : 'Update ${asset.code} with the edited type, quantity, tag, and assignment details.',
      messageBuilder: asset == null
          ? null
          : () {
              final current = _findAssetById(asset.id) ?? asset;
              return 'Update ${current.code} with the edited type, quantity, tag, and assignment details.';
            },
      contentUpdates: asset == null ? null : _overviewUpdates.stream,
      canConfirm: stillAllowed,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) =>
            asset == null ? permissions.canAddAsset : permissions.canEditAsset,
      ),
    );
    if (!confirmed) return false;
    final allowedAfterConfirm = asset == null
        ? _permissions.canAddAsset
        : _permissions.canEditAsset;
    if (!allowedAfterConfirm) {
      _show('Your asset permissions changed. The action was not saved.');
      return false;
    }
    try {
      if (asset == null) {
        await widget.api.addAsset(
          _selectedCampId,
          code: result.code,
          rfidCode: result.rfidCode,
          name: result.name,
          typeId: result.typeId,
          locationRoomId: result.locationRoomId,
          locationKeyId: result.locationKeyId,
          quantity: result.quantity,
          status: result.status,
          inventoryStatus: result.inventoryStatus,
          owner: result.owner,
          category: result.category,
          service: result.service,
          expandable: result.expandable,
          description: result.description,
          mrah: result.mrah,
          m2Inside: result.m2Inside,
          purchaseDate: result.purchaseDate,
          purchasePrice: result.purchasePrice,
          comments: result.comments,
          replacedOff: result.replacedOff,
          replacedBy: result.replacedBy,
          yearOfLifeCycle: result.yearOfLifeCycle,
          restOfLifeCycle: result.restOfLifeCycle,
          restValue: result.restValue,
          isFixed: result.isFixed,
          isQuantitative: result.isQuantitative,
        );
        _show('Asset added.');
      } else {
        await widget.api.editAsset(
          _selectedCampId,
          asset,
          code: result.code,
          rfidCode: result.rfidCode,
          name: result.name,
          typeId: result.typeId,
          locationRoomId: result.locationRoomId,
          locationKeyId: result.locationKeyId,
          quantity: result.quantity,
          status: result.status,
          inventoryStatus: result.inventoryStatus,
          owner: result.owner,
          category: result.category,
          service: result.service,
          expandable: result.expandable,
          description: result.description,
          mrah: result.mrah,
          m2Inside: result.m2Inside,
          purchaseDate: result.purchaseDate,
          purchasePrice: result.purchasePrice,
          comments: result.comments,
          replacedOff: result.replacedOff,
          replacedBy: result.replacedBy,
          yearOfLifeCycle: result.yearOfLifeCycle,
          restOfLifeCycle: result.restOfLifeCycle,
          restValue: result.restValue,
          isFixed: result.isFixed,
          isQuantitative: result.isQuantitative,
        );
        _show('Asset updated.');
      }
      await _refresh(quiet: true);
      return true;
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else {
        _show(errorMessage(error));
      }
      return false;
    }
  }

  Future<void> _deleteAsset(Asset asset) async {
    final confirmed = await _confirm(
      'Delete ${asset.code}?',
      'Remove this asset from the selected camp. The server will block deletion if the asset is still referenced.',
      titleBuilder: () {
        final current = _findAssetById(asset.id) ?? asset;
        return 'Delete ${current.code}?';
      },
      contentUpdates: _overviewUpdates.stream,
      canConfirm: _permissions.canDeleteAsset,
      canConfirmUpdates: _permissionUpdates.stream.map(
        (permissions) => permissions.canDeleteAsset,
      ),
    );
    if (!confirmed) return;
    try {
      await widget.api.deleteAsset(_selectedCampId, asset.id);
      _show('Asset removed.');
      await _refresh(quiet: true);
    } catch (error) {
      if (_isAuthFailure(error)) {
        await _handleAuthExpired();
      } else {
        _show(errorMessage(error));
      }
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
                    'Asset desk',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Inventory control and asset records',
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

  final AssetsOverview overview;

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
          label: 'Assets',
          value: '${overview.totalAssets}',
          icon: Icons.inventory_2_outlined,
        ),
        SummaryTile(
          label: 'Quantity',
          value: overview.totalQuantity,
          icon: Icons.numbers_outlined,
          color: const Color(0xff0f766e),
        ),
        SummaryTile(
          label: 'Types',
          value: '${overview.typeCount}',
          icon: Icons.category_outlined,
          color: const Color(0xff2563eb),
        ),
        SummaryTile(
          label: 'Completed',
          value: '${overview.completedAssets}',
          icon: Icons.check_circle_outline,
          color: const Color(0xff15803d),
        ),
        SummaryTile(
          label: 'Not found',
          value: '${overview.notFoundAssets}',
          icon: Icons.search_off_outlined,
          color: const Color(0xff64748b),
        ),
      ],
    );
  }
}

class _PagedAssetRows {
  const _PagedAssetRows({required this.rows, required this.meta});

  final List<Asset> rows;
  final TablePageMeta meta;
}

enum _RoomScanFindingType { newAsset, offLocation }

class _RoomScanFinding {
  const _RoomScanFinding({
    required this.type,
    required this.rfidCode,
    this.asset,
    this.completed = false,
  });

  factory _RoomScanFinding.newAsset({required String rfidCode}) {
    return _RoomScanFinding(
      type: _RoomScanFindingType.newAsset,
      rfidCode: rfidCode,
    );
  }

  factory _RoomScanFinding.offLocation({
    required String rfidCode,
    required Asset asset,
  }) {
    return _RoomScanFinding(
      type: _RoomScanFindingType.offLocation,
      rfidCode: rfidCode,
      asset: asset,
    );
  }

  final _RoomScanFindingType type;
  final String rfidCode;
  final Asset? asset;
  final bool completed;

  bool get isNewAsset => type == _RoomScanFindingType.newAsset;
  bool get isOffLocation => type == _RoomScanFindingType.offLocation;
  String get identity => asset?.id ?? rfidCode.trim().toUpperCase();

  _RoomScanFinding copyWith({Asset? asset, bool? completed}) {
    return _RoomScanFinding(
      type: type,
      rfidCode: rfidCode,
      asset: asset ?? this.asset,
      completed: completed ?? this.completed,
    );
  }
}

class _RoomScanFindingTile extends StatelessWidget {
  const _RoomScanFindingTile({
    required this.finding,
    required this.busy,
    required this.canSave,
    this.onAddAsset,
    this.onEditAsset,
  });

  final _RoomScanFinding finding;
  final bool busy;
  final bool canSave;
  final VoidCallback? onAddAsset;
  final VoidCallback? onEditAsset;

  @override
  Widget build(BuildContext context) {
    final asset = finding.asset;
    final title = finding.isNewAsset
        ? 'New RFID ${finding.rfidCode}'
        : asset?.code ?? finding.rfidCode;
    final subtitle = finding.isNewAsset
        ? 'No asset exists for this RFID code.'
        : '${asset?.name ?? 'Asset'} | ${asset?.location ?? 'Another room'}';
    final action = finding.completed
        ? const StatusChip(status: 'completed', label: 'Completed')
        : finding.isNewAsset
        ? FilledButton.icon(
            onPressed: canSave && !busy ? onAddAsset : null,
            icon: const Icon(Icons.add_circle_outline),
            label: const Text('Add asset'),
          )
        : FilledButton.icon(
            onPressed: canSave && !busy ? onEditAsset : null,
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Edit asset'),
          );

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.black.withValues(alpha: 0.08)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: ListTile(
          leading: Icon(
            finding.isNewAsset
                ? Icons.add_box_outlined
                : Icons.wrong_location_outlined,
          ),
          title: Text(title, overflow: TextOverflow.ellipsis),
          subtitle: Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: busy
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : action,
        ),
      ),
    );
  }
}

class _OverviewView extends StatelessWidget {
  const _OverviewView({
    required this.overview,
    required this.notFoundRows,
    required this.notFoundMeta,
    required this.notFoundFilters,
    required this.notFoundSortColumn,
    required this.notFoundSortDirection,
    required this.onNotFoundFilterChanged,
    required this.onNotFoundSort,
    required this.onNotFoundPageChanged,
  });

  final AssetsOverview overview;
  final List<Asset> notFoundRows;
  final TablePageMeta notFoundMeta;
  final Map<String, String> notFoundFilters;
  final String? notFoundSortColumn;
  final String notFoundSortDirection;
  final void Function(String column, String value) onNotFoundFilterChanged;
  final Future<void> Function(String column) onNotFoundSort;
  final Future<void> Function(int page) onNotFoundPageChanged;

  @override
  Widget build(BuildContext context) {
    final completionShare = overview.totalAssets == 0
        ? 0
        : ((overview.completedAssets / overview.totalAssets) * 100).round();
    final notFoundShare = overview.totalAssets == 0
        ? 0
        : ((overview.notFoundAssets / overview.totalAssets) * 100).round();
    final totalQuantityNumber =
        double.tryParse(overview.totalQuantity.replaceAll(',', '.')) ?? 0;
    final averageQuantity = overview.totalAssets == 0
        ? 0
        : totalQuantityNumber / overview.totalAssets;
    final averageQuantityLabel = averageQuantity == averageQuantity.round()
        ? '${averageQuantity.round()}'
        : averageQuantity.toStringAsFixed(1);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListSurface(
          title: 'Operational overview',
          subtitle:
              'Asset counts, quantity coverage, type coverage, and inventory progress for the selected camp.',
          child: GridView.count(
            crossAxisCount: MediaQuery.sizeOf(context).width > 980
                ? 3
                : MediaQuery.sizeOf(context).width > 700
                ? 2
                : 1,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 2.4,
            children: [
              SummaryTile(
                label: 'Completion share',
                value: '$completionShare%',
                icon: Icons.pie_chart_outline,
              ),
              SummaryTile(
                label: 'Not found share',
                value: '$notFoundShare%',
                icon: Icons.search_off_outlined,
              ),
              SummaryTile(
                label: 'Average quantity',
                value: averageQuantityLabel,
                icon: Icons.numbers_outlined,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ListSurface(
          title: 'Inventory status',
          subtitle: 'Current asset coverage grouped by inventory state.',
          child: overview.inventoryStatusRows.isEmpty
              ? const EmptyState(message: 'No inventory status rows found.')
              : Column(
                  children: overview.inventoryStatusRows
                      .map(
                        (row) => ListTile(
                          leading: StatusChip(
                            status: row.status,
                            label: row.label,
                          ),
                          title: Text('${row.assetCount} assets'),
                          subtitle: Text('Quantity ${row.quantity}'),
                          trailing: Text(row.lastInventoryDate ?? '-'),
                        ),
                      )
                      .toList(),
                ),
        ),
        const SizedBox(height: 12),
        ListSurface(
          title: 'Not found assets',
          subtitle: 'Missing records requiring room inventory follow-up.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _NotFoundAssetsTable(
                rows: notFoundRows,
                filters: notFoundFilters,
                sortColumn: notFoundSortColumn,
                sortDirection: notFoundSortDirection,
                emptyMessage: 'No assets are currently missing.',
                onFilterChanged: onNotFoundFilterChanged,
                onSort: onNotFoundSort,
              ),
              _PaginationBar(
                meta: notFoundMeta,
                onPageChanged: onNotFoundPageChanged,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 132,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const SizedBox(height: 4),
              Text(
                value,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

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
  final Stream<InventoryAppPermissions> permissionUpdates;
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
  bool _canCheckForUpdate = false;
  StreamSubscription<List<Camp>>? _campSubscription;
  StreamSubscription<InventoryAppPermissions>? _permissionSubscription;

  @override
  void initState() {
    super.initState();
    _canCheckForUpdate = widget.canCheckForUpdate;
    _campSubscription = widget.campUpdates.listen((camps) {
      if (mounted) setState(() => _camps = camps);
    });
    _permissionSubscription = widget.permissionUpdates.listen((permissions) {
      if (mounted) {
        setState(() {
          _canCheckForUpdate = permissions.canDownloadAssetsApp;
        });
      }
    });
    unawaited(_loadRfidPower());
  }

  @override
  void didUpdateWidget(covariant _SettingsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(widget.camps, oldWidget.camps)) {
      _camps = widget.camps;
    }
    if (oldWidget.canCheckForUpdate != widget.canCheckForUpdate) {
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
        if (mounted) {
          setState(() {
            _canCheckForUpdate = permissions.canDownloadAssetsApp;
          });
        }
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
      if (camp.id == widget.selectedCampId) selectedCamp = camp;
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
              subtitle: 'Choose the active camp for asset records.',
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
              title: 'RFID',
              subtitle: 'Adjust reader strength for handheld inventory scans.',
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

class _AssetsTable extends StatelessWidget {
  const _AssetsTable({
    required this.rows,
    required this.filters,
    required this.sortColumn,
    required this.sortDirection,
    required this.canEdit,
    required this.canDelete,
    required this.onFilterChanged,
    required this.onSort,
    required this.onEdit,
    required this.onDelete,
  });

  final List<Asset> rows;
  final Map<String, String> filters;
  final String? sortColumn;
  final String sortDirection;
  final bool canEdit;
  final bool canDelete;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;
  final void Function(Asset asset) onEdit;
  final void Function(Asset asset) onDelete;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _DataTableViewport(
          child: DataTable(
            headingRowHeight: 92,
            dataRowMinHeight: 58,
            dataRowMaxHeight: 72,
            columnSpacing: 18,
            horizontalMargin: 12,
            columns: [
              _column('Code', 'code', width: 150),
              _column('RFID code', 'rfidCode', width: 160),
              _column('Name', 'name', width: 190),
              _column('Type', 'typeName', width: 160),
              _column('Location', 'location', width: 220),
              _column('Status', 'status', width: 130),
              _column('Inventory', 'inventoryStatus', width: 150),
              _column('Last inventory', 'lastInventoryDate', width: 170),
              _column('Owner', 'owner', width: 150),
              _column('Category', 'category', width: 150),
              _column('Service', 'service', width: 150),
              _column('Expandable', 'expandable', width: 150),
              _column('Fixed', 'isFixedLabel', width: 110),
              _column('Quantitative', 'isQuantitativeLabel', width: 150),
              _column('Description', 'description', width: 220),
              _column('MRAH', 'mrah', width: 150),
              _column('Comments', 'comments', width: 220),
              _column('Replaced off', 'replacedOff', width: 180),
              _column('Replaced by', 'replacedBy', width: 180),
              _column('Purchase date', 'purchaseDate', width: 190),
              _column('Written off', 'writtenOffDate', width: 190),
              _column('Created', 'createdAt', width: 180),
              _column('Updated', 'updatedAt', width: 180),
              _column('M2 inside', 'm2Inside', width: 120, searchable: false),
              _column(
                'Lifecycle year',
                'yearOfLifeCycle',
                width: 150,
                searchable: false,
              ),
              _column(
                'Lifecycle rest',
                'restOfLifeCycle',
                width: 150,
                searchable: false,
              ),
              _column('Rest value', 'restValue', width: 130, searchable: false),
              _column(
                'Purchase price',
                'purchasePrice',
                width: 150,
                searchable: false,
              ),
              _column('Quantity', 'quantity', width: 120, searchable: false),
              const DataColumn(
                label: SizedBox(width: 120, child: Text('Actions')),
              ),
            ],
            rows: rows.map(_row).toList(),
          ),
        ),
        if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: EmptyState(message: 'No assets found.'),
          ),
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

  DataRow _row(Asset asset) {
    return DataRow(
      cells: [
        DataCell(_cellText(asset.code, 150)),
        DataCell(_cellText(asset.rfidCode.isEmpty ? '-' : asset.rfidCode, 160)),
        DataCell(_cellText(asset.name, 190)),
        DataCell(_cellText(asset.typeName, 160)),
        DataCell(_cellText(asset.location, 220)),
        DataCell(
          SizedBox(
            width: 130,
            child: StatusChip(status: asset.status, label: asset.status),
          ),
        ),
        DataCell(
          SizedBox(
            width: 150,
            child: StatusChip(
              status: asset.inventoryStatus,
              label: asset.inventoryStatusLabel,
            ),
          ),
        ),
        DataCell(_cellText(asset.lastInventoryDate ?? '-', 170)),
        DataCell(_cellText(asset.owner ?? '-', 150)),
        DataCell(_cellText(asset.category ?? '-', 150)),
        DataCell(_cellText(asset.service ?? '-', 150)),
        DataCell(_cellText(asset.expandable ?? '-', 150)),
        DataCell(
          _cellText(asset.isFixedLabel ?? (asset.isFixed ? 'Yes' : 'No'), 110),
        ),
        DataCell(
          _cellText(
            asset.isQuantitativeLabel ?? (asset.isQuantitative ? 'Yes' : 'No'),
            150,
          ),
        ),
        DataCell(_cellText(asset.description ?? '-', 220)),
        DataCell(_cellText(asset.mrah ?? '-', 150)),
        DataCell(_cellText(asset.comments ?? '-', 220)),
        DataCell(_cellText(asset.replacedOff ?? '-', 180)),
        DataCell(_cellText(asset.replacedBy ?? '-', 180)),
        DataCell(_cellText(asset.purchaseDate ?? '-', 190)),
        DataCell(_cellText(asset.writtenOffDate ?? '-', 190)),
        DataCell(_cellText(asset.createdAt ?? '-', 180)),
        DataCell(_cellText(asset.updatedAt ?? '-', 180)),
        DataCell(_cellText(asset.m2Inside ?? '-', 120)),
        DataCell(_cellText(asset.yearOfLifeCycle ?? '-', 150)),
        DataCell(_cellText(asset.restOfLifeCycle ?? '-', 150)),
        DataCell(_cellText(asset.restValue ?? '-', 130)),
        DataCell(_cellText(asset.purchasePrice ?? '-', 150)),
        DataCell(_cellText(asset.quantity, 120)),
        DataCell(
          SizedBox(
            width: 120,
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Edit asset',
                  onPressed: canEdit ? () => onEdit(asset) : null,
                  icon: const Icon(Icons.edit_outlined),
                ),
                IconButton(
                  tooltip: 'Delete asset',
                  onPressed: canDelete ? () => onDelete(asset) : null,
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _NotFoundAssetsTable extends StatelessWidget {
  const _NotFoundAssetsTable({
    required this.rows,
    required this.filters,
    required this.sortColumn,
    required this.sortDirection,
    required this.onFilterChanged,
    required this.onSort,
    required this.emptyMessage,
  });

  final List<Asset> rows;
  final Map<String, String> filters;
  final String? sortColumn;
  final String sortDirection;
  final void Function(String column, String value) onFilterChanged;
  final Future<void> Function(String column) onSort;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _DataTableViewport(
          child: DataTable(
            headingRowHeight: 92,
            dataRowMinHeight: 58,
            dataRowMaxHeight: 72,
            columnSpacing: 18,
            horizontalMargin: 12,
            columns: [
              _column('Code', 'code', width: 150),
              _column('RFID code', 'rfidCode', width: 160),
              _column('Name', 'name', width: 220),
              _column('Type', 'typeName', width: 170),
              _column('Room', 'room', width: 220),
            ],
            rows: rows.map(_row).toList(),
          ),
        ),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: EmptyState(message: emptyMessage),
          ),
      ],
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
        searchable: true,
      ),
    );
  }

  DataRow _row(Asset asset) {
    return DataRow(
      cells: [
        DataCell(_cellText(asset.code, 150)),
        DataCell(_cellText(asset.rfidCode.isEmpty ? '-' : asset.rfidCode, 160)),
        DataCell(_cellText(asset.name, 220)),
        DataCell(_cellText(asset.typeName, 170)),
        DataCell(_cellText(asset.locationRoomName ?? asset.location, 220)),
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

class _AssetEditorDialog extends StatefulWidget {
  const _AssetEditorDialog({
    required this.lookups,
    this.asset,
    this.lookupsStream,
    this.initialRfidCode,
    this.initialRoom,
    this.initialInventoryStatus,
    this.roomInventoryMode = false,
    required this.canSubmit,
    required this.permissionUpdates,
  });

  final AssetLookupData lookups;
  final Stream<AssetLookupData>? lookupsStream;
  final Asset? asset;
  final String? initialRfidCode;
  final AssetRoom? initialRoom;
  final String? initialInventoryStatus;
  final bool roomInventoryMode;
  final bool canSubmit;
  final Stream<InventoryAppPermissions> permissionUpdates;

  @override
  State<_AssetEditorDialog> createState() => _AssetEditorDialogState();
}

class _AssetEditorDialogState extends State<_AssetEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  static const _emptyAssetFieldValues = {
    'No code',
    'No RFID',
    'No information',
    'Not recorded',
  };
  static const _defaultOwner = 'Global RTS';
  static const _defaultService = 'Billeting';
  static const _defaultMrah = 'Global RTS';

  static String _editableText(
    Asset? asset,
    String? value, {
    String createDefault = '',
  }) {
    if (asset == null) return createDefault;
    final text = (value ?? '').trim();
    return text.isEmpty || _emptyAssetFieldValues.contains(text) ? '' : text;
  }

  late final _code = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.code),
  );
  late final _rfid = TextEditingController(
    text: _editableText(
      widget.asset,
      widget.asset?.rfidCode,
      createDefault: widget.initialRfidCode ?? '',
    ),
  );
  late final _name = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.name),
  );
  late final _quantity = TextEditingController(
    text: _editableText(
      widget.asset,
      widget.asset?.quantity,
      createDefault: '1',
    ),
  );
  late final _owner = TextEditingController(
    text: _editableText(
      widget.asset,
      widget.asset?.owner,
      createDefault: _defaultOwner,
    ),
  );
  late final _category = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.category),
  );
  late final _service = TextEditingController(
    text: _editableText(
      widget.asset,
      widget.asset?.service,
      createDefault: _defaultService,
    ),
  );
  late final _description = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.description),
  );
  late final _mrah = TextEditingController(
    text: _editableText(
      widget.asset,
      widget.asset?.mrah,
      createDefault: _defaultMrah,
    ),
  );
  late final _m2Inside = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.m2Inside),
  );
  late final _purchaseDate = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.purchaseDate),
  );
  late final _purchasePrice = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.purchasePrice),
  );
  late final _comments = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.comments),
  );
  late final _yearOfLifeCycle = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.yearOfLifeCycle),
  );
  late final _restOfLifeCycle = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.restOfLifeCycle),
  );
  late final _restValue = TextEditingController(
    text: _editableText(widget.asset, widget.asset?.restValue),
  );
  late AssetLookupData _lookups = widget.lookups;
  late AssetType? _type = _initialType();
  late AssetRoom? _room = _initialRoom();
  late AssetKey? _key = _initialKey();
  late AssetLookupAsset? _replacedOffAsset = _initialReplacement(
    widget.asset?.replacedOff,
  );
  late AssetLookupAsset? _replacedByAsset = _initialReplacement(
    widget.asset?.replacedBy,
  );
  late String _status = widget.asset?.status ?? 'Good';
  late String _inventoryStatus = _initialInventoryStatus();
  late String _expandable = widget.asset?.expandable ?? 'Non Expandable';
  late bool _isFixed = widget.asset?.isFixed ?? false;
  late bool _isQuantitative = widget.asset?.isQuantitative ?? false;
  StreamSubscription<String>? _rfidSubscription;
  StreamSubscription<AssetLookupData>? _lookupsSubscription;
  StreamSubscription<InventoryAppPermissions>? _permissionSubscription;
  bool _acceptingRfidScans = true;
  String _scanMessage = '';
  late bool _canSubmit = widget.canSubmit;

  static const _assetStatuses = [
    'Excellent',
    'Good',
    'Fair',
    'Poor',
    'Unacceptable',
  ];
  static const _expandableOptions = ['Non Expandable', 'Expandable'];
  static const _inventoryStatuses = [
    'undiscovered',
    'completed',
    'written_off',
  ];

  bool get _editing => widget.asset != null;
  bool get _canCreateQuantitative => !_editing && !widget.roomInventoryMode;
  bool get _canEditQuantity => _canSubmit && _isQuantitative;
  bool get _canEditRfid => _canSubmit && !_isQuantitative;

  String _initialInventoryStatus() {
    final status =
        widget.initialInventoryStatus ??
        widget.asset?.inventoryStatus ??
        'undiscovered';
    return _inventoryStatuses.contains(status) ? status : 'undiscovered';
  }

  @override
  void initState() {
    super.initState();
    if (_selectedTypeIsBed && _isQuantitative) {
      _isQuantitative = false;
      _quantity.text = '1';
    }
    if (widget.roomInventoryMode && _isQuantitative) {
      _isQuantitative = false;
      _quantity.text = '1';
    }
    if (!_isQuantitative) {
      _quantity.text = '1';
    }
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
    _lookupsSubscription = widget.lookupsStream?.listen(_applyLookups);
    _bindPermissionUpdates();
  }

  @override
  void didUpdateWidget(covariant _AssetEditorDialog oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.canSubmit != oldWidget.canSubmit) {
      _canSubmit = widget.canSubmit;
    }
    if (!identical(widget.permissionUpdates, oldWidget.permissionUpdates)) {
      unawaited(_permissionSubscription?.cancel());
      _bindPermissionUpdates();
    }
  }

  @override
  void dispose() {
    _stopRfidScans();
    unawaited(_lookupsSubscription?.cancel());
    unawaited(_permissionSubscription?.cancel());
    _code.dispose();
    _rfid.dispose();
    _name.dispose();
    _quantity.dispose();
    _owner.dispose();
    _category.dispose();
    _service.dispose();
    _description.dispose();
    _mrah.dispose();
    _m2Inside.dispose();
    _purchaseDate.dispose();
    _purchasePrice.dispose();
    _comments.dispose();
    _yearOfLifeCycle.dispose();
    _restOfLifeCycle.dispose();
    _restValue.dispose();
    super.dispose();
  }

  void _bindPermissionUpdates() {
    _permissionSubscription = widget.permissionUpdates.listen((permissions) {
      final nextCanSubmit = _editing
          ? permissions.canEditAsset
          : permissions.canAddAsset;
      if (mounted) setState(() => _canSubmit = nextCanSubmit);
    });
  }

  AssetType? _initialType() {
    final asset = widget.asset;
    if (asset == null) return null;
    for (final type in _lookups.assetTypes) {
      if (type.id == asset.typeId || type.name == asset.typeName) return type;
    }
    return asset.typeId == null
        ? null
        : AssetType(id: asset.typeId!, name: asset.typeName);
  }

  AssetRoom? _initialRoom() {
    if (widget.initialRoom != null) {
      for (final room in _lookups.rooms) {
        if (room.id == widget.initialRoom!.id) return room;
      }
      return widget.initialRoom;
    }
    final asset = widget.asset;
    if (asset == null) return null;
    for (final room in _lookups.rooms) {
      if (room.id == asset.locationRoomId) return room;
    }
    return asset.locationRoomId == null
        ? null
        : AssetRoom(
            id: asset.locationRoomId!,
            name: asset.locationRoomName ?? asset.location,
          );
  }

  AssetKey? _initialKey() {
    final asset = widget.asset;
    if (asset == null) return null;
    if (widget.initialRoom != null &&
        asset.locationRoomId != widget.initialRoom!.id) {
      return null;
    }
    if (asset.typeName.trim().toLowerCase() != 'bed') return null;
    for (final key in _lookups.keys) {
      if (key.id == asset.locationKeyId) return key;
    }
    return asset.locationKeyId == null
        ? null
        : AssetKey(id: asset.locationKeyId!, name: asset.locationKeyName ?? '');
  }

  AssetLookupAsset? _initialReplacement(String? value) {
    final rawText = (value ?? '').trim();
    if (rawText.isEmpty || _emptyAssetFieldValues.contains(rawText)) {
      return null;
    }
    final text = rawText.toLowerCase();
    for (final asset in _lookups.assets) {
      if (asset.id.toLowerCase() == text ||
          (asset.code ?? '').toLowerCase() == text ||
          (asset.name ?? '').toLowerCase() == text ||
          asset.label.toLowerCase() == text) {
        return asset;
      }
    }
    return AssetLookupAsset(id: text, label: rawText);
  }

  bool get _selectedTypeIsBed => _isBedType(_type);

  bool _isBedType(AssetType? type) {
    return (type?.name ?? '').trim().toLowerCase() == 'bed';
  }

  List<AssetLookupAsset> get _replacementOptions {
    final currentId = widget.asset?.id;
    return _lookups.assets
        .where((asset) => currentId == null || asset.id != currentId)
        .toList();
  }

  void _applyLookups(AssetLookupData lookups) {
    if (!mounted) return;
    setState(() {
      _lookups = lookups;
      _type = _resolveType(_type);
      _room = _resolveRoom(_room);
      _key = _resolveKey(_key);
      _replacedOffAsset = _resolveReplacement(_replacedOffAsset);
      _replacedByAsset = _resolveReplacement(_replacedByAsset);
      if (!_selectedTypeIsBed ||
          (_room != null &&
              _key?.roomId != null &&
              _key!.roomId != _room!.id)) {
        _key = null;
      }
    });
  }

  AssetType? _resolveType(AssetType? type) {
    if (type == null) return null;
    for (final candidate in _lookups.assetTypes) {
      if (candidate.id == type.id) return candidate;
    }
    return null;
  }

  AssetRoom? _resolveRoom(AssetRoom? room) {
    if (room == null) return null;
    for (final candidate in _lookups.rooms) {
      if (candidate.id == room.id) return candidate;
    }
    return null;
  }

  AssetKey? _resolveKey(AssetKey? key) {
    if (key == null) return null;
    for (final candidate in _lookups.keys) {
      if (candidate.id == key.id) return candidate;
    }
    return null;
  }

  AssetLookupAsset? _resolveReplacement(AssetLookupAsset? asset) {
    if (asset == null) return null;
    for (final candidate in _replacementOptions) {
      if (candidate.id == asset.id) return candidate;
    }
    return null;
  }

  Stream<List<AssetType>>? get _assetTypeOptionsStream =>
      widget.lookupsStream?.map((lookups) => lookups.assetTypes);

  Stream<List<AssetRoom>>? get _roomOptionsStream =>
      widget.lookupsStream?.map((lookups) => lookups.rooms);

  Stream<List<AssetKey>>? get _keyOptionsStream => widget.lookupsStream?.map(
    (lookups) => lookups.keys
        .where((key) => _room == null || key.roomId == _room!.id)
        .toList(),
  );

  Stream<List<AssetLookupAsset>>? get _replacementOptionsStream =>
      widget.lookupsStream?.map((lookups) {
        final currentId = widget.asset?.id;
        return lookups.assets
            .where((asset) => currentId == null || asset.id != currentId)
            .toList();
      });

  void _selectType(AssetType type) {
    setState(() {
      _type = type;
      if (!_isBedType(type)) _key = null;
      if (_isBedType(type) && _isQuantitative) {
        _isQuantitative = false;
        _quantity.text = '1';
      }
    });
  }

  void _toggleQuantitative(bool value) {
    if (!_canSubmit) return;
    if (value && widget.roomInventoryMode) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Quantitative assets cannot be created from room inventory.',
          ),
        ),
      );
      return;
    }
    if (value && _selectedTypeIsBed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Quantitative assets cannot use the Bed asset type.'),
        ),
      );
      return;
    }
    setState(() {
      _isQuantitative = value;
      if (value) {
        _rfid.clear();
        _scanMessage = 'RFID code will be generated on save.';
      } else {
        _quantity.text = '1';
        _scanMessage = '';
      }
    });
  }

  Future<void> _ignoreNative(Future<void> future) async {
    try {
      await future;
    } catch (_) {}
  }

  void _handleRfidScan(String rfidCode) {
    if (!mounted || !_acceptingRfidScans) return;
    if (!_canEditRfid) return;
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

  @override
  Widget build(BuildContext context) {
    final formEnabled = _canSubmit;
    return AlertDialog(
      title: Text(_editing ? 'Edit asset' : 'Add asset'),
      content: Form(
        key: _formKey,
        child: SizedBox(
          width: 520,
          child: AbsorbPointer(
            absorbing: !formEnabled,
            child: Opacity(
              opacity: formEnabled ? 1 : 0.55,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: _code,
                      decoration: const InputDecoration(
                        labelText: 'Code',
                        prefixIcon: Icon(Icons.tag_outlined),
                      ),
                      validator: _required,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _rfid,
                      enabled: _canEditRfid,
                      decoration: InputDecoration(
                        labelText: 'RFID code',
                        hintText: _isQuantitative ? 'Generated on save' : null,
                        prefixIcon: const Icon(Icons.sensors_outlined),
                      ),
                      validator: _isQuantitative ? null : _required,
                    ),
                    if (_scanMessage.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(_scanMessage),
                      ),
                    ],
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _name,
                      decoration: const InputDecoration(
                        labelText: 'Name',
                        prefixIcon: Icon(Icons.inventory_2_outlined),
                      ),
                      validator: _required,
                    ),
                    const SizedBox(height: 10),
                    SearchSelectionField<AssetType>(
                      labelText: 'Type',
                      leadingIcon: Icons.category_outlined,
                      options: _lookups.assetTypes,
                      optionsStream: _assetTypeOptionsStream,
                      selectedValue: _type,
                      itemLabel: (type) => type.name,
                      onChanged: _selectType,
                      emptyMessage: 'No asset types found.',
                      validator: (_) => _type == null ? 'Required.' : null,
                    ),
                    const SizedBox(height: 10),
                    SearchSelectionField<AssetRoom>(
                      labelText: 'Room',
                      leadingIcon: Icons.meeting_room_outlined,
                      options: _lookups.rooms,
                      optionsStream: _roomOptionsStream,
                      selectedValue: _room,
                      itemLabel: (room) => room.label,
                      itemSubtitle: (room) => room.meta,
                      onChanged: (room) => setState(() {
                        _room = room;
                        if (_key?.roomId != null && _key!.roomId != room.id) {
                          _key = null;
                        }
                      }),
                      emptyMessage: 'No rooms found.',
                      validator: (_) => _room == null ? 'Required.' : null,
                    ),
                    const SizedBox(height: 10),
                    Opacity(
                      opacity: _selectedTypeIsBed ? 1 : 0.55,
                      child: IgnorePointer(
                        ignoring: !_selectedTypeIsBed,
                        child: SearchSelectionField<AssetKey>(
                          labelText: 'Key',
                          leadingIcon: Icons.key_outlined,
                          options: _lookups.keys
                              .where(
                                (key) =>
                                    _room == null || key.roomId == _room!.id,
                              )
                              .toList(),
                          optionsStream: _keyOptionsStream,
                          selectedValue: _selectedTypeIsBed ? _key : null,
                          itemLabel: (key) => key.name,
                          itemSubtitle: (key) => key.meta,
                          onChanged: (key) => setState(() => _key = key),
                          emptyMessage: 'No keys found.',
                        ),
                      ),
                    ),
                    if (_selectedTypeIsBed && _key != null)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: () => setState(() => _key = null),
                          icon: const Icon(Icons.clear),
                          label: const Text('Clear key'),
                        ),
                      ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _quantity,
                      readOnly: !_canEditQuantity,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Quantity',
                        prefixIcon: Icon(Icons.numbers_outlined),
                      ),
                      validator: _positiveNumber,
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: _status,
                      decoration: const InputDecoration(
                        labelText: 'Asset status',
                        prefixIcon: Icon(Icons.fact_check_outlined),
                      ),
                      items: _assetStatuses
                          .map(
                            (status) => DropdownMenuItem(
                              value: status,
                              child: Text(status),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _status = value ?? _status),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: _inventoryStatus,
                      decoration: const InputDecoration(
                        labelText: 'Inventory status',
                        prefixIcon: Icon(Icons.checklist_outlined),
                      ),
                      items: _inventoryStatuses
                          .map(
                            (status) => DropdownMenuItem(
                              value: status,
                              child: Text(labelForInventoryStatus(status)),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(
                        () => _inventoryStatus = value ?? _inventoryStatus,
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _owner,
                      decoration: const InputDecoration(
                        labelText: 'Owner',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _category,
                      decoration: const InputDecoration(
                        labelText: 'Category',
                        prefixIcon: Icon(Icons.segment_outlined),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _service,
                      decoration: const InputDecoration(
                        labelText: 'Service',
                        prefixIcon: Icon(Icons.room_service_outlined),
                      ),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: _expandable,
                      decoration: const InputDecoration(
                        labelText: 'Expandable',
                        prefixIcon: Icon(Icons.open_in_full_outlined),
                      ),
                      items: _expandableOptions
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _expandable = value ?? _expandable),
                    ),
                    const SizedBox(height: 10),
                    SwitchListTile(
                      value: _isFixed,
                      onChanged: (value) => setState(() => _isFixed = value),
                      secondary: const Icon(Icons.push_pin_outlined),
                      title: const Text('Fixed asset'),
                    ),
                    if (_canCreateQuantitative)
                      SwitchListTile(
                        value: _isQuantitative,
                        onChanged: _toggleQuantitative,
                        secondary: const Icon(Icons.numbers_outlined),
                        title: const Text('Quantitative asset'),
                      ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _description,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                        prefixIcon: Icon(Icons.description_outlined),
                      ),
                      minLines: 2,
                      maxLines: 3,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _mrah,
                      decoration: const InputDecoration(
                        labelText: 'MRAH',
                        prefixIcon: Icon(Icons.business_outlined),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _m2Inside,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'M2 inside',
                        prefixIcon: Icon(Icons.square_foot_outlined),
                      ),
                      validator: _optionalNonNegativeNumber,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _purchaseDate,
                      readOnly: true,
                      decoration: InputDecoration(
                        labelText: 'Purchase date',
                        prefixIcon: const Icon(Icons.calendar_today_outlined),
                        suffixIcon: _purchaseDate.text.trim().isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear date',
                                icon: const Icon(Icons.clear),
                                onPressed: () =>
                                    setState(() => _purchaseDate.clear()),
                              ),
                      ),
                      onTap: () => unawaited(_pickDateTime(_purchaseDate)),
                      validator: _optionalDateTime,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _purchasePrice,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Purchase price',
                        prefixIcon: Icon(Icons.payments_outlined),
                      ),
                      validator: _optionalNonNegativeNumber,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _comments,
                      decoration: const InputDecoration(
                        labelText: 'Comments',
                        prefixIcon: Icon(Icons.notes_outlined),
                      ),
                      minLines: 2,
                      maxLines: 3,
                    ),
                    const SizedBox(height: 10),
                    SearchSelectionField<AssetLookupAsset>(
                      labelText: 'Replaced off',
                      leadingIcon: Icons.swap_horiz_outlined,
                      options: _replacementOptions,
                      optionsStream: _replacementOptionsStream,
                      selectedValue: _replacedOffAsset,
                      itemLabel: (asset) => asset.label,
                      itemSubtitle: (asset) => asset.meta,
                      onChanged: (asset) =>
                          setState(() => _replacedOffAsset = asset),
                      emptyMessage: 'No assets found.',
                    ),
                    if (_replacedOffAsset != null)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: () =>
                              setState(() => _replacedOffAsset = null),
                          icon: const Icon(Icons.clear),
                          label: const Text('Clear replaced off'),
                        ),
                      ),
                    const SizedBox(height: 10),
                    SearchSelectionField<AssetLookupAsset>(
                      labelText: 'Replaced by',
                      leadingIcon: Icons.swap_horiz_outlined,
                      options: _replacementOptions,
                      optionsStream: _replacementOptionsStream,
                      selectedValue: _replacedByAsset,
                      itemLabel: (asset) => asset.label,
                      itemSubtitle: (asset) => asset.meta,
                      onChanged: (asset) =>
                          setState(() => _replacedByAsset = asset),
                      emptyMessage: 'No assets found.',
                    ),
                    if (_replacedByAsset != null)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: () =>
                              setState(() => _replacedByAsset = null),
                          icon: const Icon(Icons.clear),
                          label: const Text('Clear replaced by'),
                        ),
                      ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _yearOfLifeCycle,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Lifecycle year',
                        prefixIcon: Icon(Icons.timelapse_outlined),
                      ),
                      validator: _optionalNonNegativeNumber,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _restOfLifeCycle,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Lifecycle rest',
                        prefixIcon: Icon(Icons.timelapse_outlined),
                      ),
                      validator: _optionalNonNegativeNumber,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _restValue,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Rest value',
                        prefixIcon: Icon(Icons.calculate_outlined),
                      ),
                      validator: _optionalNonNegativeNumber,
                    ),
                  ],
                ),
              ),
            ),
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
          onPressed: formEnabled ? _submit : null,
          child: Text(_editing ? 'Save' : 'Create'),
        ),
      ],
    );
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Required.' : null;

  DateTime? _parseDateTimeText(String value) {
    final text = value.trim();
    final match = RegExp(
      r'^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$',
      caseSensitive: false,
    ).firstMatch(text);
    if (match == null) return DateTime.tryParse(text);
    final year = int.parse(match.group(1)!);
    final month = int.parse(match.group(2)!);
    final day = int.parse(match.group(3)!);
    var hour = int.tryParse(match.group(4) ?? '0') ?? 0;
    final minute = int.tryParse(match.group(5) ?? '0') ?? 0;
    final meridiem = (match.group(6) ?? '').toUpperCase();
    if (meridiem == 'PM' && hour < 12) hour += 12;
    if (meridiem == 'AM' && hour == 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return DateTime(year, month, day, hour, minute);
  }

  Future<void> _pickDateTime(TextEditingController controller) async {
    if (!_canSubmit) return;
    final current = _parseDateTimeText(controller.text);
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: DateTime(1900),
      lastDate: DateTime(now.year + 100),
    );
    if (selected == null || !mounted) return;
    final selectedTime = await showTimePicker(
      context: context,
      initialTime: current == null
          ? TimeOfDay.fromDateTime(now)
          : TimeOfDay.fromDateTime(current),
    );
    if (selectedTime == null || !mounted) return;
    final selectedDateTime = DateTime(
      selected.year,
      selected.month,
      selected.day,
      selectedTime.hour,
      selectedTime.minute,
    );
    setState(() => controller.text = formatDateTime(selectedDateTime));
  }

  String? _positiveNumber(String? value) {
    final parsed = double.tryParse((value ?? '').replaceAll(',', '.'));
    if (parsed == null || parsed <= 0) return 'Enter a positive number.';
    return null;
  }

  String? _optionalNonNegativeNumber(String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) return null;
    final parsed = double.tryParse(text.replaceAll(',', '.'));
    if (parsed == null || parsed < 0) return 'Enter a non-negative number.';
    return null;
  }

  String? _optionalDateTime(String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) return null;
    if (_parseDateTimeText(text) == null) {
      return 'Enter a valid date and time.';
    }
    return null;
  }

  void _submit() {
    if (!_canSubmit) return;
    if (!_formKey.currentState!.validate()) return;
    final type = _type;
    final room = _room;
    if (type == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Choose a type.')));
      return;
    }
    if (room == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Choose a room.')));
      return;
    }
    if (_key != null && !_selectedTypeIsBed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Keys can only be assigned to assets of type Bed.'),
        ),
      );
      return;
    }
    if (_isQuantitative && _selectedTypeIsBed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Quantitative assets cannot use the Bed asset type.'),
        ),
      );
      return;
    }
    if (widget.roomInventoryMode && _isQuantitative) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Quantitative assets cannot be created from room inventory.',
          ),
        ),
      );
      return;
    }
    _stopRfidScans();
    Navigator.pop(
      context,
      _AssetFormResult(
        code: _code.text.trim(),
        rfidCode: _isQuantitative ? '' : _rfid.text.trim(),
        name: _name.text.trim(),
        typeId: type.id,
        locationRoomId: room.id,
        locationKeyId: _key?.id ?? '',
        quantity: _isQuantitative
            ? _quantity.text.trim().replaceAll(',', '.')
            : '1',
        status: _status,
        inventoryStatus: _inventoryStatus,
        owner: _owner.text.trim(),
        category: _category.text.trim(),
        service: _service.text.trim(),
        expandable: _expandable,
        description: _description.text.trim(),
        mrah: _mrah.text.trim(),
        m2Inside: _m2Inside.text.trim().replaceAll(',', '.'),
        purchaseDate: _purchaseDate.text.trim(),
        purchasePrice: _purchasePrice.text.trim().replaceAll(',', '.'),
        comments: _comments.text.trim(),
        replacedOff: _replacedOffAsset?.label ?? '',
        replacedBy: _replacedByAsset?.label ?? '',
        yearOfLifeCycle: _yearOfLifeCycle.text.trim().replaceAll(',', '.'),
        restOfLifeCycle: _restOfLifeCycle.text.trim().replaceAll(',', '.'),
        restValue: _restValue.text.trim().replaceAll(',', '.'),
        isFixed: _isFixed,
        isQuantitative: _isQuantitative,
      ),
    );
  }
}

class _AssetFormResult {
  const _AssetFormResult({
    required this.code,
    required this.rfidCode,
    required this.name,
    required this.typeId,
    required this.locationRoomId,
    required this.locationKeyId,
    required this.quantity,
    required this.status,
    required this.inventoryStatus,
    required this.owner,
    required this.category,
    required this.service,
    required this.expandable,
    required this.description,
    required this.mrah,
    required this.m2Inside,
    required this.purchaseDate,
    required this.purchasePrice,
    required this.comments,
    required this.replacedOff,
    required this.replacedBy,
    required this.yearOfLifeCycle,
    required this.restOfLifeCycle,
    required this.restValue,
    required this.isFixed,
    required this.isQuantitative,
  });

  final String code;
  final String rfidCode;
  final String name;
  final String typeId;
  final String locationRoomId;
  final String locationKeyId;
  final String quantity;
  final String status;
  final String inventoryStatus;
  final String owner;
  final String category;
  final String service;
  final String expandable;
  final String description;
  final String mrah;
  final String m2Inside;
  final String purchaseDate;
  final String purchasePrice;
  final String comments;
  final String replacedOff;
  final String replacedBy;
  final String yearOfLifeCycle;
  final String restOfLifeCycle;
  final String restValue;
  final bool isFixed;
  final bool isQuantitative;
}
