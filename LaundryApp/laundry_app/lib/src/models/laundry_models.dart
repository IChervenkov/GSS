import '../utils/formatters.dart';
import '../utils/parsing.dart';

class Camp {
  const Camp({
    required this.id,
    required this.name,
    this.canAccess = true,
  });

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

class LaundryPermissionNames {
  const LaundryPermissionNames._();

  static const full = 'Full permission';
  static const section = 'Laundry';
  static const addBag = 'Add laundry bag';
  static const editBag = 'Edit laundry bag';
  static const deleteBag = 'Remove laundry bag';
  static const saveBagStatus = 'Save laundry status';
  static const downloadLaundryApp = 'Download laundry app';
}

class LaundryAppPermissions {
  const LaundryAppPermissions({this.names = const <String>{}});

  final Set<String> names;

  bool get hasFullPermission => names.contains(LaundryPermissionNames.full);
  bool has(String permissionName) =>
      hasFullPermission || names.contains(permissionName);

  bool get canUse =>
      hasFullPermission || names.contains(LaundryPermissionNames.section);

  bool get canAddBag => has(LaundryPermissionNames.addBag);
  bool get canEditBag => has(LaundryPermissionNames.editBag);
  bool get canDeleteBag => has(LaundryPermissionNames.deleteBag);
  bool get canSaveBagStatus => has(LaundryPermissionNames.saveBagStatus);
  bool get canDownloadLaundryApp =>
      has(LaundryPermissionNames.downloadLaundryApp);

