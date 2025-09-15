package com.example.ratefitnescleaning;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.util.Objects;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class Rated extends AppCompatActivity implements CsrfTokenProvider {

    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .addInterceptor(new CsrfInterceptor(this))
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private boolean isValidCode;
    private String selectedEmoji = null;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeoutRunnable = this::onTimeout;

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;

        Network network = cm.getActiveNetwork();
        if (network == null) return true;

        NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
        return capabilities == null ||
                (!capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                        !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) &&
                        !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
    }

    @Override
    public synchronized String getCsrfToken() {
        return csrfToken;
    }

    @Override
    public synchronized void refreshCsrfTokenSync() {

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/csrf-token")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Token error. Please restart the app and try again."));
            }

            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonResponse.optString("message", "Error when fetch token. Please connect to the support.");
                        runOnUiThread(() -> showPopupWindow(serverMessage));
                        return;
                    }

                    csrfToken = jsonResponse.getString("csrfToken");

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Token error. Please restart the app and try again."));
                }
            }
        });
    }

    private void fetchCsrfToken(Runnable onSuccess) {

        if (isNetworkAvailable())
            return;

        Dialog loadingDialog = new Dialog(Rated.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/csrf-token")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Token error. Please connect to the support."));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseBody = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonObject = new JSONObject(responseBody);

                    csrfToken = jsonObject.getString("csrfToken");
                    if (onSuccess != null)
                        runOnUiThread(onSuccess);

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Token error. Please connect to the support."));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_rated);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        fetchCsrfToken(null);

        isValidCode = GlobalVariable.getValidationData(this);

        // Set emoji button click listeners
        findViewById(R.id.btnAngry).setOnClickListener(v -> onEmojiSelected("😡"));
        findViewById(R.id.btnNeutral).setOnClickListener(v -> onEmojiSelected("😐"));
        findViewById(R.id.btnVeryHappy).setOnClickListener(v -> onEmojiSelected("😄"));

        // Start the timeout timer (5 minutes)
        startTimeout();
    }

    private void onEmojiSelected(String emoji) {
        // Cancel the timeout if user selects an emoji
        cancelTimeout();

        // User ID and emoji are ready, now send to server
        selectedEmoji = emoji;
        String soldierId = GlobalVariable.getSoldier(this);
        sendEmojiData(selectedEmoji, soldierId);
    }

    private void sendEmojiData(String emoji, String userId) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performSendEmoji(emoji, userId));
        } else {
            performSendEmoji(emoji, userId);
        }
    }

    // Modify the sendEmojiData method to include modal and clear old data
    private void performSendEmoji(String emoji, String userId) {

        Dialog loadingDialog = new Dialog(Rated.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        JSONObject payload = new JSONObject();
        RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

        try {
            // Prepare the request body
            payload.put("emoji", emoji);
            payload.put("userId", userId);
            payload.put("isValidCode", String.valueOf(isValidCode));

        } catch (Exception ex) {
            runOnUiThread(() -> showPopupWindow("Error when send your data. Please connect to the support."));
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        // Make the request to the server
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/sendEmojiData") // Replace with your endpoint
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when send your data. Please connect to the support."));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try (response) {

                    String responseData = Objects.requireNonNull(response.body()).string();

                    if (!response.isSuccessful()) {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        String serverMessage = jsonResponse.optString("message", "Error when send your data. Please connect to the support.");
                        runOnUiThread(() -> showPopupWindow(serverMessage));
                        return;
                    }

                    // Handle success
                    runOnUiThread(() -> {
                        showSuccessDialog();
                        clearOldData();
                    });

                } catch (IOException | JSONException e) {
                    runOnUiThread(() -> showPopupWindow("Error when send your data. Please connect to the support."));

                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    // Method to show success dialog
    private void showSuccessDialog() {
        new AlertDialog.Builder(Rated.this)
                .setTitle("Success")
                .setMessage("Thank you for your time, your response is important to us")
                .setPositiveButton("OK", (dialog, which) -> {
                    // Do something when OK is clicked (if needed)
                    Intent intent = new Intent(Rated.this, MainActivity.class);
                    finish(); // Close MainActivity
                    startActivity(intent);
                })
                .setCancelable(false)
                .show();
    }

    // Clear old data (clientId and selectedEmoji)
    private void clearOldData() {
        selectedEmoji = null;
    }

    // Start a timeout timer for 5 minutes (300000 milliseconds)
    private void startTimeout() {
        handler.postDelayed(timeoutRunnable, 60000);
    }

    // Cancel the timeout
    private void cancelTimeout() {
        handler.removeCallbacks(timeoutRunnable);
    }

    // Action to take when timeout occurs
    private void onTimeout() {
        Intent intent = new Intent(Rated.this, MainActivity.class);
        startActivity(intent);
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelTimeout();
    }

    private void showPopupWindow(String message) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Error");
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Reset the flag once the error dialog is clos
        });
        builder.show();
    }
}