import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_app/src/utils/formatters.dart';
import 'package:inventory_app/src/utils/parsing.dart';

void main() {
  test('labelForInventoryStatus normalizes backend status values', () {
    expect(labelForInventoryStatus('undiscovered'), 'Not found');
    expect(labelForInventoryStatus('completed'), 'Completed');
  });

  test('parsing helpers normalize mixed API payloads', () {
    expect(asString(null, fallback: 'fallback'), 'fallback');
    expect(asInt('42'), 42);
    expect(asMap({'id': 1})['id'], 1);
    expect(asList([{'id': 'x'}]).single['id'], 'x');
  });
}
