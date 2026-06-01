String statusLabel(String status) {
  return switch (status.toLowerCase()) {
    'available' => 'Available',
    'rented' => 'Rented',
    'repair' => 'Repair',
    'late' => 'Late',
    'long_term' => 'Long term',
    _ => status,
  };
}

String formatDateTime(DateTime value) {
  String two(int number) => number.toString().padLeft(2, '0');
  return '${value.year}-${two(value.month)}-${two(value.day)} ${two(value.hour)}:${two(value.minute)}';
}

String? requiredField(String? value) {
  return value == null || value.trim().isEmpty ? 'Required.' : null;
}

String errorMessage(Object error) {
  final text = error.toString().replaceFirst('Exception: ', '').trim();
  return text.isEmpty ? 'Something went wrong.' : text;
}