  factory LaundryAppPermissions.fromJson(Map<String, dynamic> json) {
    return LaundryAppPermissions(
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

class LaundryBag {
  const LaundryBag({
    required this.id,
    required this.code,
    required this.rfidCode,
    required this.type,
    required this.status,
    required this.statusLabel,
    this.displayStatus,
    this.isOverdue = false,
    this.dateDropOff,
    this.overdueSince,
    this.soldierId,
    this.soldierName,
    this.soldierCountry,
    this.soldierMealCard,
    this.laundryCount = 0,
    this.maxCountLaundry = 1,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String code;
  final String rfidCode;
  final String type;
  final String status;
  final String statusLabel;
  final String? displayStatus;
  final bool isOverdue;
  final String? dateDropOff;
  final String? overdueSince;
  final String? soldierId;
  final String? soldierName;
  final String? soldierCountry;
  final String? soldierMealCard;
  final int laundryCount;
  final int maxCountLaundry;
  final String? createdAt;
  final String? updatedAt;

  bool get isAvailable => status == 'pick_up';
  bool get isInActiveLane =>
      status == 'drop_off' ||
      status == 'laundry_facility' ||
      status == 'ready_to_pick_up';

  factory LaundryBag.fromJson(Map<String, dynamic> json) {
    final status = asString(json['status'], fallback: 'pick_up');
    return LaundryBag(
      id: asString(json['id']),
      code: asString(json['code'], fallback: 'Bag'),
      rfidCode: asString(json['rfidCode']),
      type: asString(json['type'], fallback: '-'),
      status: status,
      statusLabel: asString(
        json['statusLabel'],
        fallback: labelForLaundryStatus(
          asString(json['displayStatus'], fallback: status),
        ),
      ),
      displayStatus: asStringOrNull(json['displayStatus']),
      isOverdue: json['isOverdue'] == true,
      dateDropOff: asStringOrNull(json['dateDropOff']),
      overdueSince: asStringOrNull(json['overdueSince']),
      soldierId: asStringOrNull(json['soldierId']),
      soldierName: asStringOrNull(json['soldierName']),
      soldierCountry: asStringOrNull(json['soldierCountry']),
      soldierMealCard: asStringOrNull(json['soldierMealCard']),
      laundryCount: asInt(json['laundryCount']),
      maxCountLaundry: asInt(json['maxCountLaundry'], fallback: 1),
      createdAt: asStringOrNull(json['createdAt']),
      updatedAt: asStringOrNull(json['updatedAt']),
    );
  }
}

class LaundryTypeBreakdown {
  const LaundryTypeBreakdown({required this.type, required this.count});

  final String type;
  final int count;

  factory LaundryTypeBreakdown.fromJson(Map<String, dynamic> json) {
    return LaundryTypeBreakdown(
      type: asString(json['type'], fallback: '-'),
      count: asInt(json['count']),
    );
  }
}

class LaundryOverview {
  const LaundryOverview({
    this.total = 0,
    this.pickUp = 0,
    this.dropOff = 0,
    this.laundryFacility = 0,
    this.readyToPickUp = 0,
    this.inSoldier = 0,
    this.active = 0,
    this.rows = const [],
    this.availableRows = const [],
    this.statusRows = const {},
    this.statusTypeBreakdown = const {},
    this.tables = const {},
    this.notifications = const [],
  });

  final int total;
  final int pickUp;
  final int dropOff;
  final int laundryFacility;
  final int readyToPickUp;
  final int inSoldier;
  final int active;
  final List<LaundryBag> rows;
  final List<LaundryBag> availableRows;
  final Map<String, List<LaundryBag>> statusRows;
  final Map<String, List<LaundryTypeBreakdown>> statusTypeBreakdown;
  final Map<String, TablePageMeta> tables;
  final List<LaundryOverdueNotification> notifications;

  factory LaundryOverview.fromJson(Map<String, dynamic> json) {
    final statusRowsJson = asMap(json['statusRows']);
    final breakdownJson = asMap(json['statusTypeBreakdown']);
    final tablesJson = asMap(json['tables']);
    return LaundryOverview(
      total: asInt(json['total']),
      pickUp: asInt(json['pickUp']),
      dropOff: asInt(json['dropOff']),
      laundryFacility: asInt(json['laundryFacility']),
      readyToPickUp: asInt(json['readyToPickUp']),
      inSoldier: asInt(json['inSoldier']),
      active: asInt(json['active']),
      rows: asList(json['rows']).map(LaundryBag.fromJson).toList(),
      availableRows: asList(
        json['availableRows'],
      ).map(LaundryBag.fromJson).toList(),
      statusRows: {
        for (final entry in statusRowsJson.entries)
          entry.key: asList(entry.value).map(LaundryBag.fromJson).toList(),
      },
      statusTypeBreakdown: {
        for (final entry in breakdownJson.entries)
          entry.key: asList(
            entry.value,
          ).map(LaundryTypeBreakdown.fromJson).toList(),
      },
      tables: {
        for (final entry in tablesJson.entries)
          entry.key: TablePageMeta.fromJson(asMap(entry.value)),
      },
      notifications: asList(
        json['notifications'],
      ).map(LaundryOverdueNotification.fromJson).toList(),
    );
  }
}

class LaundryOverdueNotification {
  const LaundryOverdueNotification({
    required this.bagId,
    required this.bagCode,
    this.soldierName,
    this.dateDropOff,
    this.overdueSince,
    this.message,
  });

  final String bagId;
  final String bagCode;
  final String? soldierName;
  final String? dateDropOff;
  final String? overdueSince;
  final String? message;

  String get dedupeKey => '$bagId|${dateDropOff ?? overdueSince ?? ''}';

  factory LaundryOverdueNotification.fromJson(Map<String, dynamic> json) {
    return LaundryOverdueNotification(
      bagId: asString(json['bagId'] ?? json['identifier'] ?? json['id']),
      bagCode: asString(
        json['bagCode'] ?? json['code'],
        fallback: 'Laundry bag',
      ),
      soldierName: asStringOrNull(json['soldierName']),
      dateDropOff: asStringOrNull(json['dateDropOff']),
      overdueSince: asStringOrNull(json['overdueSince']),
      message: asStringOrNull(json['message']),
    );
  }
}

class LaundryRfidLookupResult {
  const LaundryRfidLookupResult({required this.bag});

  final LaundryBag bag;

  factory LaundryRfidLookupResult.fromJson(Map<String, dynamic> json) {
    return LaundryRfidLookupResult(
      bag: LaundryBag.fromJson(asMap(json['bag'] ?? json['asset'])),
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
