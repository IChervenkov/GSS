package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
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

public class AddBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private String nfcContent = "";
    private TextView nfcTextView;
    private EditText bikeNameText;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;

    private void fetchCsrfToken() {
        Dialog loadingDialog = new Dialog(AddBike.this);
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
                    Toast.makeText(AddBike.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
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
                        runOnUiThread(() -> Toast.makeText(AddBike.this, "Error parsing token", Toast.LENGTH_SHORT).show());
                    }
                } else {
                    runOnUiThread(() -> Toast.makeText(AddBike.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_bike);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        nfcTextView = findViewById(R.id.nfcTextView);
        Button submitButton = findViewById(R.id.addButton);
        Button submitHelmetButton = findViewById(R.id.addHelmetButton);
        bikeNameText = findViewById(R.id.bikeNameEditText);

        // Initialize NFC Adapter
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            Toast.makeText(this, "NFC is not available on this device.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        fetchCsrfToken();

        // Handle NFC intents
        handleIntent(getIntent());

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (!nfcContent.isEmpty()) {
                String bikeName = bikeNameText.getText().toString().trim();

                if (bikeName.isEmpty()) {
                    Toast.makeText(this, "Please enter a name!", Toast.LENGTH_SHORT).show();
                    return;
                }

                // Check if bikeName matches the required format
                if (!bikeName.matches("^[0-9]{5}/[A-Za-z\\s]+$")) {
                    Toast.makeText(this, "Please enter a valid bike name (e.g., '12345/Bike Name')!", Toast.LENGTH_SHORT).show();
                    return;
                }

                sendDataToServer(nfcContent, bikeName);

            } else {
                Toast.makeText(this, "No NFC content detected!", Toast.LENGTH_SHORT).show();
            }
        });

        submitHelmetButton.setOnClickListener(v -> {
            if (!nfcContent.isEmpty()) {
                String helmetName = bikeNameText.getText().toString().trim();

                if (helmetName.isEmpty()) {
                    Toast.makeText(this, "Please enter a name!", Toast.LENGTH_SHORT).show();
                    return;
                }

                // Check if bikeName matches the required format
                if (!helmetName.matches("^[0-9]+/[A-Za-z\\s]+$")) {
                    Toast.makeText(this, "Please enter a valid name (e.g., '123/Helmet Name')!", Toast.LENGTH_SHORT).show();
                    return;
                }

                sendHelmetDataToServer(nfcContent, helmetName);

            } else {
                Toast.makeText(this, "No NFC content detected!", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void sendDataToServer(String nfcContent, String bikeName) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("bikeAddId", nfcContent);
            jsonData.put("bikeName", bikeName);
            jsonData.put("campId", GlobalVariable.getCamp(this));
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));

            RequestBody body = RequestBody.create(jsonData.toString(), JSON);
            String baseUrl = getString(R.string.base_url);
            Request request = new Request.Builder()
                    .url(baseUrl + "/bicycles/addBike")
                    .addHeader("X-CSRF-Token", csrfToken)
                    .post(body)
                    .build();

            // Use enqueue for asynchronous request
            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    runOnUiThread(() -> {
                        Toast.makeText(AddBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        loadingDialog.dismiss(); // Dismiss loading dialog on failure
                    });
                }

                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                    if (response.body() != null) {
                        String responseData = response.body().string();

                        if (response.isSuccessful()) {
                            try {
                                JSONObject jsonResponse = new JSONObject(responseData);
                                String message = jsonResponse.optString("message", "Bike added successfully.");

                                runOnUiThread(() -> {
                                    Toast.makeText(AddBike.this, message, Toast.LENGTH_SHORT).show();
                                    Intent intent = new Intent(AddBike.this, MainActivity.class);
                                    intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(intent);
                                    finish();
                                });
                            } catch (Exception e) {
                                Log.e("AddBike", "Error: " + e.getMessage());
                                runOnUiThread(() -> Toast.makeText(AddBike.this, "Error parsing response", Toast.LENGTH_SHORT).show());
                            }
                        } else {
                            try {
                                JSONObject jsonResponse = new JSONObject(responseData);
                                String error = jsonResponse.optString("message", "Server error occurred.");

                                runOnUiThread(() -> Toast.makeText(AddBike.this, "Error: " + error, Toast.LENGTH_SHORT).show());
                            } catch (Exception e) {
                                Log.e("AddBike", "Error: " + e.getMessage());
                                runOnUiThread(() -> Toast.makeText(AddBike.this, "Error processing response", Toast.LENGTH_SHORT).show());
                            }
                        }
                    } else {
                        runOnUiThread(() -> Toast.makeText(AddBike.this, "Response body is null", Toast.LENGTH_SHORT).show());
                    }

                    runOnUiThread(loadingDialog::dismiss);
                }
            });

        } catch (Exception e) {
            Log.e("AddBike", "Error: " + e.getMessage());
            runOnUiThread(() -> {
                Toast.makeText(AddBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                loadingDialog.dismiss(); // Dismiss loading dialog on exception
            });
        }
    }

    private void sendHelmetDataToServer(String nfcContent, String helmetName) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("helmetAddId", nfcContent);
            jsonData.put("helmetName", helmetName);
            jsonData.put("campId", GlobalVariable.getCamp(this));
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));

            RequestBody body = RequestBody.create(jsonData.toString(), JSON);
            String baseUrl = getString(R.string.base_url);
            Request request = new Request.Builder()
                    .url(baseUrl + "/bicycles/addHelmet")
                    .addHeader("X-CSRF-Token", csrfToken)
                    .post(body)
                    .build();

            // Use enqueue for asynchronous request
            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    runOnUiThread(() -> {
                        Toast.makeText(AddBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        loadingDialog.dismiss(); // Dismiss loading dialog on failure
                    });
                }

                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                    if (response.body() != null) {
                        String responseData = response.body().string();

                        if (response.isSuccessful()) {
                            try {
                                JSONObject jsonResponse = new JSONObject(responseData);
                                String message = jsonResponse.optString("message", "Helmet added successfully.");

                                runOnUiThread(() -> {
                                    Toast.makeText(AddBike.this, message, Toast.LENGTH_SHORT).show();
                                    Intent intent = new Intent(AddBike.this, MainActivity.class);
                                    intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(intent);
                                    finish();
                                });
                            } catch (Exception e) {
                                Log.e("AddBike", "Error: " + e.getMessage());
                                runOnUiThread(() -> Toast.makeText(AddBike.this, "Error parsing response", Toast.LENGTH_SHORT).show());
                            }
                        } else {
                            try {
                                JSONObject jsonResponse = new JSONObject(responseData);
                                String error = jsonResponse.optString("message", "Server error occurred.");

                                runOnUiThread(() -> Toast.makeText(AddBike.this, "Error: " + error, Toast.LENGTH_SHORT).show());
                            } catch (Exception e) {
                                Log.e("AddBike", "Error: " + e.getMessage());
                                runOnUiThread(() -> Toast.makeText(AddBike.this, "Error processing response", Toast.LENGTH_SHORT).show());
                            }
                        }
                    } else {
                        runOnUiThread(() -> Toast.makeText(AddBike.this, "Response body is null", Toast.LENGTH_SHORT).show());
                    }

                    runOnUiThread(loadingDialog::dismiss);
                }
            });

        } catch (Exception e) {
            Log.e("AddBike", "Error: " + e.getMessage());
            runOnUiThread(() -> {
                Toast.makeText(AddBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                loadingDialog.dismiss(); // Dismiss loading dialog on exception
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        Intent intent = new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_MUTABLE);
        IntentFilter[] intentFilters = new IntentFilter[]{};
        nfcAdapter.enableForegroundDispatch(this, pendingIntent, intentFilters, null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        nfcAdapter.disableForegroundDispatch(this);
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    @SuppressLint("SetTextI18n")
    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    private void handleIntent(Intent intent) {
        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag.class);
        if (tag != null) {
            // Get the NFC ID (UID)
            byte[] tagId = tag.getId();
            String nfcId = bytesToHex(tagId);
            nfcContent = nfcId;

            nfcTextView.setText("NFC code: " + nfcId);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }
}