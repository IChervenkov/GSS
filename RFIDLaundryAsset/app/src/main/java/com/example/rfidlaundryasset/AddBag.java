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
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONObject;

import java.io.IOException;
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

public class AddBag extends AppCompatActivity {

    private Call currentCall;
    private String campId;
    private String username;
    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private OkHttpClient client;
    private String epc = "";
    private EditText bagCodeText;
    private EditText bagTypeText;
    private EditText bagMaxWashText;
    private final DebounceMessageHelper messageHelper = new DebounceMessageHelper(this);
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

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
        setContentView(R.layout.activity_add_bag);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        // Initialize OkHttpClient (single instance)
        Button submitButton = findViewById(R.id.addButton);
        bagCodeText = findViewById(R.id.bagCodeEditText);
        bagTypeText = findViewById(R.id.bagTypeEditText);
        bagMaxWashText = findViewById(R.id.bagMaxWashEditText);

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
            // Check for EPC content
            if (epc.isEmpty()) {
                messageHelper.showError("No EPC content detected!");
                return;
            }

            // Retrieve all inputs
            String bagCode = bagCodeText.getText().toString().trim();
            String bagType = bagTypeText.getText().toString().trim();
            String bagMaxWash = bagMaxWashText.getText().toString().trim();

            // Validate inputs
            if (isValidText(bagCode, "Bag code", bagCodeText, "^[a-zA-Z0-9]+$")) return;
            if (isValidText(bagType, "Bag type", bagTypeText, "^[a-zA-Z0-9\\s]+$")) return;
            if (bagMaxWash.isEmpty()) {
                messageHelper.showError("Please enter a maximum wash number!");
                return;
            }

            new androidx.appcompat.app.AlertDialog.Builder(AddBag.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to add this bag?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(epc, bagCode, bagType, bagMaxWash))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    private boolean isValidText(String text, String fieldName, EditText field, String regex) {
        if (text.isEmpty()) {
            field.requestFocus();
            messageHelper.showError("Please enter a " + fieldName + "!");
            return true;
        }

        if (!text.matches(regex)) {
            field.requestFocus();
            messageHelper.showError(fieldName + " is invalid. Please use the correct format!");
            return true;
        }
        return false;
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
        TextView epcTextView = findViewById(R.id.epcTextView); // Get reference to the TextView
        epcTextView.setText("EPC code: " + epcCode); // Set the EPC code as the text of the TextView
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendDataToServer(String epc, String code, String type, String maxcount) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }
        performSendData(epc, code, type, maxcount);
    }

    private void performSendData(String epc, String code, String type, String maxcount) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddBag.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject payload = new JSONObject();

        try {
            payload.put("epc", epc);
            payload.put("code", code);
            payload.put("type", type);
            payload.put("maxcount", maxcount);
            payload.put("username", username);
            payload.put("campId", campId);

        } catch (Exception e) {
            messageHelper.showError("Error to parsed data. Please connect to the support!");
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/laundry/addBag")
                .post(body)
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
                    String message = jsonResponse.optString("message", "Bag has been added successfully.");
                    runOnUiThread(() -> {
                        Toast.makeText(AddBag.this, message, Toast.LENGTH_SHORT).show();
                        navigateToLaundry();
                    });

                } catch (Exception e) {
                    messageHelper.showError("Error when send data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void navigateToLaundry() {
        Intent intent = new Intent(AddBag.this, Laundry.class);
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
        stopInventoryThread();
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