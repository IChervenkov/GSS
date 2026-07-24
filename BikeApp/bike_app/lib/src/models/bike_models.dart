import '../utils/parsing.dart';

class Camp {
  const Camp({required this.id, required this.name, this.canAccess = true});

  final String id;
  final String name;
  final bool canAccess;

  factory Camp.fromJson(Map<String, dynamic> json) {
    return Camp(
      id: asString(json['id']),
      name: asString(json['name'], fallback: 'Camp'),
      canAccess: json['canAccess'] != false,
    );
  }
}

class InventorySummary {
  const InventorySummary({
    this.available = 0,
    this.rented = 0,
    this.repair = 0,
    this.late = 0,
    this.longTerm = 0,
  });

  final int available;
  final int rented;
  final int repair;
  final int late;
  final int longTerm;

  factory InventorySummary.fromJson(Map<String, dynamic> json) {
    return InventorySummary(
      available: asInt(json['available']),
      rented: asInt(json['rented']),
      repair: asInt(json['repair']),
      late: asInt(json['late']),
      longTerm: asInt(json['longTerm']),
    );
  }
}

class InventorySnapshot {
  const InventorySnapshot({
    required this.summary,
    required this.bicycles,
    required this.helmets,
    this.totalBicycles = 0,
    this.helmetPairingCount = 0,
    this.needsAttention = 0,
  });

  final InventorySummary summary;
  final List<BicycleAsset> bicycles;
  final List<HelmetAsset> helmets;
  final int totalBicycles;
  final int helmetPairingCount;
  final int needsAttention;

  factory InventorySnapshot.fromJson(Map<String, dynamic> json) {
    final summary = InventorySummary.fromJson(asMap(json['summary']));
    final bicycles = asList(
      json['bicycles'],
    ).map(BicycleAsset.fromJson).toList();
    final helmets = asList(json['helmets']).map(HelmetAsset.fromJson).toList();
    return InventorySnapshot(
      summary: summary,
      bicycles: bicycles,
      helmets: helmets,
      totalBicycles: asInt(json['totalBicycles'], fallback: bicycles.length),
      helmetPairingCount: asInt(
        json['helmetPairingCount'],
        fallback: bicycles.where((bike) => bike.helmetCode != null).length,
      ),
      needsAttention: asInt(
        json['needsAttention'],
        fallback: summary.repair + summary.late,
      ),
    );
  }
}

class BikePermissionNames {
  const BikePermissionNames._();

  static const full = 'Full permission';
  static const section = 'Bicycles';
  static const addBike = 'Add bike';
  static const editBike = 'Edit bike';
  static const deleteBike = 'Remove bike';
  static const addHelmet = 'Add helmet';
  static const editHelmet = 'Edit helmet';
  static const deleteHelmet = 'Remove helmet';
  static const saveBikeStatus = 'Save bike status';
  static const downloadBikeApp = 'Download bicycle app';
}

class BikeAppPermissions {
  const BikeAppPermissions({this.names = const <String>{}});

  final Set<String> names;

  bool get hasFullPermission => names.contains(BikePermissionNames.full);

  bool get hasSectionAccess =>
      hasFullPermission || names.contains(BikePermissionNames.section);

  bool has(String permissionName) =>
      hasFullPermission || names.contains(permissionName);

  bool get canUse => hasSectionAccess;

  bool get canAddBike => has(BikePermissionNames.addBike);
  bool get canEditBike => has(BikePermissionNames.editBike);
  bool get canDeleteBike => has(BikePermissionNames.deleteBike);
  bool get canAddHelmet => has(BikePermissionNames.addHelmet);
  bool get canEditHelmet => has(BikePermissionNames.editHelmet);
  bool get canDeleteHelmet => has(BikePermissionNames.deleteHelmet);
  bool get canSaveBikeStatus => has(BikePermissionNames.saveBikeStatus);
  bool get canDownloadBikeApp => has(BikePermissionNames.downloadBikeApp);

  factory BikeAppPermissions.fromJson(Map<String, dynamic> json) {
    return BikeAppPermissions(
      names: asList(json['permissions'])
          .map((item) => asString(asMap(item)['name']))
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
      sourceTotal: asInt(json['sourceTotal']),
      sortColumn: asStringOrNull(json['sortColumn']),
      sortDirection: asString(json['sortDirection'], fallback: 'default'),
    );
  }
}

class PagedBicycleAssets {
  const PagedBicycleAssets({required this.rows, required this.meta});

  final List<BicycleAsset> rows;
  final TablePageMeta meta;

  factory PagedBicycleAssets.fromJson(Map<String, dynamic> json) {
    return PagedBicycleAssets(
      rows: asList(json['bicycles']).map(BicycleAsset.fromJson).toList(),
      meta: TablePageMeta.fromJson(asMap(json['table'])),
    );
  }
}

class PagedHelmetAssets {
  const PagedHelmetAssets({required this.rows, required this.meta});

  final List<HelmetAsset> rows;
  final TablePageMeta meta;

  factory PagedHelmetAssets.fromJson(Map<String, dynamic> json) {
    return PagedHelmetAssets(
      rows: asList(json['helmets']).map(HelmetAsset.fromJson).toList(),
      meta: TablePageMeta.fromJson(asMap(json['table'])),
    );
  }
}

class BicycleAsset {
  const BicycleAsset({
    required this.id,
    required this.name,
    required this.nfcCode,
    required this.status,
    this.assignedSoldierId,
    this.assignedSoldier,
    this.helmetId,
    this.helmetCode,
    this.assignmentId,
    this.rentedAt,
  });

