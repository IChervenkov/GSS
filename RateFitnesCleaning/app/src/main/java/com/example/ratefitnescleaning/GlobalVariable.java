package com.example.ratefitnescleaning;

import android.content.Context;

public class GlobalVariable {
    private static final String KEY_SOLDIER = "soldier";
    private static final String KEY_CAMP = "camp";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_VALIDATION = "validation";

    public static void saveSoldier(Context context, String soldierId) {
        SecurePrefs.putString(context, KEY_SOLDIER, soldierId);
    }

    public static String getSoldier(Context context) {
        return SecurePrefs.getString(context, KEY_SOLDIER, "None");
    }

    public static void saveCamp(Context context, String campId) {
        SecurePrefs.putString(context, KEY_CAMP, campId);
    }

    public static String getCamp(Context context) {
        return SecurePrefs.getString(context, KEY_CAMP, "");
    }

    public static void saveValidationData(Context context, boolean validationData) {
        SecurePrefs.putBoolean(context, KEY_VALIDATION, validationData);
    }

    public static boolean getValidationData(Context context) {
        return SecurePrefs.getBoolean(context, KEY_VALIDATION, false);
    }

    public static void saveUsername(Context context, String username) {
        SecurePrefs.putString(context, KEY_USERNAME, username);
    }

    public static String getUsername(Context context) {
        return SecurePrefs.getString(context, KEY_USERNAME, "");
    }
}
