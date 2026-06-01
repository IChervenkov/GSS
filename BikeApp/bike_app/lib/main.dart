import 'dart:async';

import 'package:flutter/material.dart';

import 'src/app/gss_bike_app.dart';
import 'src/services/late_bike_notification_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(LateBikeNotificationService.configure());
  runApp(const GssBikeApp());
}
