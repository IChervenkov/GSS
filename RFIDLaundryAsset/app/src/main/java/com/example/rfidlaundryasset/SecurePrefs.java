package com.example.nfcreader;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class SecurePrefs {

    private static final String PREF_NAME = "secure_prefs";
    private static final String KEY_ALIAS = "MyAESKeyAlias";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";

    private static SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (keyStore.containsAlias(KEY_ALIAS)) {
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null);
            return entry.getSecretKey();
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
        );
        keyGenerator.init(
                new KeyGenParameterSpec.Builder(KEY_ALIAS,
                        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .setRandomizedEncryptionRequired(true)
                        .build()
        );
        return keyGenerator.generateKey();
    }

    public static void putString(Context context, String key, String value) {
        try {
            SecretKey secretKey = getOrCreateKey();

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

            String ivStr = Base64.getEncoder().encodeToString(iv);
            String encStr = Base64.getEncoder().encodeToString(encrypted);

            context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(key, ivStr + ":" + encStr)
                    .apply();

        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    public static String getString(Context context, String key, String defValue) {
        try {
            String stored = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                    .getString(key, null);
            if (stored == null) return defValue;

            String[] parts = stored.split(":");
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] encrypted = Base64.getDecoder().decode(parts[1]);

            SecretKey secretKey = getOrCreateKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(128, iv));

            byte[] decrypted = cipher.doFinal(encrypted);
            return new String(decrypted, StandardCharsets.UTF_8);

        } catch (Exception e) {
            return defValue; // if decryption fails
        }
    }

    public static void putBoolean(Context context, String key, boolean value) {
        putString(context, key, value ? "1" : "0");
    }

    public static boolean getBoolean(Context context, String key, boolean defValue) {
        String str = getString(context, key, defValue ? "1" : "0");
        return "1".equals(str);
    }
}
