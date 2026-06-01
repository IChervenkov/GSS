import '../utils/formatters.dart';
import '../utils/parsing.dart';

class Camp {
  const Camp({required this.id, required this.name});

  final String id;
  final String name;

  factory Camp.fromJson(Map<String, dynamic> json) {
    return Camp(
      id: asString(json['id']),
      name: asString(json['name'], fallback: 'Camp'),
    );
  }
}

class InventoryPermissionNames {
  const InventoryPermissionNames._();

  static const full = 'Full permission';
  static const section = 'Asset management';
  static const legacySection = 'Assets';
  static const addAsset = 'Add asset';
  static const editAsset = 'Edit asset';
  static const deleteAsset = 'Remove asset';
  static const saveInventory = 'Save inventory';
  static const downloadAssetsApp = 'Download assets app';
}

class InventoryAppPermissions {
  const InventoryAppPermissions({this.names = const <String>{}});

  final Set<String> names;

  bool get hasFullPermission => names.contains(InventoryPermissionNames.full);
  bool has(String permissionName) =>
      hasFullPermission || names.contains(permissionName);

  bool get canUse =>
      hasFullPermission ||
      names.contains(InventoryPermissionNames.section) ||
      names.contains(InventoryPermissionNames.legacySection);

  bool get canAddAsset => has(InventoryPermissionNames.addAsset);
  bool get canEditAsset => has(InventoryPermissionNames.editAsset);
  bool get canDeleteAsset => has(InventoryPermissionNames.deleteAsset);
  bool get canSaveInventory => has(InventoryPermissionNames.saveInventory);
  bool get canDownloadAssetsApp =>
      has(InventoryPermissionNames.downloadAssetsApp);

  factory InventoryAppPermissions.fromJson(Map<String, dynamic> json) {
    return InventoryAppPermissions(
      names: asList(json['permissions'])
          .map((item) => asString(item['name']))
          .where((name) => name.isNotEmpty)
          .toSet(),
    );
  }
}

