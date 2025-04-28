package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.app.AlertDialog;

import android.app.Dialog;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.widget.EditText;
import android.widget.ImageButton;
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
            showCodeEntryDialog();
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

    private void showCodeEntryDialog() {
        // Create an AlertDialog builder
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Product Code");

        // Create an EditText for user input
        final EditText input = new EditText(this);
        input.setHint("Enter product code");
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT);

        // Add the EditText to the dialog
        builder.setView(input);

        // Set the "OK" button
        builder.setPositiveButton("OK", null); // We'll override the click listener later

        // Set the "Cancel" button
        builder.setNegativeButton("Cancel", (dialog, which) -> {
            finish(); // Close the app
        });

        // Create and show the dialog
        AlertDialog dialog = builder.create();

        // Override "OK" button behavior
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String code = input.getText().toString();
            if (!code.isEmpty()) {
                    checkDataToServer(code, input, dialog);
                    if(isValidCode)
                        dialog.dismiss(); // Close the dialog
            } else {
                input.setError("Code cannot be empty");
            }
        }));

        // Handle dialog dismissal
        dialog.setOnDismissListener(dialogInterface -> {
            // If no code is entered, close the app
            if (!isValidCode) {
                finish(); // Close the app
            }
        });

        dialog.show();
    }

    private void checkDataToServer(String code, EditText input, AlertDialog dialog) {
        executorService.execute(()-> {
            try {

                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("code", code);

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/checkCodeProduct")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        String responseData = Objects.requireNonNull(response.body()).string();
                        JSONObject jsonResponse = new JSONObject(responseData);
                        boolean isValidGetCode = jsonResponse.optBoolean("success", false);
                        GlobalVariable.saveVariable(this, isValidGetCode);

                        runOnUiThread(() -> {
                            if (isValidGetCode) {
                                input.setError(null);
                                dialog.dismiss();
                            } else {
                                input.setError("Invalid product code");
                            }
                        });
                    } else {
                        handleError(response, input);
                    }
                }
            } catch (Exception e) {
                Log.e("MainActivity", "Error: " + e.getMessage());
                runOnUiThread(() -> showPopupWindow("Error sending EPCs to server: " + e.getMessage()));
            }
        });
    }

    private void handleError(Response response, EditText input) {
        try {
            String errorMessage = "Unknown error occurred";
            if (response.body() != null) {
                String responseBody = response.body().string(); // Read response body
                JSONObject errorJson = new JSONObject(responseBody);
                errorMessage = errorJson.optString("message", "Internal server error");
            }
            String finalErrorMessage = errorMessage;
            runOnUiThread(() -> input.setError(finalErrorMessage));
        } catch (Exception e) {
            Log.e("MainActivity", "Error: " + e.getMessage());
            runOnUiThread(() -> input.setError("Failed to process error response: " + e.getMessage()));
        } finally {
            if (response.body() != null) {
                response.body().close(); // Ensure the response body is closed
            }
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

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly
    }

}