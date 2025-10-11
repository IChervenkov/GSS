package com.example.rfidlaundryasset;

import android.content.Context;

import java.util.UUID;

import okhttp3.Call;

public class GlobalVariable {
    private static final String KEY_AUTHENTICATE_TOKEN = "authenticateToken";
    private static final String KEY_REFRESH_TOKEN = "refreshToken";
    private static final String KEY_CAMP = "camp";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_DEVICE_ID = "device_id";
    private static Call refreshCall;
    private static Call logoutCall;

    public static void setRefreshCall(Call call) {
        refreshCall = call;
    }

    public static Call getRefreshCall() {
        return refreshCall;
    }

    // Store active logout call
    public static void setLogoutCall(Call call) {
        logoutCall = call;
    }

    public static Call getLogoutCall() {
        return logoutCall;
    }

    public static void saveAuthenticateToken(Context context, String authenticateToke) {
        SecurePrefs.putString(context, KEY_AUTHENTICATE_TOKEN, authenticateToke);
    }

    public static String getAuthenticateToken(Context context) {
        return SecurePrefs.getString(context, KEY_AUTHENTICATE_TOKEN, "");
    }

    public static void saveRefreshToken(Context context, String refreshToke) {
        SecurePrefs.putString(context, KEY_REFRESH_TOKEN, refreshToke);
    }

    public static String getRefreshToken(Context context) {
        return SecurePrefs.getString(context, KEY_REFRESH_TOKEN, "");
    }

    public static void saveCamp(Context context, String campId) {
        SecurePrefs.putString(context, KEY_CAMP, campId);
    }

    public static String getCamp(Context context) {
        return SecurePrefs.getString(context, KEY_CAMP, "");
    }

    public static void saveUsername(Context context, String username) {
        SecurePrefs.putString(context, KEY_USERNAME, username);
    }

    public static String getUsername(Context context) {
        return SecurePrefs.getString(context, KEY_USERNAME, "");
    }

    public static String getOrCreateDeviceId(Context context) {
        String deviceId = SecurePrefs.getString(context, KEY_DEVICE_ID, "");
        if (deviceId.isEmpty()) {
            deviceId = UUID.randomUUID().toString();
            SecurePrefs.putString(context, KEY_DEVICE_ID, deviceId);
        }
        return deviceId;
    }
}
