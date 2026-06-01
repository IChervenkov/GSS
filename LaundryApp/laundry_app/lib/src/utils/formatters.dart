String formatDateTime(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)} ${two(local.hour)}:${two(local.minute)}';
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

String labelForLaundryStatus(String status) {
  return switch (status) {
    'pick_up' => 'Available',
    'in_soldier' => 'In soldier',
    'drop_off' => 'Drop-off',
    'laundry_facility' => 'Laundry facility',
    'ready_to_pick_up' => 'Ready to pick up',
    'overdue' => 'Overdue',
    _ => status.isEmpty ? '-' : status.replaceAll('_', ' '),
  };
}
