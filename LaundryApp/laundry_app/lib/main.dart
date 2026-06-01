import 'dart:async';

import 'package:flutter/material.dart';

import 'src/app/gss_laundry_app.dart';
import 'src/services/laundry_notification_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(LaundryNotificationService.configure());
  runApp(const GssLaundryApp());
}
