import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fitness_app/main.dart';
import 'package:fitness_app/api_service.dart';
import 'package:fitness_app/custom_emoji_feedback.dart';
import 'package:fitness_app/settings_screen.dart';
import 'package:fitness_app/socket_manager.dart';

class RatedScreen extends StatefulWidget {
  const RatedScreen({super.key});

  @override
  State<RatedScreen> createState() => _RatedScreenState();
}

class _RatedScreenState extends State<RatedScreen> {
  final storage = const FlutterSecureStorage();
  CancelToken rateCancelToken = CancelToken();

  final baseUrl = dotenv.env['BASE_URL'];

  Timer? _timeoutTimer;

  String? username;

  bool isLoading = false;
  bool _completed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  @override
  void dispose() {
    _cancelTimeout();
    if (!rateCancelToken.isCancelled) rateCancelToken.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    await _loadData();
    initSocket();
    _startTimeout();
  }

  void initSocket() {
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

  Future<void> _loadData() async {
    username = await storage.read(key: "username");
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

  void _showMessage(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    }
  }

  void _startTimeout() {
    _timeoutTimer = Timer(const Duration(minutes: 1), () {
      if (!_completed && mounted) {
        navigatorKey.currentState?.pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainScreen()),
          (route) => false,
        );
      }
    });
  }

  void _cancelTimeout() {
    _timeoutTimer?.cancel();
  }

  Future<void> _sendEmojiData(String emoji) async {
    if (!await _checkInternetConnection()) return;

    _completed = true;
    _cancelTimeout();

    final rowId = await storage.read(key: "rowId");

    if (rowId == null) {
      _showMessage("⚠️ Missing session data.");
      return;
    }

    if (mounted) setState(() => isLoading = true);

    try {
      final response = await ApiService.dio.post(
        '$baseUrl/api/sendEmojiData',
        data: {'emoji': emoji.trim(), 'rowId': rowId},
        cancelToken: rateCancelToken,
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode != 200) {
        final msg = response.data['message'] ?? 'Error sending your data.';
        _showMessage("⚠️ $msg");
        return;
      }

      _showSuccessDialog();
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage("❌ Error sending your data. Please connect to the support!");
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: const Text('✅ Success'),
        content: const Text(
          'Thank you for your time, your response is important to us.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              navigatorKey.currentState?.pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const MainScreen()),
                (route) => false,
              );
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
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

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: const Text("Rated Feedback"),
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
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Is the gym clean?',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 40),

                  // Flutter emoji rating widget
                  CustomEmojiFeedback(
                    onChanged: (emoji) {
                      _sendEmojiData(emoji);
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
