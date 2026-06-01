package com.example.bike_app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class MainActivity : FlutterActivity() {
    private val lateBikeNotificationChannelId = "gss_bike_late_bikes"
    private val appUpdateNotificationChannelId = "gss_bike_app_updates"
    private val notificationPermissionRequestCode = 4102
    private val appUpdateNotificationIntentExtra = "gss_bike_app_update_notification"
    private var nfcAdapter: NfcAdapter? = null
    private var nfcSink: EventChannel.EventSink? = null
    private var pendingNfcCode: String? = null
    private var pendingLateBikeNotification: LateBikeNotification? = null
    private var pendingAppUpdateNotification: AppUpdateNotification? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gss_bike/native")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "appBuildInfo" -> result.success(appBuildInfo())
                    "downloadAndInstallUpdate" -> {
                        val url = call.argument<String>("url").orEmpty()
                        val token = call.argument<String>("bearerToken").orEmpty()
                        val sha256 = call.argument<String>("sha256").orEmpty()
                        downloadAndInstallUpdate(url, token, sha256, result)
                    }
                    "showLateBikeNotification" -> {
                        showLateBikeNotification(
                            LateBikeNotification(
                                bicycleName = call.argument<String>("bicycleName").orEmpty(),
                                soldierName = call.argument<String>("soldierName").orEmpty(),
                                rentedAt = call.argument<String>("rentedAt").orEmpty(),
                            ),
                        )
                        result.success(null)
                    }
                    "showAppUpdateNotification" -> {
                        showAppUpdateNotification(
                            AppUpdateNotification(
                                version = call.argument<String>("version").orEmpty(),
                            ),
                        )
                        result.success(null)
                    }
                    "consumeAppUpdateNotificationTap" -> result.success(consumeAppUpdateNotificationTap())
                    "openUpdateUrl" -> {
                        val url = call.argument<String>("url").orEmpty()
                        openUpdateUrl(url, result)
                    }
                    else -> result.notImplemented()
                }
            }

        EventChannel(flutterEngine.dartExecutor.binaryMessenger, "gss_bike/nfc")
            .setStreamHandler(
                object : EventChannel.StreamHandler {
                    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                        nfcSink = events
                        pendingNfcCode?.let {
                            nfcSink?.success(it)
                            pendingNfcCode = null
                        }
                    }

                    override fun onCancel(arguments: Any?) {
                        nfcSink = null
                    }
                },
            )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        handleNfcIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        enableNfcForegroundDispatch()
    }

    override fun onPause() {
        nfcAdapter?.disableForegroundDispatch(this)
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNfcIntent(intent)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != notificationPermissionRequestCode) return
        val lateNotification = pendingLateBikeNotification
        val updateNotification = pendingAppUpdateNotification
        pendingLateBikeNotification = null
        pendingAppUpdateNotification = null
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            lateNotification?.let { showLateBikeNotification(it) }
            updateNotification?.let { showAppUpdateNotification(it) }
        }
    }

    private fun enableNfcForegroundDispatch() {
        val adapter = nfcAdapter ?: return
        val intent = Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_MUTABLE else 0
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)
        val filters = arrayOf(
            IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED).apply {
                addDataType("*/*")
            },
            IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED),
            IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED),
        )
        adapter.enableForegroundDispatch(this, pendingIntent, filters, null)
    }

    private fun consumeAppUpdateNotificationTap(): Boolean {
        val openedFromUpdateNotification =
            intent?.getBooleanExtra(appUpdateNotificationIntentExtra, false) == true
        intent?.removeExtra(appUpdateNotificationIntentExtra)
        return openedFromUpdateNotification
    }
    private fun handleNfcIntent(intent: Intent?) {
        val action = intent?.action ?: return
        if (
            action != NfcAdapter.ACTION_NDEF_DISCOVERED &&
            action != NfcAdapter.ACTION_TECH_DISCOVERED &&
            action != NfcAdapter.ACTION_TAG_DISCOVERED
        ) {
            return
        }
        val tag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG) as? Tag
        } ?: return
        val code = readNfcCode(tag)
        if (code.isBlank()) return
        if (nfcSink == null) {
            pendingNfcCode = code
        } else {
            nfcSink?.success(code)
        }
    }

    private fun readNfcCode(tag: Tag): String {
        return tag.id.joinToString("") { byte -> "%02X".format(byte.toInt() and 0xFF) }
    }

    private fun appBuildInfo(): Map<String, Any> {
        val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            packageManager.getPackageInfo(packageName, 0)
        }
        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            packageInfo.versionCode.toLong()
        }
        return mapOf(
            "versionName" to (packageInfo.versionName ?: ""),
            "versionCode" to versionCode,
        )
    }

    private fun showLateBikeNotification(lateBike: LateBikeNotification) {
        val bicycleName = lateBike.bicycleName.trim().ifBlank { "Bicycle" }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            pendingLateBikeNotification = lateBike.copy(bicycleName = bicycleName)
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                notificationPermissionRequestCode,
            )
            return
        }

        createLateBikeNotificationChannel()
        val openAppIntent = Intent(this, javaClass).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val pendingIntent = PendingIntent.getActivity(this, 0, openAppIntent, pendingIntentFlags)
        val body = lateBike.bodyText()
        val notification = NotificationCompat.Builder(this, lateBikeNotificationChannelId)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setContentTitle("$bicycleName is late")
            .setContentText(body)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(body),
            )
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        NotificationManagerCompat.from(this).notify(lateBike.notificationId(), notification)
    }

    private fun showAppUpdateNotification(update: AppUpdateNotification) {
        val version = update.version.trim()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            pendingAppUpdateNotification = update.copy(version = version)
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                notificationPermissionRequestCode,
            )
            return
        }

        createAppUpdateNotificationChannel()
        val openAppIntent = Intent(this, javaClass).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(appUpdateNotificationIntentExtra, true)
        }
        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val pendingIntent = PendingIntent.getActivity(this, 1, openAppIntent, pendingIntentFlags)
        val displayVersion = if (version.isBlank()) "the latest version" else "version $version"
        val body = "GSS Bike $displayVersion is ready to install."
        val notification = NotificationCompat.Builder(this, appUpdateNotificationChannelId)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("Update available")
            .setContentText(body)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(body),
            )
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        NotificationManagerCompat.from(this).notify(update.notificationId(), notification)
    }

    private fun createLateBikeNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            lateBikeNotificationChannelId,
            "Late bike rentals",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifications when rented bikes become late"
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    private fun createAppUpdateNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            appUpdateNotificationChannelId,
            "App updates",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifications when a new app version is available"
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    private fun downloadAndInstallUpdate(
        url: String,
        bearerToken: String,
        expectedSha256: String,
        result: MethodChannel.Result,
    ) {
        Thread {
            try {
                if (url.isBlank()) error("Missing update URL.")
                val updateDir = File(cacheDir, "updates").apply { mkdirs() }
                val apkFile = File(updateDir, "gss-bike-update.apk")
                val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 15000
                    readTimeout = 60000
                    setRequestProperty("Accept", "application/vnd.android.package-archive")
                    if (bearerToken.isNotBlank()) {
                        setRequestProperty("Authorization", "Bearer $bearerToken")
                    }
                }

                try {
                    if (connection.responseCode !in 200..299) {
                        error("The update package could not be downloaded.")
                    }
                    connection.inputStream.use { input ->
                        apkFile.outputStream().use { output -> input.copyTo(output) }
                    }
                } finally {
                    connection.disconnect()
                }

                val normalizedHash = expectedSha256.trim().lowercase()
                if (normalizedHash.isNotEmpty() && sha256(apkFile) != normalizedHash) {
                    apkFile.delete()
                    error("The update package failed integrity verification.")
                }

                runOnUiThread {
                    try {
                        openInstaller(apkFile)
                        result.success(null)
                    } catch (error: Throwable) {
                        result.error("INSTALL_FAILED", error.message, null)
                    }
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    result.error("UPDATE_FAILED", error.message, null)
                }
            }
        }.start()
    }

    private fun openInstaller(apkFile: File) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !packageManager.canRequestPackageInstalls()
        ) {
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:$packageName"),
                ),
            )
            error("Allow this app to install updates, then try again.")
        }

        val uri = FileProvider.getUriForFile(
            this,
            "$packageName.fileprovider",
            apkFile,
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(intent)
    }

    private fun openUpdateUrl(url: String, result: MethodChannel.Result) {
        try {
            if (url.isBlank()) error("Missing update link.")
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            result.success(null)
        } catch (error: Throwable) {
            result.error("OPEN_URL_FAILED", error.message, null)
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xFF) }
    }
}

private data class LateBikeNotification(
    val bicycleName: String,
    val soldierName: String,
    val rentedAt: String,
) {
    fun bodyText(): String {
        val parts = mutableListOf<String>()
        if (soldierName.isNotBlank()) parts += "Assigned to $soldierName"
        if (rentedAt.isNotBlank()) parts += "Rented at $rentedAt"
        return if (parts.isEmpty()) {
            "A rented bike has become late."
        } else {
            parts.joinToString(". ")
        }
    }

    fun notificationId(): Int {
        val positiveHash = bicycleName.hashCode().toLong().let { if (it < 0) -it else it }
        return 5100 + (positiveHash % 100000).toInt()
    }
}

private data class AppUpdateNotification(
    val version: String,
) {
    fun notificationId(): Int {
        val key = version.ifBlank { "latest" }
        val positiveHash = key.hashCode().toLong().let { if (it < 0) -it else it }
        return 6200 + (positiveHash % 100000).toInt()
    }
}
