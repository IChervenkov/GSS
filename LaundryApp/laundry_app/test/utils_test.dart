import 'package:flutter_test/flutter_test.dart';
import 'package:laundry_app/src/utils/formatters.dart';
import 'package:laundry_app/src/utils/parsing.dart';

void main() {
  test('labelForLaundryStatus normalizes backend status values', () {
    expect(labelForLaundryStatus('drop_off'), 'Drop-off');
    expect(labelForLaundryStatus('laundry_facility'), 'Laundry facility');
    expect(labelForLaundryStatus('ready_to_pick_up'), 'Ready to pick up');
  });

  test('parsing helpers normalize mixed API payloads', () {
    expect(asString(null, fallback: 'fallback'), 'fallback');
    expect(asInt('42'), 42);
    expect(asMap({'id': 1})['id'], 1);
    expect(asList([{'id': 'x'}]).single['id'], 'x');
  });
}