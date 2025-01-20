package com.example.rfidlaundryasset;

import android.app.AlertDialog;
import android.app.Dialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONException;
import org.json.JSONObject;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AddBag extends AppCompatActivity {

    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private OkHttpClient client; // Reuse a single OkHttpClient instance
    private ThreadInventory threadInventory;
    private String epc;
    private Button submitButton;
    private EditText bagCodeText;
    private EditText bagTypeText;
    private EditText bagMaxWashText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_bag);

        // Initialize OkHttpClient (single instance)
        client = new OkHttpClient();
        submitButton = findViewById(R.id.addButton);
        bagCodeText = findViewById(R.id.bagCodeEditText);
        bagTypeText = findViewById(R.id.bagTypeEditText);
        bagMaxWashText = findViewById(R.id.bagMaxWashEditText);

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.init();

            // Set the output power to minimum
            rfidReader.setPower(1); // Replace '5' with the actual minimum value defined in the API

            Toast.makeText(AddBag.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(AddBag.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (!epc.isEmpty()) {
                String bagCode = bagCodeText.getText().toString().trim();
                String bagType = bagTypeText.getText().toString().trim();
                String bagMaxWash = bagMaxWashText.getText().toString().trim();

                if (bagCode.isEmpty()) {
                    Toast.makeText(this, "Please enter a bag code!", Toast.LENGTH_SHORT).show();
                    return;
                }

                if (!bagCode.matches("^[a-zA-Z0-9]+$")) {
                    Toast.makeText(this, "Bag code must only contain alphanumeric characters!", Toast.LENGTH_SHORT).show();
                    return;
                }

                if (bagType.isEmpty()) {
                    Toast.makeText(this, "Please enter a bag type!", Toast.LENGTH_SHORT).show();
                    return;
                }

                if (!bagType.matches("^[a-zA-Z0-9\\s]+$")) {
                    Toast.makeText(this, "Bag type must only contain alphanumeric characters and spaces!", Toast.LENGTH_SHORT).show();
                    return;
                }

                if (bagMaxWash.isEmpty()) {
                    Toast.makeText(this, "Please enter a maximum wash number!", Toast.LENGTH_SHORT).show();
                    return;
                }

                sendDataToServer(epc, bagCode, bagType, bagMaxWash);

            } else {
                Toast.makeText(this, "No EPC content detected!", Toast.LENGTH_SHORT).show();
            }
        });
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
                            Toast.makeText(AddBag.this, "Server is not active. Cannot start scan.", Toast.LENGTH_SHORT).show();
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
            Toast.makeText(AddBag.this, "Failed to start scanning", Toast.LENGTH_SHORT).show();
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
    private void updateEpcTextView(String epcCode) {
        TextView epcTextView = findViewById(R.id.epcTextView); // Get reference to the TextView
        epcTextView.setText("EPC code: " + epcCode); // Set the EPC code as the text of the TextView
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
    private void sendDataToServer(String epc, String code, String type, String maxcount) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddBag.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        new Thread(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("epc", epc);
                payload.put("code", code);
                payload.put("type", type);
                payload.put("maxcount", maxcount);
                payload.put("isValidCode", GlobalVariable.getVariable(this));

                RequestBody body = RequestBody.create(JSON, payload.toString());
                Request request = new Request.Builder()
                        .url("https://bunker.bg/laundry/addBag")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful()) {
                    String responseData = response.body().string();
                    response.body().close(); // Ensure the response is closed

                    JSONObject jsonResponse = new JSONObject(responseData);
                    String message = jsonResponse.optString("message", "Bag has been added successfully.");
                    runOnUiThread(() -> {
                        Toast.makeText(AddBag.this, message, Toast.LENGTH_SHORT).show();
                        navigateToLaundry();
                    });
                } else {
                    handleError(response);
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPCs to server: " + e.getMessage()));
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        }).start();
    }

    private void navigateToLaundry() {
        Intent intent = new Intent(AddBag.this, Laundry.class);
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