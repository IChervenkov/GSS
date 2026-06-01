String formatDateTime(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  final meridiem = local.hour >= 12 ? 'PM' : 'AM';
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  return '${local.year}-${two(local.month)}-${two(local.day)} ${two(hour)}:${two(local.minute)} $meridiem';
}

String formatDate(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)}';
}

String errorMessage(Object error) {
  final text = error.toString();
  return text.startsWith('Exception: ') ? text.substring(11) : text;
}

String labelForInventoryStatus(String status) {
  return switch (status) {
    'undiscovered' => 'Not found',
    'completed' => 'Completed',
    'written_off' => 'Written off',
    _ => status.isEmpty ? '-' : status.replaceAll('_', ' '),
  };
}
