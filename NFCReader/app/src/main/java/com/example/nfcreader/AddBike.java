package com.example.nfcreader;

import android.annotation.SuppressLint;
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

import org.json.JSONObject;

import java.io.IOException;
import java.util.Objects;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AddBike extends AppCompatActivity {

    private String campId;
    private String username;
    private NfcAdapter nfcAdapter;
    private String nfcContent = "";
    private TextView nfcTextView;
    private EditText bikeNameText;
    private OkHttpClient client;
    private Call currentCall;
    private final DebounceMessageHelper messageHelper = new DebounceMessageHelper(this);

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

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_bike);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        nfcTextView = findViewById(R.id.nfcTextView);
        Button submitButton = findViewById(R.id.addButton);
        Button submitHelmetButton = findViewById(R.id.addHelmetButton);
        bikeNameText = findViewById(R.id.bikeNameEditText);

        // Initialize NFC Adapter
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            messageHelper.showError("NFC is not available on this device.");
            finish();
            return;
        }

        // Handle NFC intents
        handleIntent(getIntent());

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (nfcContent.isEmpty()) {
                messageHelper.showError("Please scans a NFC tag");
                return;
            }

            String bikeName = bikeNameText.getText().toString().trim();

            if (bikeName.isEmpty()) {
                messageHelper.showError("Please enter a bike name!");
                return;
            }

            // Check if bikeName matches the required format
            if (!bikeName.matches("^[0-9]{5}/[A-Za-z\\s]+$")) {
                messageHelper.showError("Please enter a valid bike name (e.g., '12345/Bike Name')!");
                return;
            }

            // Show a confirmation dialog
            new androidx.appcompat.app.AlertDialog.Builder(AddBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to add this bike?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(nfcContent, bikeName, "bikeAddId", "bikeName", "/api/bicycles/addBike"))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });

        submitHelmetButton.setOnClickListener(v -> {
            if (nfcContent.isEmpty()) {
                messageHelper.showError("Please scans a NFC tag");
                return;
            }

            String helmetName = bikeNameText.getText().toString().trim();

            if (helmetName.isEmpty()) {
                messageHelper.showError("Please enter a helmet name!");
                return;
            }

            // Check if bikeName matches the required format
            if (!helmetName.matches("^[0-9]+/[A-Za-z\\s]+$")) {
                messageHelper.showError("Please enter a valid helmet name (e.g., '123/Helmet Name')!");
                return;
            }

            new androidx.appcompat.app.AlertDialog.Builder(AddBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to add this helmet?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(nfcContent, helmetName, "helmetAddId", "helmetName", "/api/bicycles/addHelmet"))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    private void sendDataToServer(String nfcContent, String bikeName, String idEndPoint, String nameEndPoint, String urlEndPoint) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performSendData(nfcContent, bikeName, idEndPoint, nameEndPoint, urlEndPoint);
    }

    private void performSendData(String nfcContent, String bikeName, String idEndPoint, String nameEndPoint, String urlEndPoint) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();

        try {
            jsonData.put(idEndPoint, nfcContent);
            jsonData.put(nameEndPoint, bikeName);
            jsonData.put("username", username);
            jsonData.put("campId", campId);

        } catch (Exception e) {
            messageHelper.showError("There is a problem with send data to the server. Please contact to the support!");
            runOnUiThread(loadingDialog::dismiss); // Dismiss loading dialog on exception
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + urlEndPoint)
                .post(body)
                .build();

        // Use enqueue for asynchronous request
        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("There is a problem with send data to the server. Please contact to the support!");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {

                try {
                    String responseData = response.body().string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        messageHelper.showError(errorMessage);
                        return;
                    }

                    String message = jsonResponse.getString("message");

                    runOnUiThread(() -> {
                        Toast.makeText(AddBike.this, message, Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(AddBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });

                } catch (Exception e) {
                    messageHelper.showError("Error parsing response. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void cancelAllCalls() {
        // Cancel refresh call if active
        Call refreshCall = GlobalVariable.getRefreshCall();
        if (refreshCall != null && !refreshCall.isExecuted()) {
            refreshCall.cancel();
        }

        // Cancel logout call if active
        Call logoutCall = GlobalVariable.getLogoutCall();
        if (logoutCall != null && !logoutCall.isExecuted()) {
            logoutCall.cancel();
        }

        // Cancel current API call if active
        if (currentCall != null && !currentCall.isExecuted()) {
            currentCall.cancel();
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
        cancelAllCalls();
        nfcAdapter.disableForegroundDispatch(this);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelAllCalls();
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