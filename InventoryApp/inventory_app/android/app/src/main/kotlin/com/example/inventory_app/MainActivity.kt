package com.example.inventory_app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.rscja.deviceapi.RFIDWithUHFUART
import com.rscja.deviceapi.entity.UHFTAGInfo
import com.rscja.deviceapi.interfaces.IUHFInventoryCallback
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class MainActivity : FlutterActivity() {
    private val inventoryStatusNotificationChannelId = "gss_inventory_status"
    private val appUpdateNotificationChannelId = "gss_inventory_app_updates"
    private val notificationPermissionRequestCode = 4102
    private val appUpdateNotificationIntentExtra = "gss_inventory_app_update_notification"
    private val rfidDuplicateWindowMillis = 2_000L
    private val rfidMinPower = 1
    private val rfidMaxPower = 30
    private var rfidReader: RFIDWithUHFUART? = null
    private var rfidInitialized = false
    private var rfidInventorying = false
    private var rfidScanEnabled = false
    private var rfidScanKeyDown = false
    private var rfidSink: EventChannel.EventSink? = null
    private var pendingRfidCode: String? = null
    private val recentRfidCodes = mutableMapOf<String, Long>()
    private var pendingAssetInventoryNotification: AssetInventoryNotification? = null
    private var pendingAppUpdateNotification: AppUpdateNotification? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gss_inventory/native")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "appBuildInfo" -> result.success(appBuildInfo())
                    "downloadAndInstallUpdate" -> {
                        val url = call.argument<String>("url").orEmpty()
                        val token = call.argument<String>("bearerToken").orEmpty()
                        val sha256 = call.argument<String>("sha256").orEmpty()
                        downloadAndInstallUpdate(url, token, sha256, result)
                    }
                    "showAssetInventoryNotification" -> {
                        showAssetInventoryNotification(
                            AssetInventoryNotification(
                                assetCode = call.argument<String>("assetCode").orEmpty(),
                                soldierName = call.argument<String>("soldierName").orEmpty(),
                                status = call.argument<String>("status").orEmpty(),
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
                    "setRfidScanEnabled" -> {
                        rfidScanEnabled = call.argument<Boolean>("enabled") == true
                        if (!rfidScanEnabled) {
                            rfidScanKeyDown = false
                            stopRfidInventory()
                        }
                        result.success(null)
                    }
                    "stopRfidScan" -> {
                        rfidScanKeyDown = false
                        stopRfidInventory()
                        result.success(null)
                    }
                    "getRfidPower" -> getRfidPower(result)
                    "setRfidPower" -> {
                        val power = call.argument<Int>("power") ?: rfidMaxPower
                        setRfidPower(power, result)
                    }
                    "openUpdateUrl" -> {
                        val url = call.argument<String>("url").orEmpty()
                        openUpdateUrl(url, result)
                    }
                    else -> result.notImplemented()
                }
            }

        EventChannel(flutterEngine.dartExecutor.binaryMessenger, "gss_inventory/rfid")
            .setStreamHandler(
                object : EventChannel.StreamHandler {
                    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                        rfidSink = events
                        pendingRfidCode?.let {
                            rfidSink?.success(it)
                            pendingRfidCode = null
                        }
                    }

                    override fun onCancel(arguments: Any?) {
                        rfidScanKeyDown = false
                        stopRfidInventory()
                        rfidSink = null
                    }
                },
            )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
    }

    override fun onResume() {
        super.onResume()
    }

    override fun onPause() {
        stopRfidInventory()
        rfidScanKeyDown = false
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onDestroy() {
        releaseRfidReader()
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (isRfidScanKey(event.keyCode)) {
            when (event.action) {
                KeyEvent.ACTION_DOWN -> {
                    if (event.repeatCount == 0) {
                        rfidScanKeyDown = true
                        if (rfidScanEnabled && rfidSink != null) startRfidInventory()
                    }
                    return true
                }
                KeyEvent.ACTION_UP -> {
                    rfidScanKeyDown = false
                    stopRfidInventory()
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != notificationPermissionRequestCode) return
        val statusNotification = pendingAssetInventoryNotification
        val updateNotification = pendingAppUpdateNotification
        pendingAssetInventoryNotification = null
        pendingAppUpdateNotification = null
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            statusNotification?.let { showAssetInventoryNotification(it) }
            updateNotification?.let { showAppUpdateNotification(it) }
        }
    }

    private fun consumeAppUpdateNotificationTap(): Boolean {
        val openedFromUpdateNotification =
            intent?.getBooleanExtra(appUpdateNotificationIntentExtra, false) == true
        intent?.removeExtra(appUpdateNotificationIntentExtra)
        return openedFromUpdateNotification
    }

    private fun startRfidInventory() {
        if (!rfidScanEnabled || rfidSink == null) return
        val reader = ensureRfidReader() ?: return
        if (rfidInventorying || reader.isInventorying()) return
        reader.setInventoryCallback(
            object : IUHFInventoryCallback {
                override fun callback(uhftagInfo: UHFTAGInfo) {
                    val code = rfidCodeFrom(uhftagInfo)
                    if (code.isBlank()) return
                    runOnUiThread { emitRfidCode(code) }
                }
            },
        )
        rfidInventorying = reader.startInventoryTag()
        if (!rfidInventorying) {
            rfidSink?.error("RFID_INVENTORY_FAILED", "Unable to start RFID inventory.", null)
        }
    }

    private fun ensureRfidReader(): RFIDWithUHFUART? {
        if (rfidInitialized) return rfidReader
        return try {
            val reader = rfidReader ?: RFIDWithUHFUART.getInstance().also { rfidReader = it }
            if (!reader.init(this)) {
                rfidSink?.error("RFID_INIT_FAILED", "Unable to initialize the RFID reader.", null)
                return null
            }
            rfidInitialized = true
            reader
        } catch (error: Exception) {
            rfidSink?.error("RFID_CONFIGURATION_FAILED", error.message ?: "RFID reader unavailable.", null)
            null
        }
    }

    private fun getRfidPower(result: MethodChannel.Result) {
        try {
            val reader = ensureRfidReader()
            if (reader == null) {
                result.error("RFID_INIT_FAILED", "Unable to initialize the RFID reader.", null)
                return
            }
            result.success(reader.getPower())
        } catch (error: Exception) {
            result.error("RFID_POWER_READ_FAILED", error.message ?: "Unable to read RFID power.", null)
        }
    }

    private fun setRfidPower(power: Int, result: MethodChannel.Result) {
        val boundedPower = power.coerceIn(rfidMinPower, rfidMaxPower)
        try {
            val reader = ensureRfidReader()
            if (reader == null) {
                result.error("RFID_INIT_FAILED", "Unable to initialize the RFID reader.", null)
                return
            }
            reader.setPower(boundedPower)
            result.success(reader.getPower())
        } catch (error: Exception) {
            result.error("RFID_POWER_WRITE_FAILED", error.message ?: "Unable to set RFID power.", null)
        }
    }

    private fun stopRfidInventory() {
        val reader = rfidReader ?: return
        if (!rfidInventorying && !reader.isInventorying()) return
        try {
            reader.stopInventory()
        } finally {
            rfidInventorying = false
            recentRfidCodes.clear()
        }
    }

    private fun releaseRfidReader() {
        val reader = rfidReader ?: return
        stopRfidInventory()
        try {
            reader.free()
        } finally {
            rfidReader = null
            rfidInitialized = false
            rfidInventorying = false
            rfidScanKeyDown = false
            recentRfidCodes.clear()
        }
    }

    private fun isRfidScanKey(keyCode: Int): Boolean {
        return keyCode in setOf(
            KeyEvent.KEYCODE_F9,
            KeyEvent.KEYCODE_F10,
            KeyEvent.KEYCODE_F11,
            KeyEvent.KEYCODE_F12,
            KeyEvent.KEYCODE_BUTTON_L1,
            KeyEvent.KEYCODE_BUTTON_R1,
            139,
            280,
            291,
            293,
            294,
            311,
            312,
        )
    }

    private fun rfidCodeFrom(tagInfo: UHFTAGInfo): String {
        return listOf(
            tagInfo.getEPC(),
            tagInfo.getTid(),
            tagInfo.getUser(),
        ).firstOrNull { !it.isNullOrBlank() }?.trim().orEmpty()
    }

    private fun emitRfidCode(code: String) {
        if (!rfidScanEnabled || !rfidScanKeyDown || !rfidInventorying) return
        if (!shouldEmitRfidCode(code)) return
        if (rfidSink == null) {
            pendingRfidCode = code
        } else {
            rfidSink?.success(code)
        }
    }

    private fun shouldEmitRfidCode(code: String): Boolean {
        val now = System.currentTimeMillis()
        recentRfidCodes.entries.removeIf { now - it.value > rfidDuplicateWindowMillis }
        val lastSeen = recentRfidCodes[code]
        if (lastSeen != null && now - lastSeen < rfidDuplicateWindowMillis) return false
        recentRfidCodes[code] = now
        return true
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

    private fun showAssetInventoryNotification(inventoryStatus: AssetInventoryNotification) {
        val assetCode = inventoryStatus.assetCode.trim().ifBlank { "Asset" }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            pendingAssetInventoryNotification = inventoryStatus.copy(assetCode = assetCode)
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                notificationPermissionRequestCode,
            )
            return
        }

        createAssetInventoryNotificationChannel()
        val openAppIntent = Intent(this, javaClass).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val pendingIntent = PendingIntent.getActivity(this, 0, openAppIntent, pendingIntentFlags)
        val body = inventoryStatus.bodyText()
        val notification = NotificationCompat.Builder(this, inventoryStatusNotificationChannelId)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setContentTitle("$assetCode status changed")
            .setContentText(body)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(body),
            )
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        NotificationManagerCompat.from(this).notify(inventoryStatus.notificationId(), notification)
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
        val body = "GSS Inventory $displayVersion is ready to install."
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

    private fun createAssetInventoryNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            inventoryStatusNotificationChannelId,
            "Asset inventory",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifications when asset inventory status changes"
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
                val apkFile = File(updateDir, "gss-inventory-update.apk")
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

private data class AssetInventoryNotification(
    val assetCode: String,
    val soldierName: String,
    val status: String,
) {
    fun bodyText(): String {
        val parts = mutableListOf<String>()
        if (soldierName.isNotBlank()) parts += "Assigned to $soldierName"
        if (status.isNotBlank()) parts += "Status $status"
        return if (parts.isEmpty()) {
            "A asset status changed."
        } else {
            parts.joinToString(". ")
        }
    }

    fun notificationId(): Int {
        val positiveHash = assetCode.hashCode().toLong().let { if (it < 0) -it else it }
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