class TablePageMeta {
  const TablePageMeta({
    this.page = 1,
    this.limit = 10,
    this.total = 0,
    this.totalPages = 1,
    this.sourceTotal = 0,
    this.sortColumn,
    this.sortDirection = 'default',
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final int sourceTotal;
  final String? sortColumn;
  final String sortDirection;

  factory TablePageMeta.fromJson(Map<String, dynamic> json) {
    return TablePageMeta(
      page: asInt(json['page'], fallback: 1),
      limit: asInt(json['limit'], fallback: 10),
      total: asInt(json['total']),
      totalPages: asInt(json['totalPages'], fallback: 1),
      sourceTotal: asInt(json['sourceTotal'], fallback: asInt(json['total'])),
      sortColumn: asStringOrNull(json['sortColumn']),
      sortDirection: asString(json['sortDirection'], fallback: 'default'),
    );
  }
}

class AssetType {
  const AssetType({required this.id, required this.name});

  final String id;
  final String name;

  factory AssetType.fromJson(Map<String, dynamic> json) => AssetType(
    id: asString(json['id']),
    name: asString(json['name'], fallback: 'Asset type'),
  );
}

class AssetRoom {
  const AssetRoom({
    required this.id,
    required this.name,
    this.buildingName,
    this.meta,
  });

  final String id;
  final String name;
  final String? buildingName;
  final String? meta;

  String get label => buildingName == null || buildingName!.isEmpty
      ? name
      : '$buildingName / $name';

  factory AssetRoom.fromJson(Map<String, dynamic> json) => AssetRoom(
    id: asString(json['id']),
    name: asString(json['name'] ?? json['label'], fallback: 'Room'),
    buildingName: asStringOrNull(json['buildingName']),
    meta: asStringOrNull(json['meta']),
  );
}

class AssetKey {
  const AssetKey({
    required this.id,
    required this.name,
    this.roomId,
    this.meta,
  });

  final String id;
  final String name;
  final String? roomId;
  final String? meta;

  factory AssetKey.fromJson(Map<String, dynamic> json) => AssetKey(
    id: asString(json['id']),
    name: asString(json['name'] ?? json['label'], fallback: 'Key'),
    roomId: asStringOrNull(json['roomId']),
    meta: asStringOrNull(json['meta']),
  );
}

class AssetLookupData {
  const AssetLookupData({
    this.assetTypes = const [],
    this.rooms = const [],
    this.keys = const [],
    this.assets = const [],
  });

  final List<AssetType> assetTypes;
  final List<AssetRoom> rooms;
  final List<AssetKey> keys;
  final List<AssetLookupAsset> assets;

  factory AssetLookupData.fromJson(Map<String, dynamic> json) {
    return AssetLookupData(
      assetTypes: asList(json['assetTypes']).map(AssetType.fromJson).toList(),
      rooms: asList(json['rooms']).map(AssetRoom.fromJson).toList(),
      keys: asList(json['keys']).map(AssetKey.fromJson).toList(),
      assets: asList(json['assets']).map(AssetLookupAsset.fromJson).toList(),
    );
  }
}

class AssetLookupAsset {
  const AssetLookupAsset({
    required this.id,
    required this.label,
    this.code,
    this.name,
    this.meta,
  });

  final String id;
  final String label;
  final String? code;
  final String? name;
  final String? meta;

  factory AssetLookupAsset.fromJson(Map<String, dynamic> json) {
    final id = asString(json['id']);
    final code = asStringOrNull(json['code']);
    final name = asStringOrNull(json['name']);
    final fallbackLabel = [code, name].whereType<String>().join(' - ');
    return AssetLookupAsset(
      id: id,
      code: code,
      name: name,
      label: asString(
        json['label'],
        fallback: fallbackLabel.trim().isEmpty ? id : fallbackLabel,
      ),
      meta: asStringOrNull(json['meta']),
    );
  }
}

class Asset {
  const Asset({
    required this.id,
    required this.code,
    required this.rfidCode,
    required this.name,
    required this.typeName,
    required this.location,
    required this.quantity,
    required this.status,
    required this.inventoryStatus,
    required this.inventoryStatusLabel,
    this.quantityNumber = 0,
    this.typeId,
    this.locationRoomId,
    this.locationRoomName,
    this.locationKeyId,
    this.locationKeyName,
    this.owner,
    this.category,
    this.service,
    this.description,
    this.mrah,
    this.m2Inside,
    this.expandable,
    this.isFixedLabel,
    this.isQuantitativeLabel,
    this.comments,
    this.replacedOff,
    this.replacedBy,
    this.yearOfLifeCycle,
    this.restOfLifeCycle,
    this.restValue,
    this.purchasePrice,
    this.writtenOffDate,
    this.lastInventoryDate,
    this.purchaseDate,
    this.createdAt,
    this.updatedAt,
    this.isFixed = false,
    this.isQuantitative = false,
  });

  final String id;
  final String code;
  final String rfidCode;
  final String name;
  final String typeName;
  final String location;
  final String quantity;
  final double quantityNumber;
  final String status;
  final String inventoryStatus;
  final String inventoryStatusLabel;
  final String? typeId;
  final String? locationRoomId;
  final String? locationRoomName;
  final String? locationKeyId;
  final String? locationKeyName;
  final String? owner;
  final String? category;
  final String? service;
  final String? description;
  final String? mrah;
  final String? m2Inside;
  final String? expandable;
  final String? isFixedLabel;
  final String? isQuantitativeLabel;
  final String? comments;
  final String? replacedOff;
  final String? replacedBy;
  final String? yearOfLifeCycle;
  final String? restOfLifeCycle;
  final String? restValue;
  final String? purchasePrice;
  final String? writtenOffDate;
  final String? lastInventoryDate;
  final String? purchaseDate;
  final String? createdAt;
  final String? updatedAt;
  final bool isFixed;
  final bool isQuantitative;

  bool get isFound => inventoryStatus == 'completed';
  bool get isMissing =>
      inventoryStatus == 'undiscovered' || inventoryStatus == 'written_off';

  factory Asset.fromJson(Map<String, dynamic> json) {
    final inventoryStatus = asString(
      json['inventoryStatus'],
      fallback: 'undiscovered',
    );
    final quantity = asString(json['quantity'], fallback: '1');
    final location = asString(
      json['location'],
      fallback: [
        asString(json['buildingName']),
        asString(json['locationRoomName']),
        asString(json['locationKeyName']),
      ].where((part) => part.isNotEmpty).join(' / '),
    );
    return Asset(
      id: asString(json['id']),
      code: asString(json['code'], fallback: 'No code'),
      rfidCode: asString(json['rfidCode']),
      name: asString(json['name'], fallback: 'No information'),
      typeName: asString(json['typeName'], fallback: 'Unassigned type'),
      location: location.isEmpty ? 'Unassigned' : location,
      quantity: quantity,
      quantityNumber: asDouble(
        json['quantityNumber'],
        fallback: asDouble(quantity),
      ),
      status: asString(json['status'], fallback: 'Good'),
      inventoryStatus: inventoryStatus,
      inventoryStatusLabel: asString(
        json['inventoryStatusLabel'],
        fallback: labelForInventoryStatus(inventoryStatus),
      ),
      typeId: asStringOrNull(json['typeId']),
      locationRoomId: asStringOrNull(json['locationRoomId']),
      locationRoomName: asStringOrNull(json['locationRoomName']),
      locationKeyId: asStringOrNull(json['locationKeyId']),
      locationKeyName: asStringOrNull(json['locationKeyName']),
      owner: asStringOrNull(json['owner']),
      category: asStringOrNull(json['category']),
      service: asStringOrNull(json['service']),
      description: asStringOrNull(json['description']),
      mrah: asStringOrNull(json['mrah']),
      m2Inside: asStringOrNull(json['m2Inside']),
      expandable: asStringOrNull(json['expandable']),
      isFixedLabel: asStringOrNull(json['isFixedLabel']),
      isQuantitativeLabel: asStringOrNull(json['isQuantitativeLabel']),
      comments: asStringOrNull(json['comments']),
      replacedOff: asStringOrNull(json['replacedOff']),
      replacedBy: asStringOrNull(json['replacedBy']),
      yearOfLifeCycle: asStringOrNull(json['yearOfLifeCycle']),
      restOfLifeCycle: asStringOrNull(json['restOfLifeCycle']),
      restValue: asStringOrNull(json['restValue']),
      purchasePrice: asStringOrNull(json['purchasePrice']),
      writtenOffDate: asStringOrNull(json['writtenOffDate']),
      lastInventoryDate: asStringOrNull(json['lastInventoryDate']),
      purchaseDate: asStringOrNull(json['purchaseDate']),
      createdAt: asStringOrNull(json['createdAt']),
      updatedAt: asStringOrNull(json['updatedAt']),
      isFixed: json['isFixed'] == true,
      isQuantitative: json['isQuantitative'] == true,
    );
  }
}

class InventoryStatusSummary {
  const InventoryStatusSummary({
    required this.status,
    required this.label,
    this.assetCount = 0,
    this.quantity = '0',
    this.lastInventoryDate,
  });

  final String status;
  final String label;
  final int assetCount;
  final String quantity;
  final String? lastInventoryDate;

  factory InventoryStatusSummary.fromJson(Map<String, dynamic> json) {
    final status = asString(json['status'], fallback: 'undiscovered');
    return InventoryStatusSummary(
      status: status,
      label: asString(json['label'], fallback: labelForInventoryStatus(status)),
      assetCount: asInt(json['assetCount']),
      quantity: asString(json['quantity'], fallback: '0'),
      lastInventoryDate: asStringOrNull(json['lastInventoryDate']),
    );
  }
}

class AssetsOverview {
  const AssetsOverview({
    this.totalAssets = 0,
    this.totalQuantity = '0',
    this.notFoundAssets = 0,
    this.completedAssets = 0,
    this.typeCount = 0,
    this.allAssets = const [],
    this.notFoundRows = const [],
    this.inventoryStatusRows = const [],
    this.lookups = const AssetLookupData(),
    this.tables = const {},
  });

  final int totalAssets;
  final String totalQuantity;
  final int notFoundAssets;
  final int completedAssets;
  final int typeCount;
  final List<Asset> allAssets;
  final List<Asset> notFoundRows;
  final List<InventoryStatusSummary> inventoryStatusRows;
  final AssetLookupData lookups;
  final Map<String, TablePageMeta> tables;

  factory AssetsOverview.fromJson(Map<String, dynamic> json) {
    final tablesJson = asMap(json['tables']);
    final rows = asList(
      json['allAssets'] ?? json['rows'],
    ).map(Asset.fromJson).toList();
    final statusRows = asList(
      json['inventoryStatusRows'],
    ).map(InventoryStatusSummary.fromJson).toList();
    return AssetsOverview(
      totalAssets: asInt(json['totalAssets'] ?? json['total']),
      totalQuantity: asString(
        json['totalQuantity'],
        fallback: '${rows.length}',
      ),
      notFoundAssets: asInt(json['notFoundAssets']),
      completedAssets: asInt(json['completedAssets']),
      typeCount: asInt(json['typeCount']),
      allAssets: rows,
      notFoundRows: asList(json['notFoundRows']).map(Asset.fromJson).toList(),
      inventoryStatusRows: statusRows.isEmpty
          ? _statusRowsFromAssets(rows)
          : statusRows,
      lookups: AssetLookupData.fromJson(asMap(json['lookups'])),
      tables: {
        for (final entry in tablesJson.entries)
          entry.key: TablePageMeta.fromJson(asMap(entry.value)),
      },
    );
  }

  static List<InventoryStatusSummary> _statusRowsFromAssets(List<Asset> rows) {
    final counts = <String, int>{
      'undiscovered': 0,
      'completed': 0,
      'written_off': 0,
    };
    for (final asset in rows) {
      counts[asset.inventoryStatus] = (counts[asset.inventoryStatus] ?? 0) + 1;
    }
    return counts.entries
        .map(
          (entry) => InventoryStatusSummary(
            status: entry.key,
            label: labelForInventoryStatus(entry.key),
            assetCount: entry.value,
            quantity: '${entry.value}',
          ),
        )
        .toList();
  }
}

class AssetRfidLookupResult {
  const AssetRfidLookupResult({required this.asset});

  final Asset asset;

  factory AssetRfidLookupResult.fromJson(Map<String, dynamic> json) {
    return AssetRfidLookupResult(
      asset: Asset.fromJson(asMap(json['asset'] ?? json['row'])),
    );
  }
}

class AppUpdateInfo {
  const AppUpdateInfo({this.version, this.apkUrl, this.sha256});

  final String? version;
  final String? apkUrl;
  final String? sha256;

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) {
    return AppUpdateInfo(
      version: asStringOrNull(json['version']),
      apkUrl: asStringOrNull(json['apkUrl']),
      sha256: asStringOrNull(json['sha256']),
    );
  }
}
