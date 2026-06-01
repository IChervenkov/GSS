import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:pub_semver/pub_semver.dart';
import 'package:pinput/pinput.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_app_installer/flutter_app_installer.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:fitness_app/api_service.dart';
import 'package:fitness_app/rated_screen.dart';
import 'package:fitness_app/settings_screen.dart';
import 'package:fitness_app/socket_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: "connect.env");
  ApiService.init();
  runApp(const MainApp());
}

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
BuildContext? get globalContext => navigatorKey.currentState?.overlay?.context;

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GSS Gym',
      theme: ThemeData(primarySwatch: Colors.green),
      navigatorKey: navigatorKey,
      home: MainScreen(),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  final storage = const FlutterSecureStorage();
  CancelToken mainCancelToken = CancelToken();

  String? jwtToken;
  String? lastNotifiedVersion;
  String? _selectedClientId;
  String? username;

  bool isLoading = false;

  Timer? _refreshTimer;

  final FlutterLocalNotificationsPlugin notifications =
      FlutterLocalNotificationsPlugin();

  final TextEditingController _clientController = TextEditingController();
  final List<String> _clientNames = [];
  final Map<String, String> _clientIdMap = {};

  final baseUrl = dotenv.env['BASE_URL'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    if (!mainCancelToken.isCancelled) mainCancelToken.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    await _initNotifications();
    await _requestNotificationPermission();
    await _initApp();
    initSocket();
  }

  void _scheduleRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer(const Duration(milliseconds: 500), () async {
      await _fetchClients();
    });
  }

  void initSocket() {
    SocketManager.subscribeSoldierEvents(
      onRemoveSoldier: (data) {
        _scheduleRefresh();
      },
      onAddSoldier: (data) {
        _scheduleRefresh();
      },
      onEditSoldier: (data) {
        _scheduleRefresh();
      },
      onUploadSoldier: (data) {
        _scheduleRefresh();
      },
    );

    SocketManager.subscribeUserEvents(
      onEditUser: (data) async {
        final payload = Map<String, dynamic>.from(data);
        if (username == payload["oldUsername"]) {
          final newName = payload["newUsername"];
          await storage.write(key: "username", value: newName);
          if (mounted) setState(() => username = newName);
        }
      },
      onDeleteUser: (data) async {
        final payload = Map<String, dynamic>.from(data);
        final dynamic field = payload["listUsername"];

        // Simplified list parsing
        List<String> list = [];
        if (field is String) {
          list = [field];
        } else if (field is List) {
          list = field
              .map((e) => e is Map ? e["username"].toString() : e.toString())
              .toList();
        }

        if (list.contains(username)) {
          await _performLogout();
        }
      },
    );
  }

  Future<void> _promptUpdate(String apkUrl) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text("✨ Update Available"),
        content: const Text(
          "A new version is available. Do you want to update now?",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text("No"),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text("Yes"),
          ),
        ],
      ),
    );

    if (confirmed ?? false) {
      await _downloadAndInstall(apkUrl);
    }
  }

  Future<void> _downloadAndInstall(String apkUrl) async {
    if (mounted) setState(() => isLoading = true);

    try {
      final dir = await getExternalStorageDirectory();
      if (dir == null) {
        _showMessage("⚠️ No external storage available");
        return;
      }

      final filePath = '${dir.path}/update.apk';
      final file = File(filePath);
      if (await file.exists()) await file.delete();

      // Download APK
      final username = await storage.read(key: "username") ?? "";
      final response = await ApiService.dio.get(
        "$baseUrl$apkUrl?username=$username",
        cancelToken: mainCancelToken,
        options: Options(
          responseType: ResponseType.bytes,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.data is! List<int>) {
        _showMessage("⚠️ Invalid update file received.");
        return;
      }

      await file.writeAsBytes(response.data as List<int>);

      final installer = FlutterAppInstaller();
      await installer.installApk(filePath: filePath);
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage(
        "❌ There is a problem with app update. Please connect to the support.",
      );
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _initNotifications() async {
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    final InitializationSettings settings = InitializationSettings(
      android: androidSettings,
    );

    await notifications.initialize(
      settings: settings,
      onDidReceiveNotificationResponse: (details) {
        final payload = details.payload;
        if (payload != null && payload.isNotEmpty) _promptUpdate(payload);
      },
    );
  }

  Future<void> _requestNotificationPermission() async {
    if (await Permission.notification.isDenied) {
      await Permission.notification.request();
    }
  }

  Future<void> _initApp() async {
    jwtToken = await storage.read(key: "accessToken");

    if (jwtToken == null || jwtToken!.isEmpty) {
      showLoginDialog();
      return;
    }

    await SocketManager.connect();

    username = await storage.read(key: "username");
    final campId = await storage.read(key: "campId");

    if (campId == null || campId.isEmpty) {
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const SettingsScreen()),
        (route) => false,
      );
    }

    await _fetchClients();
    await _checkForUpdate();
  }

  Future<bool> _checkInternetConnection() async {
    final connectivityResult = await Connectivity().checkConnectivity();
    final hasNetwork = !connectivityResult.contains(ConnectivityResult.none);

    final hasInternet = await ApiService.hasInternet();

    if (!hasNetwork || !hasInternet) {
      _showMessage("⚠️ You are offline...");
      return false;
    }
    return true;
  }

  Future<Map<String, String>> _getDeviceInfo() async {
    final deviceInfo = DeviceInfoPlugin();
    final androidInfo = await deviceInfo.androidInfo;
    final curentDeviceId = await storage.read(key: "deviceId");

    if (curentDeviceId != null && curentDeviceId != '') {
      return {
        "deviceId": curentDeviceId,
        "deviceName": "${androidInfo.manufacturer} ${androidInfo.model}",
      };
    }

    final deviceId = androidInfo.id;
    await storage.write(key: "deviceId", value: deviceId);
    return {
      "deviceId": deviceId,
      "deviceName": "${androidInfo.manufacturer} ${androidInfo.model}",
    };
  }

  Future<void> _checkForUpdate() async {
    if (!await _checkInternetConnection()) return;

    if (mounted) setState(() => isLoading = true);
    try {
      final response = await ApiService.dio.get(
        "$baseUrl/api/apk-fitness-version",
        cancelToken: mainCancelToken,
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode != 200) {
        final message = response.data['message'] ?? 'Unknown error';
        _showMessage("⚠️ $message");
        return;
      }

      final latestVersion = response.data['version'];
      final apkUrl = response.data['apkUrl'];
      final info = await PackageInfo.fromPlatform();
      final currentVersion = info.version;

      final latest = Version.parse(latestVersion);
      final current = Version.parse(currentVersion);

      // Only show notification if the version is new and hasn't been notified yet
      if (latest > current && latestVersion != lastNotifiedVersion) {
        await _sendUpdateNotification(apkUrl);
        lastNotifiedVersion = latestVersion;
      }
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage(
        "❌ There is a problem with the app update process. Please connect to the support.",
      );
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _sendUpdateNotification(String apkUrl) async {
    const androidDetails = AndroidNotificationDetails(
      'update_channel',
      'App Updates',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@drawable/ic_notification',
      playSound: true,
    );

    const platformDetails = NotificationDetails(android: androidDetails);

    await notifications.show(
      id: 1001,
      title: "New Version Available",
      body: "Tap to update the app.",
      notificationDetails: platformDetails,
      payload: apkUrl,
    );
  }

  void showLoginDialog() {
    final usernameController = TextEditingController();
    final passwordController = TextEditingController();

    showDialog(
      context: globalContext ?? context,
      barrierDismissible: false,
      builder: (_) {
        bool isDialogLoading = false;

        return StatefulBuilder(
          builder: (context, setDialogState) {
            return PopScope(
              canPop: false,
              onPopInvokedWithResult: (didPop, result) {
                if (!didPop) SystemNavigator.pop();
              },
              child: Dialog(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        "🔒 Login",
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 20),
                      TextField(
                        controller: usernameController,
                        enabled: !isDialogLoading,
                        decoration: InputDecoration(
                          labelText: "Username",
                          prefixIcon: const Icon(Icons.account_circle),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                      const SizedBox(height: 15),
                      TextField(
                        controller: passwordController,
                        enabled: !isDialogLoading,
                        obscureText: true,
                        decoration: InputDecoration(
                          labelText: "Password",
                          prefixIcon: const Icon(Icons.password),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                      const SizedBox(height: 25),

                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(double.infinity, 50),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: isDialogLoading
                            ? null
                            : () async {
                                setDialogState(() => isDialogLoading = true);

                                final success = await _performLogin(
                                  usernameController.text.trim(),
                                  passwordController.text.trim(),
                                );

                                if (success) {
                                  if (context.mounted) Navigator.pop(context);
                                  username = await storage.read(
                                    key: "username",
                                  );
                                  await _fetchQRCodeFor2FA();
                                } else {
                                  setDialogState(() => isDialogLoading = false);
                                }
                              },
                        child: isDialogLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                "Login",
                                style: TextStyle(fontSize: 18),
                              ),
                      ),

                      const SizedBox(height: 10),

                      if (!isDialogLoading)
                        TextButton(
                          onPressed: () => SystemNavigator.pop(),
                          child: const Text(
                            "Cancel",
                            style: TextStyle(color: Colors.red),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<bool> _performLogin(String username, String password) async {
    if (!await _checkInternetConnection()) return false;

    if (username.isEmpty || password.isEmpty) {
      _showMessage("⚠️ Fill in all fields");
      return false;
    }

    if (mounted) setState(() => isLoading = true);
    try {
      final response = await ApiService.dio.post(
        "$baseUrl/checkLogInApp",
        cancelToken: mainCancelToken,
        data: {"username": username.trim(), "password": password.trim()},
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode != 200) {
        final message = response.data['message'] ?? 'Unknown error';
        _showMessage("⚠️ $message");
        return false;
      }

      if (!response.data['success'] && !response.data['validUsername']) {
        _showMessage("⚠️ Invalid username");
        return false;
      }

      if (!response.data['success']) {
        _showMessage("⚠️ Invalid password");
        return false;
      }

      await storage.write(key: "username", value: username);
      return true;
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return false;
      _showMessage("❌ Error when login. Please connect to the support.");
      return false;
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _fetchQRCodeFor2FA() async {
    if (!await _checkInternetConnection()) return;

    if (mounted) setState(() => isLoading = true);
    try {
      final response = await ApiService.dio.get(
        "$baseUrl/2fa-verificated-device?username=$username",
        cancelToken: mainCancelToken,
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode != 200) {
        final message = response.data['message'] ?? 'Unknown error';
        _showMessage("⚠️ $message");
        return;
      }

      final qrBase64 = response.data['qrCodeDataURL'].split(",")[1];
      final secret = response.data['secret'];
      final bytes = base64Decode(qrBase64);

      showQRCodeDialog(bytes, secret);
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage("❌ Failed to load QR code, Please connect to support!");
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void showQRCodeDialog(Uint8List qrBytes, Map<String, dynamic> secret) {
    bool isQrVisible = false;
    bool isLoadingQr = false;

    showDialog(
      context: globalContext ?? context,
      barrierDismissible: false,
      builder: (_) {
        return StatefulBuilder(
          builder: (context, setState) {
            Future<void> requestShowQr() async {
              setState(() {
                isLoadingQr = true;
              });

              try {
                final response = await ApiService.dio.get(
                  '$baseUrl/requestShowQr?username=$username',
                  cancelToken: mainCancelToken,
                  options: Options(
                    responseType: ResponseType.json,
                    validateStatus: (status) =>
                        status != null && status != 401 && status != 403,
                  ),
                );

                if (response.statusCode != 200) {
                  final message = response.data['message'] ?? 'Unknown error';
                  _showMessage("⚠️ $message");
                  return;
                }

                setState(() {
                  isQrVisible = true;
                });
              } catch (e) {
                if (e is DioException && e.type == DioExceptionType.cancel) {
                  return;
                }
                _showMessage(
                  "❌ Failed to load QR code, Please connect to support!",
                );
              } finally {
                setState(() {
                  isLoadingQr = false;
                });
              }
            }

            final defaultPinTheme = PinTheme(
              width: 50,
              height: 60,
              textStyle: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 6,
                    offset: Offset(0, 3),
                  ),
                ],
                border: Border.all(color: Colors.grey.shade200, width: 1.5),
              ),
            );

            return PopScope(
              canPop: false,
              onPopInvokedWithResult: (didPop, result) {
                if (!didPop) {
                  Navigator.pop(globalContext ?? context);
                  showLoginDialog();
                }
              },
              child: Dialog(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return ConstrainedBox(
                      constraints: BoxConstraints(
                        maxHeight: constraints.maxHeight * 0.9,
                      ),
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Header
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(
                                  Icons.verified_user,
                                  size: 28,
                                  color: Colors.green,
                                ),
                                SizedBox(width: 8),
                                Text(
                                  "2FA Verification",
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(height: 24),

                            // QR Section
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 300),
                              child: isQrVisible
                                  ? ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: Image.memory(
                                        qrBytes,
                                        width: 220,
                                        height: 220,
                                        filterQuality: FilterQuality.high,
                                      ),
                                    )
                                  : Column(
                                      children: [
                                        Container(
                                          width: 160,
                                          height: 160,
                                          decoration: BoxDecoration(
                                            color: Colors.grey.shade200,
                                            borderRadius: BorderRadius.circular(
                                              16,
                                            ),
                                          ),
                                          child: const Icon(
                                            Icons.qr_code_2,
                                            size: 100,
                                            color: Colors.grey,
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                        ElevatedButton(
                                          onPressed: isLoadingQr
                                              ? null
                                              : requestShowQr,
                                          style: ElevatedButton.styleFrom(
                                            minimumSize: const Size(160, 44),
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                          ),
                                          child: isLoadingQr
                                              ? const SizedBox(
                                                  width: 20,
                                                  height: 20,
                                                  child:
                                                      CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                      ),
                                                )
                                              : const Text(
                                                  "Show my code",
                                                  style: TextStyle(
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                        ),
                                      ],
                                    ),
                            ),

                            const SizedBox(height: 28),

                            const Text(
                              "Enter your 6-digit code",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),

                            const SizedBox(height: 16),

                            SizedBox(
                              width: 260,
                              child: Pinput(
                                length: 6,
                                keyboardType: TextInputType.number,
                                autofocus: true,
                                defaultPinTheme: defaultPinTheme,
                                focusedPinTheme: defaultPinTheme
                                    .copyDecorationWith(
                                      border: Border.all(
                                        color: Colors.green,
                                        width: 2,
                                      ),
                                    ),
                                onCompleted: (code) async {
                                  Navigator.pop(globalContext ?? context);

                                  final success = await _verifyTOTPCode(
                                    code,
                                    secret,
                                  );

                                  if (!success) {
                                    showQRCodeDialog(qrBytes, secret);
                                  }
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<bool> _verifyTOTPCode(String code, Map<String, dynamic> secret) async {
    if (!await _checkInternetConnection()) return false;

    if (mounted) setState(() => isLoading = true);
    try {
      final deviceInfo = await _getDeviceInfo();
      final response = await ApiService.dio.post(
        "$baseUrl/verify-device",
        cancelToken: mainCancelToken,
        data: {
          "code": code,
          "userSecret": Map<String, dynamic>.from(secret),
          "username": username,
          "deviceId": deviceInfo["deviceId"],
          "deviceName": deviceInfo["deviceName"],
        },
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode != 200) {
        final message = response.data["message"] ?? 'Unknown error';
        _showMessage("⚠️ $message");
        return false;
      }

      final accessToken = response.data['accessToken'];
      final refreshToken = response.data['refreshToken'];

      await storage.write(key: "accessToken", value: accessToken);
      await storage.write(key: "refreshToken", value: refreshToken);

      await SocketManager.connect();

      final campId = await storage.read(key: "campId");
      if (campId == null || campId.isEmpty) {
        navigatorKey.currentState?.pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const SettingsScreen()),
          (route) => false,
        );

        _showMessage("⚠️ Login success. Now set the camp to continue.");
      } else {
        _showMessage("✅ Login success.");
      }

      return true;
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return false;
      _showMessage("❌ Error verifying 2FA. Please connect to support!");
      return false;
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _performLogout() async {
    if (mounted) setState(() => isLoading = true);
    try {
      await ApiService.interceptor.logoutExternally();
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage(
        "❌ There is a problem with logout. Please connect to the support.",
      );
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("⚠️ Attention"),
        content: Text("Are you sure you want to logout?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("No"),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Yes"),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    await _performLogout();
  }

  Future<void> _fetchClients() async {
    if (!await _checkInternetConnection()) return;

    if (mounted) setState(() => isLoading = true);
    try {
      final campId = await storage.read(key: "campId");
      final response = await ApiService.dio.get(
        '$baseUrl/api/getClient?campId=$campId',
        cancelToken: mainCancelToken,
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode != 200) {
        final message = response.data['message'] ?? 'Unknown error';
        _showMessage("⚠️ $message");
        return;
      }

      final List data = response.data;

      _clientNames.clear();
      _clientIdMap.clear();

      for (final client in data) {
        final name = client['namesoldier'];
        _clientNames.add(name);
        _clientIdMap[name] = client['id'].toString();
      }

      if (mounted) setState(() {});
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage('❌ Error fetching data. Please connect to support.');
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _sendClient(String clientId) async {
    if (!await _checkInternetConnection()) return;

    if (mounted) setState(() => isLoading = true);
    try {
      final response = await ApiService.dio.post(
        '$baseUrl/api/sendClientData',
        data: {'userId': clientId.trim()},
        cancelToken: mainCancelToken,
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode != 200) {
        final message = response.data['message'] ?? 'Unknown error';
        _showMessage("⚠️ $message");
        return;
      }

      final rowId = response.data['rowId'];
      await storage.write(key: "rowId", value: rowId);

      if (mounted) {
        navigatorKey.currentState?.pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const RatedScreen()),
          (route) => false,
        );
      }
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage('❌ Error sending data. Please contact support.');
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void _showMessage(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: const Text("Fitness Registration"),
            actions: [
              IconButton(
                icon: const Icon(Icons.settings),
                onPressed: () {
                  navigatorKey.currentState?.push(
                    MaterialPageRoute(builder: (_) => const SettingsScreen()),
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.logout, color: Colors.redAccent),
                onPressed: _logout,
              ),
            ],
          ),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Please, register before entering the gym',
                    style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 40),
                  Autocomplete<String>(
                    optionsBuilder: (TextEditingValue value) {
                      if (value.text.isEmpty) {
                        return const Iterable<String>.empty();
                      }
                      return _clientNames.where(
                        (e) =>
                            e.toLowerCase().contains(value.text.toLowerCase()),
                      );
                    },
                    onSelected: (selected) {
                      _selectedClientId = _clientIdMap[selected];
                      if (_selectedClientId != null) {
                        _sendClient(_selectedClientId!);
                      }
                    },
                    fieldViewBuilder:
                        (context, controller, focusNode, onFieldSubmitted) {
                          _clientController.text = controller.text;
                          return TextField(
                            controller: controller,
                            focusNode: focusNode,
                            decoration: const InputDecoration(
                              labelText: 'Select name',
                              border: OutlineInputBorder(),
                              prefixIcon: Icon(Icons.search),
                            ),
                            style: const TextStyle(fontSize: 20),
                          );
                        },
                  ),
                ],
              ),
            ),
          ),
        ),

        // Loading overlay
        if (isLoading)
          Stack(
            children: [
              ModalBarrier(color: Colors.black54, dismissible: false),
              const Center(
                child: CircularProgressIndicator(color: Colors.white),
              ),
            ],
          ),
      ],
    );
  }
}
