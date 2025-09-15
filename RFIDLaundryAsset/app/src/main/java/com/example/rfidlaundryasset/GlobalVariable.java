package com.example.rfidlaundryasset;

import android.content.Context;

public class GlobalVariable {
    private static final String KEY_VALIDATION = "validation";
    private static final String KEY_CAMP = "camp";
    private static final String KEY_USERNAME = "username";

    public static void saveVariable(Context context, boolean validationData) {
        SecurePrefs.putBoolean(context, KEY_VALIDATION, validationData);
    }

    public static boolean getVariable(Context context) {
        return SecurePrefs.getBoolean(context, KEY_VALIDATION, false);
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
}
