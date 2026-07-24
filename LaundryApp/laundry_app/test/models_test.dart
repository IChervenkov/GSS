import 'package:flutter_test/flutter_test.dart';
import 'package:laundry_app/src/models/laundry_models.dart';

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

  test('LaundryOverview maps summary, rows, status rows, and tables', () {
    final overview = LaundryOverview.fromJson({
      'total': 3,
      'pickUp': 1,
      'dropOff': 1,
      'laundryFacility': 1,
      'readyToPickUp': 0,
      'inSoldier': 0,
      'active': 2,
      'rows': [
        {
          'id': 'bag-1',
          'code': 'BAG-1',
          'rfidCode': 'RFID-1',
          'type': 'Mesh',
          'status': 'pick_up',
          'laundryCount': 1,
          'maxCountLaundry': 5,
        },
      ],
      'availableRows': [
        {
          'id': 'bag-1',
          'code': 'BAG-1',
          'rfidCode': 'RFID-1',
          'type': 'Mesh',
          'status': 'pick_up',
        },
      ],
      'statusRows': {
        'drop_off': [
          {
            'id': 'bag-2',
            'code': 'BAG-2',
            'rfidCode': 'RFID-2',
            'type': 'Large',
            'status': 'drop_off',
            'soldierName': 'Alpha Soldier',
          },
        ],
      },
      'statusTypeBreakdown': {
        'drop_off': [
          {'type': 'Large', 'count': 1},
        ],
      },
      'tables': {
        'all': {
          'page': 1,
          'limit': 10,
          'total': 1,
          'totalPages': 1,
          'sourceTotal': 3,
        },
      },
    });

    expect(overview.total, 3);
    expect(overview.pickUp, 1);
    expect(overview.rows.single.isAvailable, isTrue);
    expect(overview.statusRows['drop_off']!.single.soldierName, 'Alpha Soldier');
    expect(overview.statusTypeBreakdown['drop_off']!.single.count, 1);
    expect(overview.tables['all']!.sourceTotal, 3);
  });

  test('LaundryRfidLookupResult maps the bag payload', () {
    final result = LaundryRfidLookupResult.fromJson({
      'bag': {
        'id': 'bag-3',
        'code': 'BAG-3',
        'rfidCode': 'RFID-3',
        'type': 'Mesh',
        'status': 'ready_to_pick_up',
      },
    });

    expect(result.bag.code, 'BAG-3');
    expect(result.bag.statusLabel, 'Ready to pick up');
    expect(result.bag.isInActiveLane, isTrue);
  });
}
