package com.example.rfidlaundryreader;

import android.content.Context;

public class GlobalVariable {

    private static final String KEY_DESTINATION = "destination";
    private static final String KEY_PREV_DESTINATION = "prev_destination";
    private static final String KEY_CAMP = "camp";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_VALIDATION = "validation";

    public static void saveVariable(Context context, String value) {
        SecurePrefs.putString(context, KEY_DESTINATION, value);
    }

    public static String getVariable(Context context) {
        return SecurePrefs.getString(context, KEY_DESTINATION, "No set mode");
    }

    public static void savePrevDestination(Context context, String prevValue) {
        SecurePrefs.putString(context, KEY_PREV_DESTINATION, prevValue);
    }

    public static String getPrevDestination(Context context) {
        return SecurePrefs.getString(context, KEY_PREV_DESTINATION, "None");
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

    public static void saveValidationData(Context context, boolean validationData) {
        SecurePrefs.putBoolean(context, KEY_VALIDATION, validationData);
    }

    public static boolean getValidationData(Context context) {
        return SecurePrefs.getBoolean(context, KEY_VALIDATION, false);
    }
}
