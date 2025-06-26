package com.example.nfcreader;

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
import android.os.Build;
import android.os.Bundle;

import android.text.InputType;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity {
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private String globalUsername = "";
    private final ExecutorService executorService = Executors.newSingleThreadExecutor(); // Adjust pool size as needed

    private void fetchCsrfToken() {
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
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(MainActivity.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                runOnUiThread(loadingDialog::dismiss); // Always dismiss dialog first

                if (response.isSuccessful() && response.body() != null) {
                    try {
                        String responseBody = response.body().string();
                        JSONObject jsonObject = new JSONObject(responseBody);
                        csrfToken = jsonObject.getString("csrfToken");
                    } catch (JSONException e) {
                        runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error parsing token", Toast.LENGTH_SHORT).show());
                    }
                } else {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            }
        });
    }

    private void checkForUpdate() {
        executorService.execute(() -> {
            try {
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/apk-bike-version")
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

                                if (!currentVersion.equals(latestVersion)) {
                                    runOnUiThread(() -> sendUpdateNotification(apkUrl));
                                }
                            } catch (Exception e) {
                                Log.e("UpdateCheck", "JSON error: " + e.getMessage());
                            }
                        }
                    }
                });
            } catch (Exception e) {
                Log.e("UpdateCheck", "Exception: " + e.getMessage());
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

        fetchCsrfToken();

        boolean isValidCode = GlobalVariable.getVariable(this);

        if(!isValidCode) {
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

        if(campId.isEmpty()) {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show();
            return;
        }

        findViewById(R.id.buttonPage1).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, RentedBike.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonPage2).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, ReturnBike.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonSearchBike).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, SearchBike.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonSearchClient).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, SearchClient.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonAddBike).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, AddBike.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonRemoveBike).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, RemoveBike.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonEditBike).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, EditBike.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonSearchHelmet).setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, SearchHelmet.class);
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
        fetchCsrfToken();
    }

    private void showLoginDialog() {
        // Create an AlertDialog builder
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("\uD83D\uDD12Login");

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
            if (!GlobalVariable.getVariable(this)) {
                finish(); // Close the app if login fails or is canceled
            }
        });

        dialog.show();
    }

    private void checkLoginToServer(EditText usernameInput, EditText passwordInput, String username, String password) {

            try {

                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("username", username);
                payload.put("password", password);

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/checkLogInApp")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                client.newCall(request).enqueue(new Callback() {
                    @Override
                    public void onFailure(@NonNull Call call, @NonNull IOException e) {
                        runOnUiThread(() ->
                                showPopupWindow("Login error: " + e.getMessage())
                        );
                    }

                    @Override
                    public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                        String responseData = Objects.requireNonNull(response.body()).string();
                        try {
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

                        } catch (JSONException e) {
                            runOnUiThread(() -> showPopupWindow("Parsing error: " + e.getMessage()));
                        }
                    }
                });

            } catch (Exception e) {
                Log.e("MainActivity", "Error: " + e.getMessage());
                runOnUiThread(() -> showPopupWindow("Error sending EPCs to server: " + e.getMessage()));
            }
    }

    private void fetchQRCodeFor2FA() {
        Request request = new Request.Builder()
                .url(getString(R.string.base_url) + "/2fa-verificated-device")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Failed to load QR code: " + e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                if (!response.isSuccessful()) {
                    runOnUiThread(() -> showPopupWindow("Failed to load QR code: HTTP " + response.code()));
                    return;
                }

                try {
                    String json = Objects.requireNonNull(response.body()).string();
                    JSONObject obj = new JSONObject(json);
                    String qrBase64 = obj.getString("qrCodeDataURL").split(",")[1]; // remove data:image/png;base64,

                    byte[] decodedBytes = Base64.decode(qrBase64, Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

                    runOnUiThread(() -> showQRCodeDialog(bitmap));
                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error parsing QR code: " + e.getMessage()));
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

        ImageView imageView = new ImageView(this);

        int size = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 250, getResources().getDisplayMetrics()); // 250dp

        LinearLayout.LayoutParams imageParams = new LinearLayout.LayoutParams(size, size);
        imageParams.gravity = Gravity.CENTER;
        imageParams.setMargins(0, 0, 0, 30); // bottom margin for spacing
        imageView.setLayoutParams(imageParams);

        imageView.setImageBitmap(qrBitmap);
        layout.addView(imageView);

        final EditText input = new EditText(this);
        input.setHint("Enter 6-digit code");
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        layout.addView(input);

        builder.setView(layout);

        builder.setPositiveButton("Verify", (dialog, which) -> {
            String code = input.getText().toString().trim();
            if (!code.isEmpty()) {
                verifyTOTPCode(code);
            } else {
                input.setError("Please enter the code");
            }
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void verifyTOTPCode(String code) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("code", code);

            RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

            Request request = new Request.Builder()
                    .url(getString(R.string.base_url) + "/verify-device")
                    .addHeader("X-CSRF-Token", csrfToken)
                    .post(body)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    runOnUiThread(() -> showPopupWindow("Error verifying 2FA: " + e.getMessage()));
                }

                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) {
                    try {
                        String responseData = Objects.requireNonNull(response.body()).string();
                        JSONObject jsonResponse = new JSONObject(responseData);
                        boolean success = jsonResponse.optBoolean("success", false);

                        runOnUiThread(() -> {
                            if (success) {
                                GlobalVariable.saveVariable(MainActivity.this, true);
                                GlobalVariable.saveUsername(MainActivity.this, globalUsername);
                                finish();
                            } else {
                                showPopupWindow("Invalid 2FA code.");
                            }
                        });
                    } catch (Exception e) {
                        runOnUiThread(() -> showPopupWindow("Error parsing response: " + e.getMessage()));
                    }
                }
            });
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Error preparing request: " + e.getMessage()));
        }
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