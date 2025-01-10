package com.example.rfidlaundryasset;

import android.content.Context;
import android.content.SharedPreferences;

public class GlobalVariable {
    private static final String PREF_NAME = "app_preferences";
    private static final String KEY_DESTINATION = "destination";

    /**
     * Save a variable to SharedPreferences.
     */
    public static void saveVariable(Context context, boolean value) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPreferences.edit();
        editor.putBoolean(KEY_DESTINATION, value);
        editor.apply();
    }

    /**
     * Get the saved variable from SharedPreferences.
     */
    public static boolean getVariable(Context context) {
        SharedPreferences sharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return sharedPreferences.getBoolean(KEY_DESTINATION, false);  // Default value if not found
    }
}
