package com.example.rfidlaundryasset;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.security.crypto.MasterKey;
import androidx.security.crypto.EncryptedSharedPreferences;

import java.io.IOException;
import java.security.GeneralSecurityException;

public class GlobalVariable {
    private static final String PREF_NAME = "secure_app_preferences";
    private static final String KEY_DESTINATION = "destination";
    private static final String KEY_CAMP = "camp";
    private static final String KEY_USERNAME = "username";

    private static SharedPreferences getEncryptedSharedPreferences(Context context)
            throws GeneralSecurityException, IOException {
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
    }

    public static void saveVariable(Context context, boolean value) {
        try {
            SharedPreferences sharedPreferences = getEncryptedSharedPreferences(context);
            sharedPreferences.edit().putBoolean(KEY_DESTINATION, value).apply();
        } catch (GeneralSecurityException | IOException e) {
            Log.e("GlobalVariable", "Error: " + e.getMessage()); // Consider better error handling in production
        }
    }

    public static boolean getVariable(Context context) {
        try {
            SharedPreferences sharedPreferences = getEncryptedSharedPreferences(context);
            return sharedPreferences.getBoolean(KEY_DESTINATION, false);
        } catch (GeneralSecurityException | IOException e) {
            Log.e("GlobalVariable", "Error: " + e.getMessage());
            return false;
        }
    }

    public static void saveCamp(Context context, String campId) {
        try {
            SharedPreferences sharedPreferences = getEncryptedSharedPreferences(context);
            sharedPreferences.edit().putString(KEY_CAMP, campId).apply();
        } catch (GeneralSecurityException | IOException e) {
            Log.e("GlobalVariable", "Error: " + e.getMessage());
        }
    }

    public static String getCamp(Context context) {
        try {
            SharedPreferences sharedPreferences = getEncryptedSharedPreferences(context);
            return sharedPreferences.getString(KEY_CAMP, "");
        } catch (GeneralSecurityException | IOException e) {
            Log.e("GlobalVariable", "Error: " + e.getMessage());
            return "";
        }
    }

    public static void saveUsername(Context context, String username) {
        try {
            SharedPreferences sharedPreferences = getEncryptedSharedPreferences(context);
            sharedPreferences.edit().putString(KEY_USERNAME, username).apply();
        } catch (GeneralSecurityException | IOException e) {
            Log.e("GlobalVariable", "Error: " + e.getMessage());
        }
    }

    public static String getUsername(Context context) {
        try {
            SharedPreferences sharedPreferences = getEncryptedSharedPreferences(context);
            return sharedPreferences.getString(KEY_USERNAME, "");
        } catch (GeneralSecurityException | IOException e) {
            Log.e("GlobalVariable", "Error: " + e.getMessage());
            return "";
        }
    }
}
