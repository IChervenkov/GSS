package com.example.rfidlaundryasset;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;

import android.app.Dialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Base64;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;

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

public class MainActivity extends AppCompatActivity implements CsrfTokenProvider {

    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .addInterceptor(new CsrfInterceptor(this))
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private boolean isValidCode;
    private String csrfToken = null;
    private String globalUsername = "";

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

        try (Response response = client.newCall(request).execute()) {
            JSONObject jsonObject = new JSONObject(Objects.requireNonNull(response.body()).string());
            csrfToken = jsonObject.getString("csrfToken");
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Token error. Please restart the app and try again."));
        }
    }

    private void fetchCsrfToken(Runnable onSuccess) {

        if (isNetworkAvailable())
            return;

        Dialog loadingDialog = new Dialog(MainActivity.this);
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

            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseBody = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonObject = new JSONObject(responseBody);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonObject.optString("message", "Error when fetch token. Please connect to the support.");
                        runOnUiThread(() -> showPopupWindow(serverMessage));
                        return;
                    }

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

    private void checkForUpdate() {

        if (isNetworkAvailable())
            return;

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/apk-asset-version?isValidCode=" + isValidCode)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Log.e("UpdateCheck", "Error: " + e.getMessage());
            }

            @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                if (response.isSuccessful()) {
                    String resBody = Objects.requireNonNull(response.body()).string();
                    try {
                        JSONObject json = new JSONObject(resBody);
                        String latestVersion = json.getString("version");
                        String apkUrl = json.getString("apkUrl");

                        PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                        String currentVersion = pInfo.versionName;

                        if (!Objects.equals(currentVersion, latestVersion)) {
                            runOnUiThread(() -> sendUpdateNotification(apkUrl));
                        }
                    } catch (Exception e) {
                        runOnUiThread(() -> showPopupWindow("There is a problem with the app update process. Please connect to the support."));
                    } finally {
                        runOnUiThread(loadingDialog::dismiss);
                    }
                }
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    private void sendUpdateNotification(String apkUrl) {
        String channelId = "update_channel";
        String channelName = "App Updates";

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        NotificationChannel channel = new NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH);
        notificationManager.createNotificationChannel(channel);

        Intent intent = new Intent(this, SettingsActivity.class);
        intent.putExtra("apkUrl", apkUrl);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_update) // use your icon
                .setContentTitle("New Version Available")
                .setContentText("Tap to update the app.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        notificationManager.notify(1001, builder.build());
    }

    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        fetchCsrfToken(null);

        isValidCode = GlobalVariable.getVariable(this);

        if (!isValidCode) {
            showLoginDialog();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
            }
        }

        checkForUpdate();

        String campId = GlobalVariable.getCamp(this);

        if (campId.isEmpty()) {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            startActivity(intent);
            Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show();
            finish();
        }

        findViewById(R.id.buttonLaundry).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, Laundry.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonAssets).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, Assets.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonInventory).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, Inventory.class);
            startActivity(intent);
        });

        ImageButton settingsButton = findViewById(R.id.buttonSettings);

        settingsButton.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            startActivity(intent);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchCsrfToken(null);
    }

    private void showLoginDialog() {
        // Create an AlertDialog builder
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("\uD83D\uDD12 Login");

        // Create a LinearLayout to hold the username and password fields
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 40, 50, 10);

        // Username input
        final EditText usernameInput = new EditText(this);
        usernameInput.setHint("Username");
        usernameInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT);
        layout.addView(usernameInput);

        // Password input
        final EditText passwordInput = new EditText(this);
        passwordInput.setHint("Password");
        passwordInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        layout.addView(passwordInput);

        builder.setView(layout);

        // "Login" button
        builder.setPositiveButton("Login", null); // We'll override the click listener later

        // "Cancel" button
        builder.setNegativeButton("Cancel", (dialog, which) -> {
            finish(); // Close the app
        });

        AlertDialog dialog = builder.create();

        // Override "Login" button behavior
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String username = usernameInput.getText().toString().trim();
            String password = passwordInput.getText().toString().trim();

            boolean valid = true;

            if (username.isEmpty()) {
                usernameInput.setError("Username cannot be empty");
                valid = false;
            }

            if (password.isEmpty()) {
                passwordInput.setError("Password cannot be empty");
                valid = false;
            }

            if (valid) {
                checkLoginToServer(usernameInput, passwordInput, username, password);
            }
        }));

        dialog.setOnDismissListener(dialogInterface -> {
            if (!isValidCode) {
                finish(); // Close the app if login fails or is canceled
            }
        });

        dialog.show();
    }

    private void checkLoginToServer(EditText usernameInput, EditText passwordInput, String username, String password) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performLogin(usernameInput, passwordInput, username, password));
        } else {
            performLogin(usernameInput, passwordInput, username, password);
        }
    }

    private void performLogin(EditText usernameInput, EditText passwordInput, String username, String password) {

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject payload = new JSONObject();

        try {
            payload.put("username", username);
            payload.put("password", password);
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Error when parse data. Please connect to the support."));
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/checkLogInApp")
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        client.newCall(request).enqueue(new Callback() {

            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when login. Please connect to the support."));
                runOnUiThread(loadingDialog::dismiss);
            }

            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);
                    boolean isValidLogin = jsonResponse.optBoolean("success", false);
                    boolean isValidUsername = jsonResponse.optBoolean("validUsername", false);

                    runOnUiThread(() -> {
                        if (!isValidUsername) {
                            usernameInput.setError("Invalid username");
                        } else if (!isValidLogin) {
                            passwordInput.setError("Invalid password");
                        } else {
                            globalUsername = username;
                            fetchQRCodeFor2FA();
                        }
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when login. Please connect to the support."));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void fetchQRCodeFor2FA() {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        Request request = new Request.Builder()
                .url(getString(R.string.base_url) + "/2fa-verificated-device")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {

            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Failed to load QR code, Please connect to support!"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String json = Objects.requireNonNull(response.body()).string();
                    JSONObject obj = new JSONObject(json);
                    String qrBase64 = obj.getString("qrCodeDataURL").split(",")[1]; // remove data:image/png;base64,

                    byte[] decodedBytes = Base64.decode(qrBase64, Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

                    runOnUiThread(() -> showQRCodeDialog(bitmap));
                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Failed to load QR code: " + e.getMessage()));
                }
            }
        });
    }

    private void showQRCodeDialog(Bitmap qrBitmap) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Scan QR Code with Authenticator");

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 40, 50, 10);
        layout.setGravity(Gravity.CENTER_HORIZONTAL);

        // QR Image
        ImageView imageView = new ImageView(this);
        int size = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 250, getResources().getDisplayMetrics());
        LinearLayout.LayoutParams imageParams = new LinearLayout.LayoutParams(size, size);
        imageParams.gravity = Gravity.CENTER;
        imageParams.setMargins(0, 0, 0, 30);
        imageView.setLayoutParams(imageParams);
        imageView.setImageBitmap(qrBitmap);
        layout.addView(imageView);

        // Container for 6-digit input
        LinearLayout pinLayout = new LinearLayout(this);
        pinLayout.setOrientation(LinearLayout.HORIZONTAL);
        pinLayout.setGravity(Gravity.CENTER);
        int digitWidth = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 40, getResources().getDisplayMetrics());
        int digitMargin = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 8, getResources().getDisplayMetrics());

        EditText[] digits = new EditText[6];

        // Create the dialog first
        AlertDialog dialog = builder.setView(layout)
                .setNegativeButton("Cancel", null)
                .create();

        for (int i = 0; i < 6; i++) {
            final int index = i;
            digits[i] = new EditText(this);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(digitWidth, LinearLayout.LayoutParams.WRAP_CONTENT);
            params.setMargins(digitMargin, 0, digitMargin, 0);
            digits[i].setLayoutParams(params);
            digits[i].setGravity(Gravity.CENTER);
            digits[i].setInputType(InputType.TYPE_CLASS_NUMBER);
            digits[i].setMaxLines(1);
            digits[i].setFilters(new InputFilter[]{new InputFilter.LengthFilter(1)});
            digits[i].setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
            digits[i].setEms(1);

            // Move focus to next digit and auto-verify
            digits[i].addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {
                }

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {
                }

                @Override
                public void afterTextChanged(Editable s) {
                    if (s.length() == 1 && index < 5) {
                        digits[index + 1].requestFocus();
                    }
                    // If all digits entered, auto-verify
                    StringBuilder code = new StringBuilder();
                    for (EditText d : digits) {
                        if (d.getText().toString().isEmpty()) return;
                        code.append(d.getText().toString());
                    }
                    verifyTOTPCode(code.toString());
                    dialog.dismiss(); // now dialog is accessible
                }
            });

            pinLayout.addView(digits[i]);
        }

        layout.addView(pinLayout);
        dialog.show();
    }

    private void verifyTOTPCode(String code) {

        if(isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if(csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performTOTPVerify(code));
        } else {
            performTOTPVerify(code);
        }
    }

    private void performTOTPVerify(String code) {

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        JSONObject payload = new JSONObject();

        try {
            payload.put("code", code);
        } catch (JSONException e) {
            runOnUiThread(() -> showPopupWindow("Error when parsed. Please connect to support!"));
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(getString(R.string.base_url) + "/verify-device")
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        client.newCall(request).enqueue(new Callback() {

            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error verifying 2FA. Please connect to support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonResponse.optString("message", "Error verifying 2FA. Please connect to support!");
                        runOnUiThread(() -> showPopupWindow(serverMessage));
                        return;
                    }

                    GlobalVariable.saveVariable(MainActivity.this, true);
                    GlobalVariable.saveUsername(MainActivity.this, globalUsername);

                    Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show());

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error verifying 2FA: " + e.getMessage()));
                }
            }
        });
    }

    private void showPopupWindow(String message) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Error");
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Optionally, reset or perform other actions after closing the dialog
        });
        builder.show();
    }

}