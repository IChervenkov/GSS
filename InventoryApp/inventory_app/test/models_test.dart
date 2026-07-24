import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_app/src/models/inventory_models.dart';

void main() {
  test('Camp maps its per-user access flag', () {
    expect(
      Camp.fromJson({'id': 'camp-1', 'name': 'Camp One'}).canAccess,
      isTrue,
    );
    expect(
      Camp.fromJson({
        'id': 'camp-2',
        'name': 'Camp Two',
        'canAccess': false,
      }).canAccess,
      isFalse,
    );
  });

  test('AssetsOverview maps summary, rows, lookups, and tables', () {
    final overview = AssetsOverview.fromJson({
      'totalAssets': 3,
      'totalQuantity': '5',
      'notFoundAssets': 1,
      'completedAssets': 1,
      'typeCount': 2,
      'allAssets': [
        {
          'id': 'asset-1',
          'code': 'AST-1',
          'rfidCode': 'RFID-1',
          'name': 'Desk',
          'typeName': 'Furniture',
          'location': 'HQ / Room 1',
          'locationRoomId': 'room-1',
          'quantity': '1',
          'status': 'Good',
          'inventoryStatus': 'completed',
        },
      ],
      'inventoryStatusRows': [
        {'status': 'completed', 'label': 'Completed', 'assetCount': 1, 'quantity': '1'},
      ],
      'lookups': {
        'assetTypes': [
          {'id': 'type-1', 'name': 'Furniture'},
        ],
        'rooms': [
          {'id': 'room-1', 'name': 'Room 1', 'buildingName': 'HQ'},
        ],
      },
      'tables': {
        'allAssets': {
          'page': 1,
          'limit': 10,
          'total': 1,
          'totalPages': 1,
          'sourceTotal': 3,
        },
      },
    });

    expect(overview.totalAssets, 3);
    expect(overview.totalQuantity, '5');
    expect(overview.allAssets.single.isFound, isTrue);
    expect(overview.lookups.assetTypes.single.name, 'Furniture');
    expect(overview.lookups.rooms.single.label, 'HQ / Room 1');
    expect(overview.tables['allAssets']!.sourceTotal, 3);
  });

  test('AssetRfidLookupResult maps the asset payload', () {
    final result = AssetRfidLookupResult.fromJson({
      'asset': {
        'id': 'asset-2',
        'code': 'AST-2',
        'rfidCode': 'RFID-2',
        'name': 'Chair',
        'typeName': 'Furniture',
        'location': 'HQ / Room 2',
        'status': 'Excellent',
        'inventoryStatus': 'undiscovered',
      },
    });

    expect(result.asset.code, 'AST-2');
    expect(result.asset.inventoryStatusLabel, 'Not found');
    expect(result.asset.isMissing, isTrue);
  });
}