  final String id;
  final String name;
  final String nfcCode;
  final String status;
  final String? assignedSoldierId;
  final String? assignedSoldier;
  final String? helmetId;
  final String? helmetCode;
  final String? assignmentId;
  final String? rentedAt;

  bool get isAvailable => status == 'available';

  factory BicycleAsset.fromJson(Map<String, dynamic> json) {
    return BicycleAsset(
      id: asString(json['id']),
      name: asString(json['name'], fallback: 'Bike'),
      nfcCode: asString(json['nfcCode']),
      status: asString(json['status'], fallback: 'available'),
      assignedSoldierId: asStringOrNull(json['assignedSoldierId']),
      assignedSoldier: asStringOrNull(json['assignedSoldier']),
      helmetId: asStringOrNull(json['helmetId']),
      helmetCode: asStringOrNull(json['helmetCode']),
      assignmentId: asStringOrNull(json['assignmentId']),
      rentedAt: asStringOrNull(json['rentedAt']),
    );
  }
}

class HelmetAsset {
  const HelmetAsset({
    required this.id,
    required this.code,
    required this.nfcCode,
    required this.status,
    this.bicycleName,
    this.assignedSoldier,
  });

  final String id;
  final String code;
  final String nfcCode;
  final String status;
  final String? bicycleName;
  final String? assignedSoldier;

  bool get isAvailable => status == 'available';

  factory HelmetAsset.fromJson(Map<String, dynamic> json) {
    return HelmetAsset(
      id: asString(json['id']),
      code: asString(json['code'], fallback: 'Helmet'),
      nfcCode: asString(json['nfcCode']),
      status: asString(json['status'], fallback: 'available'),
      bicycleName: asStringOrNull(json['bicycleName']),
      assignedSoldier: asStringOrNull(json['assignedSoldier']),
    );
  }
}

class Soldier {
  const Soldier({
    required this.id,
    required this.name,
    this.country,
    this.mealCard,
    this.activeAssignmentCount = 0,
  });

  final String id;
  final String name;
  final String? country;
  final String? mealCard;
  final int activeAssignmentCount;

  factory Soldier.fromJson(Map<String, dynamic> json) {
    return Soldier(
      id: asString(json['id']),
      name: asString(json['name'], fallback: 'Soldier'),
      country: asStringOrNull(json['country']),
      mealCard: asStringOrNull(json['mealCard']),
      activeAssignmentCount: asInt(json['activeAssignmentCount']),
    );
  }
}

class RentalRecord {
  const RentalRecord({
    required this.assignmentId,
    this.bicycleId,
    this.bicycleName,
    this.bicycleNfcCode,
    this.soldierId,
    this.soldierName,
    this.helmetId,
    this.helmetCode,
    this.helmetNfcCode,
    this.rentedAt,
    this.returnedAt,
    this.status = 'rented',
  });

  final String assignmentId;
  final String? bicycleId;
  final String? bicycleName;
  final String? bicycleNfcCode;
  final String? soldierId;
  final String? soldierName;
  final String? helmetId;
  final String? helmetCode;
  final String? helmetNfcCode;
  final String? rentedAt;
  final String? returnedAt;
  final String status;

  factory RentalRecord.fromJson(Map<String, dynamic> json) {
    return RentalRecord(
      assignmentId: asString(json['assignmentId']),
      bicycleId: asStringOrNull(json['bicycleId']),
      bicycleName: asStringOrNull(json['bicycleName']),
      bicycleNfcCode: asStringOrNull(json['bicycleNfcCode']),
      soldierId: asStringOrNull(json['soldierId']),
      soldierName: asStringOrNull(json['soldierName']),
      helmetId: asStringOrNull(json['helmetId']),
      helmetCode: asStringOrNull(json['helmetCode']),
      helmetNfcCode: asStringOrNull(json['helmetNfcCode']),
      rentedAt: asStringOrNull(json['rentedAt']),
      returnedAt: asStringOrNull(json['returnedAt']),
      status: asString(json['status'], fallback: 'rented'),
    );
  }
}

class NfcLookupResult {
  const NfcLookupResult({
    required this.assetType,
    required this.assetId,
    required this.label,
    required this.status,
    this.bicycle,
    this.helmet,
  });

  final String assetType;
  final String assetId;
  final String label;
  final String status;
  final BicycleAsset? bicycle;
  final HelmetAsset? helmet;

  factory NfcLookupResult.fromJson(Map<String, dynamic> json) {
    final asset = asMap(json['asset']);
    final assetType = asString(json['assetType'], fallback: 'asset');
    return NfcLookupResult(
      assetType: assetType,
      assetId: asString(asset['id']),
      label: asString(
        asset['name'],
        fallback: asString(asset['code'], fallback: asString(asset['id'])),
      ),
      status: asString(asset['status'], fallback: 'unknown'),
      bicycle: assetType == 'bicycle' ? BicycleAsset.fromJson(asset) : null,
      helmet: assetType == 'helmet' ? HelmetAsset.fromJson(asset) : null,
    );
  }
}

class AppUpdateInfo {
  const AppUpdateInfo({this.version, this.apkUrl, this.iosUrl, this.sha256});

  final String? version;
  final String? apkUrl;
  final String? iosUrl;
  final String? sha256;

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) {
    return AppUpdateInfo(
      version: asStringOrNull(json['version']),
      apkUrl: asStringOrNull(json['apkUrl']),
      iosUrl:
          asStringOrNull(json['iosUrl']) ??
          asStringOrNull(json['appStoreUrl']) ??
          asStringOrNull(json['testFlightUrl']),
      sha256: asStringOrNull(json['sha256']),
    );
  }
}
