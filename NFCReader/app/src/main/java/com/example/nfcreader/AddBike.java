package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;
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

public class AddBike extends AppCompatActivity implements CsrfTokenProvider {

    private boolean isValidCode;
    private String campId;
    private String username;
    private NfcAdapter nfcAdapter;
    private String nfcContent = "";
    private TextView nfcTextView;
    private EditText bikeNameText;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .addInterceptor(new CsrfInterceptor(this))
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;

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
                runOnUiThread(loadingDialog::dismiss);
                runOnUiThread(() -> showPopupWindow("Token error. Please connect to the support."));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    String responseBody = response.body().string();
                    JSONObject jsonObject = new JSONObject(responseBody);

                    csrfToken = jsonObject.getString("csrfToken");
                    if (onSuccess != null)
                        runOnUiThread(onSuccess);

                } catch (JSONException e) {
                    runOnUiThread(() -> showPopupWindow("Token error. Please connect to the support."));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
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

        isValidCode = GlobalVariable.getVariable(this);
        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        nfcTextView = findViewById(R.id.nfcTextView);
        Button submitButton = findViewById(R.id.addButton);
        Button submitHelmetButton = findViewById(R.id.addHelmetButton);
        bikeNameText = findViewById(R.id.bikeNameEditText);

        // Initialize NFC Adapter
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            showPopupWindow("NFC is not available on this device.");
            finish();
            return;
        }

        fetchCsrfToken(null);

        // Handle NFC intents
        handleIntent(getIntent());

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (nfcContent.isEmpty()) {
                showPopupWindow("Please scans a NFC tag");
                return;
            }

            String bikeName = bikeNameText.getText().toString().trim();

            if (bikeName.isEmpty()) {
                showPopupWindow("Please enter a bike name!");
                return;
            }

            // Check if bikeName matches the required format
            if (!bikeName.matches("^[0-9]{5}/[A-Za-z\\s]+$")) {
                showPopupWindow("Please enter a valid bike name (e.g., '12345/Bike Name')!");
                return;
            }

            // Show a confirmation dialog
            new androidx.appcompat.app.AlertDialog.Builder(AddBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to add this bike?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(nfcContent, bikeName))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });

        submitHelmetButton.setOnClickListener(v -> {
            if (nfcContent.isEmpty()) {
                showPopupWindow("Please scans a NFC tag");
                return;
            }

            String helmetName = bikeNameText.getText().toString().trim();

            if (helmetName.isEmpty()) {
                showPopupWindow("Please enter a helmet name!");
                return;
            }

            // Check if bikeName matches the required format
            if (!helmetName.matches("^[0-9]+/[A-Za-z\\s]+$")) {
                showPopupWindow("Please enter a valid helmet name (e.g., '123/Helmet Name')!");
                return;
            }

            new androidx.appcompat.app.AlertDialog.Builder(AddBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to add this helmet?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendHelmetDataToServer(nfcContent, helmetName))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    private void sendDataToServer(String nfcContent, String bikeName) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performSendData(nfcContent, bikeName));
        } else {
            performSendData(nfcContent, bikeName);
        }
    }

    private void performSendData(String nfcContent, String bikeName) {

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
            jsonData.put("username", username);
            jsonData.put("campId", campId);
            jsonData.put("isValidCode", isValidCode);

        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("There is a problem with send data to the server. Please contact to the support!"));
            runOnUiThread(loadingDialog::dismiss); // Dismiss loading dialog on exception
            return;
        }

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
                runOnUiThread(() -> showPopupWindow("There is a problem with send data to the server. Please contact to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {

                try {
                    String responseData = response.body().string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    String message = jsonResponse.optString("message", "Bike added successfully.");

                    runOnUiThread(() -> {
                        Toast.makeText(AddBike.this, message, Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(AddBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error parsing response. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void sendHelmetDataToServer(String nfcContent, String helmetName) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performSendHelmetData(nfcContent, helmetName));
        } else {
            performSendHelmetData(nfcContent, helmetName);
        }
    }

    private void performSendHelmetData(String nfcContent, String helmetName) {

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
            jsonData.put("username", username);
            jsonData.put("campId", campId);
            jsonData.put("isValidCode", isValidCode);

        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("There is a problem with send data to the server. Please contact to the support!"));
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

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
                runOnUiThread(() -> showPopupWindow("There is a problem with send data to the server. Please contact to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {

                try {
                    String responseData = response.body().string();
                    JSONObject jsonResponse = new JSONObject(responseData);
                    String message = jsonResponse.optString("message", "Helmet added successfully.");

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    runOnUiThread(() -> {
                        Toast.makeText(AddBike.this, message, Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(AddBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error parsing response. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();

        fetchCsrfToken(null);

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