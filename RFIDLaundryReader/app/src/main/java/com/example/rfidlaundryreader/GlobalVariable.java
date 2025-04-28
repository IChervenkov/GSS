package com.example.rfidlaundryreader;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.io.IOException;
import java.security.GeneralSecurityException;

public class GlobalVariable {
    private static final String PREF_NAME = "app_preferences";
    private static final String KEY_DESTINATION = "destination";
    private static final String KEY_PREV_DESTINATION = "prev_destination";
    private static final String KEY_CAMP = "camp";

    private static SharedPreferences getEncryptedPrefs(Context context) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            return EncryptedSharedPreferences.create(
                    context,
                    PREF_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (GeneralSecurityException | IOException e) {
            throw new RuntimeException("Failed to initialize EncryptedSharedPreferences", e);
        }
    }

    public static void saveVariable(Context context, String value) {
        SharedPreferences.Editor editor = getEncryptedPrefs(context).edit();
        editor.putString(KEY_DESTINATION, value);
        editor.apply();
    }

    public static String getVariable(Context context) {
        return getEncryptedPrefs(context).getString(KEY_DESTINATION, "No set mode");
    }

    public static void savePrevDestination(Context context, String prevValue) {
        SharedPreferences.Editor editor = getEncryptedPrefs(context).edit();
        editor.putString(KEY_PREV_DESTINATION, prevValue);
        editor.apply();
    }

    public static String getPrevDestination(Context context) {
        return getEncryptedPrefs(context).getString(KEY_PREV_DESTINATION, "None");
    }

    public static void saveCamp(Context context, String campId) {
        SharedPreferences.Editor editor = getEncryptedPrefs(context).edit();
        editor.putString(KEY_CAMP, campId);
        editor.apply();
    }

    public static String getCamp(Context context) {
        return getEncryptedPrefs(context).getString(KEY_CAMP, "");
    }
}
