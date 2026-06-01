import 'dart:io';
import 'package:dio/dio.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_app_installer/flutter_app_installer.dart';
import 'package:pub_semver/pub_semver.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fitness_app/main.dart';
import 'package:fitness_app/socket_manager.dart';
import 'package:fitness_app/api_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final storage = const FlutterSecureStorage();
  CancelToken settingCancelToken = CancelToken();

  String? username;
  String? selectedCampId;
  List<Map<String, String>> camps = [];
  bool isLoading = false;

  final baseUrl = dotenv.env['BASE_URL'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  @override
  void dispose() {
    if (!settingCancelToken.isCancelled) settingCancelToken.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    initSocket();
    await _loadData();
    await _fetchCamps();
  }

  void initSocket() {
    SocketManager.subscribeCampEvents(
      onAddCamp: (data) async {
        await _fetchCamps();
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

  Future<void> _fetchCamps() async {
    if (!await _checkInternetConnection()) return;

    if (mounted) setState(() => isLoading = true);
    try {
      final response = await ApiService.dio.get(
        "$baseUrl/api/getAllCamp",
        cancelToken: settingCancelToken,
        options: Options(
          responseType: ResponseType.json,
          validateStatus: (status) =>
              status != null && status != 401 && status != 403,
        ),
      );

      if (response.statusCode != 200) {
        final message = response.data['message'] ?? "Error fetch camp";
        _showMessage("⚠️ $message");
        return;
      }

      final data = response.data as List;
      camps = data.map((camp) {
        return {
          "id": camp['id'].toString(),
          "name": camp['campname'].toString(),
        };
      }).toList();

      if (selectedCampId == null && camps.isNotEmpty) {
        selectedCampId = camps.first['id'];
      }
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage(
        "❌ Error when fetch camp data. Please connect to the support!",
      );
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _checkForUpdate() async {
    if (!await _checkInternetConnection()) return;

    if (mounted) setState(() => isLoading = true);
    try {
      final response = await ApiService.dio.get(
        "$baseUrl/api/apk-asset-version",
        cancelToken: settingCancelToken,
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

      if (latest > current) {
        _promptUpdate(apkUrl);
      } else {
        _showMessage("✅ App is up to date");
      }
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      _showMessage(
        "❌ There is a problem with app update. Please connect to the support.",
      );
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
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
      final response = await ApiService.dio.get(
        "$baseUrl$apkUrl?username=$username",
        cancelToken: settingCancelToken,
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

      // ✅ Install the APK
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
            title: const Text("⚙️ Settings"),
            actions: [
              IconButton(
                icon: const Icon(Icons.logout, color: Colors.redAccent),
                tooltip: "Logout",
                onPressed: _logout,
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildSectionTitle("Select Location"),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: camps.any((c) => c['id'] == selectedCampId)
                      ? selectedCampId
                      : null,
                  isExpanded: true,
                  hint: const Text("Choose a camp"),
                  decoration: InputDecoration(
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    prefixIcon: const Icon(
                      Icons.holiday_village,
                      color: Colors.green,
                    ),
                  ),
                  items: camps
                      .map(
                        (camp) => DropdownMenuItem(
                          value: camp['id'],
                          child: Text(camp['name']!),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => selectedCampId = value),
                ),

                const SizedBox(height: 40),

                // SAVE BUTTON
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: _saveSettings,
                  icon: const Icon(Icons.save),
                  label: const Text(
                    "SAVE SETTINGS",
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),

                const SizedBox(height: 12),

                // UPDATE BUTTON
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    side: const BorderSide(color: Colors.blueAccent),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: _checkForUpdate,
                  icon: const Icon(
                    Icons.system_update,
                    color: Colors.blueAccent,
                  ),
                  label: const Text("CHECK FOR UPGRADE"),
                ),
              ],
            ),
          ),
        ),

        // Loading Overlay
        if (isLoading)
          const ModalBarrier(color: Colors.black54, dismissible: false),
        if (isLoading)
          const Center(child: CircularProgressIndicator(color: Colors.white)),
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: Colors.grey,
      ),
    );
  }

  Future<void> _saveSettings() async {
    if (selectedCampId == null) {
      _showMessage("⚠️ Please select a camp first");
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("⚠️ Attention"),
        content: Text("Are you sure you want to save these settings?"),
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

    setState(() => isLoading = true);
    try {
      await storage.write(key: "campId", value: selectedCampId!);
      _showMessage("✅ Settings applied successfully");

      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainScreen()),
          (route) => false,
        );
      }
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }
}
