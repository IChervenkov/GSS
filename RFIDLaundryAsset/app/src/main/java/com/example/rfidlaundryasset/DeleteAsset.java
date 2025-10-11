package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.view.KeyEvent;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class DeleteAsset extends AppCompatActivity {

    private Call currentCall;
    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private String campId;
    private String username;
    private OkHttpClient client;
    private final Map<String, String> assetInfoMap = new HashMap<>();
    private final Map<String, String> reversAssetInfoMap = new HashMap<>();
    private final ArrayList<String> assetList = new ArrayList<>();
    private String epc = "";
    private AutoCompleteTextView assetTextList;
    private final DebounceMessageHelper messageHelper = new DebounceMessageHelper(this);
    private final ExecutorService executorService = Executors.newSingleThreadExecutor(); // Adjust pool size as needed

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
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_delete_asset);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        Button submitButton = findViewById(R.id.deleteButton);
        assetTextList = findViewById(R.id.assetTextList);

        // Fetch asset from the server
        fetchAllAsset();

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.free();
            rfidReader.init();

        } catch (Exception e) {
            messageHelper.showError("Error initializing RFID Reader");
        }

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (epc.isEmpty()) {
                messageHelper.showError("No EPC content detected!");
                return;
            }
            new androidx.appcompat.app.AlertDialog.Builder(DeleteAsset.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to remove this asset?")
                    .setPositiveButton("Yes", (dialog, which) -> {
                        sendDataToServer(epc);  // Proceed with submission
                    })
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    private void fetchAllAsset() {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(DeleteAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/allAssets?campId=" + campId)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error when fetch asset data. Please connect to the support!");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    if (!response.isSuccessful()) {
                        handleError(response);
                        return;
                    }

                    final String responseData = response.body().string();
                    JSONObject responseJson = new JSONObject(responseData);

                    JSONArray assets = responseJson.getJSONArray("allAssets");
                    runOnUiThread(() -> populateAssetAutoComplete(assets));

                } catch (Exception e) {
                    messageHelper.showError("Error when fetch asset data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateAssetAutoComplete(JSONArray assets) {

        try {
            assetList.clear();
            assetInfoMap.clear();
            reversAssetInfoMap.clear();

            for (int i = 0; i < assets.length(); i++) {
                JSONObject bag = assets.getJSONObject(i);
                String assetId = bag.getString("id");
                String assetCode = bag.getString("code");

                assetList.add(assetCode);
                assetInfoMap.put(assetCode, assetId);
                reversAssetInfoMap.put(assetId, assetCode);
            }

            ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, assetList);
            assetTextList.setAdapter(adapter);

            assetTextList.setOnItemClickListener((parent, view, position, id) -> {
                String selectedAssetCode = (String) parent.getItemAtPosition(position);
                epc = assetInfoMap.get(selectedAssetCode);
                assetTextList.setText(selectedAssetCode);
            });
        } catch (JSONException e) {
            messageHelper.showError("Invalid asset data from server!");
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 139 || keyCode == 280 || keyCode == 293) { // KeyCode may vary based on your Chainway device configuration
            if (isInventory) {
                stopInventoryThread();
            } else {
                startInventoryThread();
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // Method to start inventory (scanning)
    private void startInventoryThread() {

        // Start inventory tag reading
        if (!rfidReader.startInventoryTag()) {
            messageHelper.showError("Failed to start scanning. Check if device supports RFID reader");
            return;
        }

        isInventory = true;
        runOnUiThread(() -> Toast.makeText(this, "Start scanning", Toast.LENGTH_SHORT).show());

        executorService.execute(() -> {

            while (isInventory && !Thread.currentThread().isInterrupted()) {
                UHFTAGInfo uhftagInfo = rfidReader.readTagFromBuffer();
                if (uhftagInfo == null) {
                    try {
                        Thread.sleep(50);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt(); // Properly interrupt the thread
                        break;
                    }
                    continue;
                }

                epc = uhftagInfo.getEPC();
                if (epc != null && !epc.isEmpty()) {
                    stopInventoryThread(); // Stop the inventory scanning when EPC is found
                    runOnUiThread(() -> updateEpcTextView(epc)); // Update UI with EPC code
                    break;
                }
            }
        });
    }

    // Method to stop the background thread for reading tags
    private void stopInventoryThread() {
        if (isInventory) {
            runOnUiThread(() -> Toast.makeText(this, "Stop scanning", Toast.LENGTH_SHORT).show());
            isInventory = false; // Set flag to false to stop the loop in the thread
            if (rfidReader != null) {
                rfidReader.stopInventory(); // Stop the RFID inventory
            }
        }
    }

    // Method to update the TextView with the EPC code
    @SuppressLint("SetTextI18n")
    private void updateEpcTextView(String epcCode) {
        String codeAsset = reversAssetInfoMap.get(epcCode);
        assetTextList.setText(codeAsset);
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendDataToServer(String epc) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performSendData(epc);
    }

    private void performSendData(String epc) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(DeleteAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject payload = new JSONObject();

        try {
            payload.put("code", epc);
            payload.put("campId", campId);
            payload.put("username", username);

        } catch (Exception e) {
            messageHelper.showError("Error to parsed data. Please connect to the support!");
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/assets/deleteAsset")
                .delete(body)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error when send data. Please connect to the support!");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    if (!response.isSuccessful()) {
                        handleError(response);
                        return;
                    }

                    String responseData = Objects.requireNonNull(response.body()).string();
                    response.body().close(); // Ensure the response is closed

                    JSONObject jsonResponse = new JSONObject(responseData);
                    String message = jsonResponse.optString("message", "Asset has been delete successfully.");
                    runOnUiThread(() -> {
                        Toast.makeText(DeleteAsset.this, message, Toast.LENGTH_SHORT).show();
                        navigateToAssets();
                    });

                } catch (Exception e) {
                    messageHelper.showError("Error when send data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void navigateToAssets() {
        Intent intent = new Intent(DeleteAsset.this, Assets.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        finish();
    }

    private void handleError(Response response) {
        try {
            String errorMessage;
            String responseBody = response.body().string(); // Read response body
            JSONObject errorJson = new JSONObject(responseBody);
            errorMessage = errorJson.optString("message", "Internal server error");
            String finalErrorMessage = errorMessage;
            messageHelper.showError(finalErrorMessage);
        } catch (Exception e) {
            messageHelper.showError("Failed to process error response. Please connect to the support!");
        } finally {
            response.body().close(); // Ensure the response body is closed
        }
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
    protected void onPause() {
        super.onPause();
        cancelAllCalls();
        executorService.shutdown();
        stopInventoryThread();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelAllCalls();
        executorService.shutdown();
        stopInventoryThread();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }
}