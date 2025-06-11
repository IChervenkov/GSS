package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.app.AlertDialog;

import android.app.Dialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.text.InputType;
import android.util.Base64;
import android.util.Log;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.net.CookieManager;
import java.net.CookiePolicy;

import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
    private boolean isValidCode;
    private String csrfToken = null;
    private String globalUsername = "";
    private final ExecutorService executorService = Executors.newFixedThreadPool(3); // Adjust pool size as needed

    private void fetchCsrfToken() {
        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            try {
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/csrf-token")
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    String responseBody = response.body().string();
                    JSONObject jsonObject = new JSONObject(responseBody);
                    csrfToken = jsonObject.getString("csrfToken");

                } else {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        fetchCsrfToken();

        isValidCode = GlobalVariable.getVariable(this);

        if(!isValidCode) {
            showLoginDialog();
            return;
        }

        String campId = GlobalVariable.getCamp(this);

        if(campId.isEmpty()) {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show();
            return;
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
        executorService.execute(()-> {
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

                try (Response response = client.newCall(request).execute()) {
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
                }
            } catch (Exception e) {
                Log.e("MainActivity", "Error: " + e.getMessage());
                runOnUiThread(() -> showPopupWindow("Error sending EPCs to server: " + e.getMessage()));
            }
        });
    }

    private void fetchQRCodeFor2FA() {
        executorService.execute(() -> {
            Request request = new Request.Builder()
                    .url(getString(R.string.base_url) + "/2fa-verificated-device")
                    .get()
                    .build();

            try (Response response = client.newCall(request).execute()) {
                String json = Objects.requireNonNull(response.body()).string();
                JSONObject obj = new JSONObject(json);
                String qrBase64 = obj.getString("qrCodeDataURL").split(",")[1]; // remove data:image/png;base64,

                byte[] decodedBytes = Base64.decode(qrBase64, Base64.DEFAULT);
                Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

                runOnUiThread(() -> showQRCodeDialog(bitmap));
            } catch (Exception e) {
                runOnUiThread(() -> showPopupWindow("Failed to load QR code: " + e.getMessage()));
            }
        });
    }

    private void showQRCodeDialog(Bitmap qrBitmap) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Scan QR Code with Google Authenticator");

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);

        ImageView imageView = new ImageView(this);
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
        executorService.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("code", code);

                RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

                Request request = new Request.Builder()
                        .url(getString(R.string.base_url) + "/verify-device")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);
                    boolean success = jsonResponse.optBoolean("success", false);

                    runOnUiThread(() -> {
                        if (success) {
                            GlobalVariable.saveVariable(this, true);
                            GlobalVariable.saveUsername(this, globalUsername);
                            finish();
                        } else {
                            showPopupWindow("Invalid 2FA code.");
                        }
                    });
                }
            } catch (Exception e) {
                runOnUiThread(() -> showPopupWindow("Error verifying 2FA: " + e.getMessage()));
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

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly
    }

}