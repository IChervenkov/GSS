import 'package:bike_app/src/utils/formatters.dart';
import 'package:bike_app/src/utils/parsing.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('statusLabel normalizes backend status values', () {
    expect(statusLabel('long_term'), 'Long term');
    expect(statusLabel('repair'), 'Repair');
  });

  test('parsing helpers normalize mixed API payloads', () {
    expect(asString(null, fallback: 'fallback'), 'fallback');
    expect(asInt('42'), 42);
    expect(asMap({'id': 1})['id'], 1);
    expect(asList([{'id': 'x'}]).single['id'], 'x');
  });
}
