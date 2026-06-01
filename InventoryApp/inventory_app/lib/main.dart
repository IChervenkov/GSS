import 'dart:async';

import 'package:flutter/material.dart';

import 'src/app/gss_inventory_app.dart';
import 'src/services/inventory_notification_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(InventoryNotificationService.configure());
  runApp(const GssInventoryApp());
}
