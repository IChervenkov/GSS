import 'package:bike_app/src/models/bike_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('InventorySnapshot maps summary, bicycles, and helmets', () {
    final snapshot = InventorySnapshot.fromJson({
      'summary': {'available': 2, 'rented': 1, 'repair': 0, 'late': 1, 'longTerm': 3},
      'totalBicycles': 7,
      'helmetPairingCount': 4,
      'needsAttention': 1,
      'bicycles': [
        {'id': 'bike-1', 'name': 'Bike 1', 'nfcCode': 'NFC-B1', 'status': 'available'},
      ],
      'helmets': [
        {'id': 'helmet-1', 'code': 'H1', 'nfcCode': 'NFC-H1', 'status': 'rented'},
      ],
    });

    expect(snapshot.summary.available, 2);
    expect(snapshot.summary.longTerm, 3);
    expect(snapshot.totalBicycles, 7);
    expect(snapshot.helmetPairingCount, 4);
    expect(snapshot.needsAttention, 1);
    expect(snapshot.bicycles.single.isAvailable, isTrue);
    expect(snapshot.helmets.single.code, 'H1');
  });

  test('NfcLookupResult picks a readable asset label', () {
    final result = NfcLookupResult.fromJson({
      'assetType': 'helmet',
      'asset': {'id': 'helmet-1', 'code': 'Helmet 1', 'status': 'available'},
    });

    expect(result.assetType, 'helmet');
    expect(result.label, 'Helmet 1');
    expect(result.status, 'available');
  });
  test('TablePageMeta maps pagination and sorting metadata', () {
    final meta = TablePageMeta.fromJson({
      'page': 2,
      'limit': 10,
      'total': 18,
      'totalPages': 2,
      'sourceTotal': 42,
      'sortColumn': 'name',
      'sortDirection': 'asc',
    });

    expect(meta.page, 2);
    expect(meta.sourceTotal, 42);
    expect(meta.sortColumn, 'name');
    expect(meta.sortDirection, 'asc');
  });
}
