package com.example.rfidlaundryreader;

import android.content.Context;
import android.content.SharedPreferences;

public class GlobalVariable {
    private static final String PREF_NAME = "app_preferences";
    private static final String KEY_DESTINATION = "destination";
    private static final String KEY_PREV_DESTINATION = "prev_destination";
    private static final String KEY_CAMP = "camp";

    /**
     * Save a variable to SharedPreferences.
     */
    public static void saveVariable(Context context, String value) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString(KEY_DESTINATION, value);
        editor.apply();
    }

    /**
     * Get the saved variable from SharedPreferences.
     */
    public static String getVariable(Context context) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return sharedPreferences.getString(KEY_DESTINATION, "No set mode");  // Default value if not found
    }

    /**
     * Save previous destination as well (if needed).
     */
    public static void savePrevDestination(Context context, String prevValue) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString(KEY_PREV_DESTINATION, prevValue);
        editor.apply();
    }

    /**
     * Get the saved previous destination.
     */
    public static String getPrevDestination(Context context) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return sharedPreferences.getString(KEY_PREV_DESTINATION, "None");  // Default value if not found
    }

    /**
     * Save camp as well (if needed).
     */
    public static void saveCamp(Context context, String campId) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putString(KEY_CAMP, campId);
        editor.apply();
    }

    /**
     * Get the saved previous destination.
     */
    public static String getCamp(Context context) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return sharedPreferences.getString(KEY_CAMP, "");  // Default value if not found
    }
}
