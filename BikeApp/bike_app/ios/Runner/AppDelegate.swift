import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    configureNativeChannel()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .sound])
    } else {
      completionHandler([.alert, .sound])
    }
  }

  private func configureNativeChannel() {
    guard let controller = window?.rootViewController as? FlutterViewController else {
      return
    }

    let channel = FlutterMethodChannel(
      name: "gss_bike/native",
      binaryMessenger: controller.binaryMessenger
    )
    channel.setMethodCallHandler { [weak self] call, result in
      switch call.method {
      case "appBuildInfo":
        result(self?.appBuildInfo())
      case "showLateBikeNotification":
        let args = call.arguments as? [String: Any]
        self?.showLateBikeNotification(
          bicycleName: args?["bicycleName"] as? String ?? "",
          soldierName: args?["soldierName"] as? String ?? "",
          rentedAt: args?["rentedAt"] as? String ?? ""
        )
        result(nil)
      case "showAppUpdateNotification":
        let args = call.arguments as? [String: Any]
        self?.showAppUpdateNotification(version: args?["version"] as? String ?? "")
        result(nil)
      case "openUpdateUrl", "downloadAndInstallUpdate":
        let args = call.arguments as? [String: Any]
        self?.openUpdateUrl(args?["url"] as? String ?? "", result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  private func appBuildInfo() -> [String: Any] {
    let info = Bundle.main.infoDictionary ?? [:]
    let versionName = info["CFBundleShortVersionString"] as? String ?? ""
    let versionCodeText = info["CFBundleVersion"] as? String ?? "0"
    return [
      "versionName": versionName,
      "versionCode": Int(versionCodeText) ?? 0,
    ]
  }

  private func showLateBikeNotification(
    bicycleName: String,
    soldierName: String,
    rentedAt: String
  ) {
    let normalizedBikeName = bicycleName.trimmingCharacters(in: .whitespacesAndNewlines)
    let titleBikeName = normalizedBikeName.isEmpty ? "Bicycle" : normalizedBikeName

    let center = UNUserNotificationCenter.current()
    center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
      if !granted {
        return
      }

      let content = UNMutableNotificationContent()
      content.title = "\(titleBikeName) is late"
      content.body = self.lateBikeBodyText(soldierName: soldierName, rentedAt: rentedAt)
      content.sound = .default

      let request = UNNotificationRequest(
        identifier: "gss_bike_late_\(titleBikeName)",
        content: content,
        trigger: nil
      )
      center.add(request)
    }
  }

  private func showAppUpdateNotification(version: String) {
    let normalizedVersion = version.trimmingCharacters(in: .whitespacesAndNewlines)
    let displayVersion = normalizedVersion.isEmpty ? "the latest version" : "version \(normalizedVersion)"

    let center = UNUserNotificationCenter.current()
    center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
      if !granted {
        return
      }

      let content = UNMutableNotificationContent()
      content.title = "Update available"
      content.body = "GSS Bike \(displayVersion) is ready to install."
      content.sound = .default

      let request = UNNotificationRequest(
        identifier: "gss_bike_update_\(normalizedVersion)",
        content: content,
        trigger: nil
      )
      center.add(request)
    }
  }

  private func lateBikeBodyText(soldierName: String, rentedAt: String) -> String {
    var parts: [String] = []
    let normalizedSoldierName = soldierName.trimmingCharacters(in: .whitespacesAndNewlines)
    let normalizedRentedAt = rentedAt.trimmingCharacters(in: .whitespacesAndNewlines)
    if !normalizedSoldierName.isEmpty {
      parts.append("Assigned to \(normalizedSoldierName)")
    }
    if !normalizedRentedAt.isEmpty {
      parts.append("Rented at \(normalizedRentedAt)")
    }
    return parts.isEmpty ? "A rented bike has become late." : parts.joined(separator: ". ")
  }

  private func openUpdateUrl(_ urlText: String, result: @escaping FlutterResult) {
    guard let url = URL(string: urlText), UIApplication.shared.canOpenURL(url) else {
      result(FlutterError(
        code: "INVALID_URL",
        message: "The update link is not valid.",
        details: nil
      ))
      return
    }

    UIApplication.shared.open(url) { opened in
      if opened {
        result(nil)
      } else {
        result(FlutterError(
          code: "OPEN_URL_FAILED",
          message: "The update link could not be opened.",
          details: nil
        ))
      }
    }
  }
}
