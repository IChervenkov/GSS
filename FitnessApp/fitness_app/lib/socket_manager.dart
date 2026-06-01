import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fitness_app/api_service.dart';

class SocketManager {
  static io.Socket? _socket;
  static final _storage = const FlutterSecureStorage();

  // Function that stores pending event subscriptions
  static Function()? _pendingSoldierListeners;
  static Function()? _pendingCampListeners;
  static Function()? _pendingUserListeners;

  // Get socket instance
  static io.Socket? get socket => _socket;

  static Future<void> connect() async {
    final baseUrl = dotenv.env['BASE_URL'];
    final token = await _storage.read(key: "accessToken");

    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }

    _socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .build(),
    );

    _registerSocketEvents();
  }

  static void _registerSocketEvents() {
    if (_socket == null) return;

    _socket!.onConnect((_) async {
      // Re-subscribe to bike events when connected
      _applyPendingListeners();
    });

    _socket!.onDisconnect((reason) {
      // optional: debug log
    });

    _socket!.onReconnect((_) async {
      _applyPendingListeners();
    });

    _socket!.onError((err) async {
      final msg = err?.toString() ?? '';

      if (msg.contains("INVALID_TOKEN") || msg.contains("TOKEN_EXPIRED")) {
        final refreshed = await ApiService.interceptor.refreshTokenExternally();

        if (refreshed) {
          final newToken = await _storage.read(key: "accessToken");
          _socket!
            ..disconnect()
            ..auth = {'token': newToken}
            ..connect();
        } else {
          await ApiService.interceptor.logoutExternally();
        }
      }
    });
  }

  static void _applyPendingListeners() {
    _pendingSoldierListeners?.call();
    _pendingCampListeners?.call();
    _pendingUserListeners?.call();
  }

  static void subscribeCampEvents({required Function(dynamic) onAddCamp}) {
    _pendingCampListeners = () {
      if (_socket == null) return;

      _socket!
        ..off("addCamp")
        ..on("addCamp", onAddCamp);
    };

    // If already connected, bind immediately
    if (_socket?.connected == true) _pendingCampListeners!();
  }

  static void subscribeSoldierEvents({
    required Function(dynamic) onRemoveSoldier,
    required Function(dynamic) onAddSoldier,
    required Function(dynamic) onEditSoldier,
    required Function(dynamic) onUploadSoldier,
  }) {
    // Store the listener binding function
    _pendingSoldierListeners = () {
      if (_socket == null) return;

      _socket!
        ..off("removeSoldier")
        ..on("removeSoldier", onRemoveSoldier)
        ..off("addSoldier")
        ..on("addSoldier", onAddSoldier)
        ..off("editSoldier")
        ..on("editSoldier", onEditSoldier)
        ..off("uploadSoldier")
        ..on("uploadSoldier", onUploadSoldier);
    };

    // If already connected, bind immediately
    if (_socket?.connected == true) _pendingSoldierListeners!();
  }

  static void subscribeUserEvents({
    required Function(dynamic) onEditUser,
    required Function(dynamic) onDeleteUser,
  }) {
    // Store the listener binding function
    _pendingUserListeners = () {
      if (_socket == null) return;

      _socket!
        ..off("editUser")
        ..on("editUser", onEditUser)
        ..off("deleteUser")
        ..on("deleteUser", onDeleteUser);
    };

    // If already connected, bind immediately
    if (_socket?.connected == true) _pendingUserListeners!();
  }

  static void dispose() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _pendingSoldierListeners = null;
    _pendingCampListeners = null;
    _pendingUserListeners = null;
  }
}
