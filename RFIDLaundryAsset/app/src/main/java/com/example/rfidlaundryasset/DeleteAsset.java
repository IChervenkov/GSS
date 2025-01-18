package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class DeleteAsset extends AppCompatActivity {

    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private ThreadInventory threadInventory;
    private Button submitButton;
    private TextView assetEpcText;
    private OkHttpClient client = new OkHttpClient();
    private Map<String, String> assetInfoMap = new HashMap<>();
    private String epc = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_delete_asset);

        submitButton = findViewById(R.id.deleteButton);
        assetEpcText = findViewById(R.id.epcTextView);

        // Fetch asset from the server
        fetchAllAsset();

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.init();

            // Set the output power to minimum
            rfidReader.setPower(1); // Replace '5' with the actual minimum value defined in the API

            Toast.makeText(DeleteAsset.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(DeleteAsset.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (!epc.isEmpty()) {
                sendDataToServer(epc);

            } else {
                Toast.makeText(this, "No EPC content detected!", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void fetchAllAsset() {
        new Thread(() -> {
            try {

                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();

                payload.put("isValidCode", GlobalVariable.getVariable(this));

                RequestBody body = RequestBody.create(JSON, payload.toString());
                Request request = new Request.Builder()
                        .url("https://bunker.bg/allAssets")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            JSONObject responseJson = new JSONObject(responseData);
                            JSONArray bags = responseJson.getJSONArray("allAssets");
                            populateBagAutoComplete(bags);
                        } catch (JSONException e) {
                            Toast.makeText(DeleteAsset.this, "JSON parsing error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    runOnUiThread(() -> Toast.makeText(DeleteAsset.this, "Error fetching data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(DeleteAsset.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }).start();
    }

    private void populateBagAutoComplete(JSONArray assets) throws JSONException {

        assetInfoMap.clear();

        for (int i = 0; i < assets.length(); i++) {
            JSONObject bag = assets.getJSONObject(i);
            String assetId = bag.getString("id");
            String assetCode = bag.getString("code");

            assetInfoMap.put(assetId, assetCode);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 139 || keyCode == 280 || keyCode == 293) { // KeyCode may vary based on your Chainway device configuration
            if (isInventory) {
                stopInventoryThread();
            } else {
                new Thread(() -> {
                    final boolean serverActive;
                    try {
                        serverActive = isServerActive();
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                    runOnUiThread(() -> {
                        if (serverActive) {
                            startInventoryThread();
                        } else {
                            Toast.makeText(DeleteAsset.this, "Server is not active. Cannot start scan.", Toast.LENGTH_SHORT).show();
                        }
                    });
                }).start();
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // Method to check if the server is active
    private boolean isServerActive() throws JSONException {

        Request request = new Request.Builder()
                .url("https://bunker.bg")
                .get()
                .build();

        try {
            Response response = client.newCall(request).execute(); // Reuse the OkHttpClient instance
            return response.isSuccessful();
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    // Method to start inventory (scanning)
    private void startInventoryThread() {

        // Start inventory tag reading
        if (rfidReader.startInventoryTag()) {
            isInventory = true;
            threadInventory = new ThreadInventory();
            threadInventory.start(); // Start the background thread for reading tags
        } else {
            Toast.makeText(DeleteAsset.this, "Failed to start scanning", Toast.LENGTH_SHORT).show();
        }
    }

    // Background thread for scanning RFID tags
    private class ThreadInventory extends Thread {

        @Override
        public void run() {
            while (isInventory && !Thread.interrupted()) {
                UHFTAGInfo uhftagInfo = rfidReader.readTagFromBuffer();
                if (uhftagInfo == null) {
                    try {
                        Thread.sleep(20);
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
                }

            }
        }
    }

    // Method to stop the background thread for reading tags
    private void stopInventoryThread() {
        if (isInventory) {
            isInventory = false; // Set flag to false to stop the loop in the thread
            if (rfidReader != null) {
                rfidReader.stopInventory(); // Stop the RFID inventory
            }
            if (threadInventory != null) {
                try {
                    threadInventory.interrupt(); // Interrupt the thread to stop it
                    threadInventory = null; // Clean up thread reference
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    // Method to update the TextView with the EPC code
    @SuppressLint("SetTextI18n")
    private void updateEpcTextView(String epcCode) {

        if(assetInfoMap.containsKey(epcCode)) {
            String selectedBag = assetInfoMap.get(epcCode);
            assetEpcText.setText("Asset code: " + selectedBag); // Set the EPC code as the text of the TextView
        } else {
            showPopupWindow("Error", "Asset not found!");
            assetEpcText.setText("Asset code: None");
        }
    }

    // Method to show the EPC code in a popup window
    private void showPopupWindow(String title, String message) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(title);
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Optionally, reset or perform other actions after closing the dialog
        });
        builder.show();
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendDataToServer(String epc) {
        new Thread(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("code", epc);
                payload.put("isValidCode", GlobalVariable.getVariable(this));

                RequestBody body = RequestBody.create(JSON, payload.toString());
                Request request = new Request.Builder()
                        .url("https://bunker.bg/assets/deleteAsset")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful()) {
                    String responseData = response.body().string();
                    response.body().close(); // Ensure the response is closed

                    JSONObject jsonResponse = new JSONObject(responseData);
                    String message = jsonResponse.optString("message", "Asset has been delete successfully.");
                    runOnUiThread(() -> {
                        Toast.makeText(DeleteAsset.this, message, Toast.LENGTH_SHORT).show();
                        navigateToAssets();
                    });
                } else {
                    handleError(response);
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPCs to server: " + e.getMessage()));
            }
        }).start();
    }

    private void navigateToAssets() {
        Intent intent = new Intent(DeleteAsset.this, Assets.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        finish();
    }

    private void handleError(Response response) {
        try {
            String errorMessage = "Unknown error occurred";
            if (response.body() != null) {
                String responseBody = response.body().string(); // Read response body
                JSONObject errorJson = new JSONObject(responseBody);
                errorMessage = errorJson.optString("message", "Internal server error");
            }
            String finalErrorMessage = errorMessage;
            runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
        } catch (Exception e) {
            e.printStackTrace();
            runOnUiThread(() -> showPopupWindow("Error", "Failed to process error response: " + e.getMessage()));
        } finally {
            if (response.body() != null) {
                response.body().close(); // Ensure the response body is closed
            }
        }
    }
}