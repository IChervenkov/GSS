package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class EditBag extends AppCompatActivity {

    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private AutoCompleteTextView bagAutoCompleteTextView;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private final ArrayList<String> ownerList = new ArrayList<>();
    private final Map<String, Bag> bagInfoMap = new HashMap<>();
    private String oldEpcContent = "";
    private String newEpcContent = "";
    private TextView bagEpcText;
    private EditText bagCodeText;
    private EditText bagTypeText;
    private EditText bagMaxWashText;
    private final ExecutorService executorService = Executors.newFixedThreadPool(3); // Adjust pool size as needed

    private void fetchCsrfToken() {
        Dialog loadingDialog = new Dialog(EditBag.this);
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
                    runOnUiThread(() -> Toast.makeText(EditBag.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(EditBag.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    @SuppressLint("SetTextI18n")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_bag);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        fetchCsrfToken();

        bagAutoCompleteTextView = findViewById(R.id.bagAutoCompleteTextView);
        Button submitButton = findViewById(R.id.editButton);
        bagEpcText = findViewById(R.id.epcTextView);
        bagCodeText = findViewById(R.id.bagCodeEditText);
        bagTypeText = findViewById(R.id.bagTypeEditText);
        bagMaxWashText = findViewById(R.id.bagMaxWashEditText);

        // Fetch bag from the server
        fetchAvailableBag();

        bagAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedBagCode = (String) parent.getItemAtPosition(position);
            Bag selectedBag = bagInfoMap.get(selectedBagCode);

            if (selectedBag != null) {
                oldEpcContent = selectedBag.getId();
                newEpcContent = oldEpcContent;
                bagEpcText.setText("EPC code: " + newEpcContent);
                bagCodeText.setText(selectedBagCode);
                bagTypeText.setText(selectedBag.getType());
                bagMaxWashText.setText(selectedBag.getMaxWash());
            }
        });

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.init();

            Toast.makeText(EditBag.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e("EditBag", "Error: " + e.getMessage());
            Toast.makeText(EditBag.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (newEpcContent.isEmpty()) {
                Toast.makeText(this, "No EPC content detected!", Toast.LENGTH_SHORT).show();
                return;
            }

            String newEpcCode = newEpcContent;
            String oldEpcCode = oldEpcContent;
            String bagCode = bagCodeText.getText().toString().trim();
            String bagType = bagTypeText.getText().toString().trim();
            String bagMaxWash = bagMaxWashText.getText().toString().trim();

            // Validate inputs
            if (isValidText(newEpcCode, "bag EPC code")) return;
            if (isValidText(bagCode, "bag code", "^[a-zA-Z0-9]+$")) return;
            if (isValidText(bagType, "bag type", "^[a-zA-Z0-9\\s]+$")) return;
            if (isValidText(bagMaxWash, "maximum wash number")) return;

            // Send data to server
            sendDataToServer(oldEpcCode, newEpcCode, bagCode, bagType, bagMaxWash);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchCsrfToken();
    }

    // Helper method for text validation
    private boolean isValidText(String input, String fieldName) {
        if (input.isEmpty()) {
            Toast.makeText(this, "Please enter " + fieldName + "!", Toast.LENGTH_SHORT).show();
            return true;
        }
        return false;
    }

    // Overloaded helper method for validation with regex
    private boolean isValidText(String input, String fieldName, String regex) {
        if (input.isEmpty()) {
            Toast.makeText(this, "Please enter " + fieldName + "!", Toast.LENGTH_SHORT).show();
            return true;
        }
        if (!input.matches(regex)) {
            Toast.makeText(this, fieldName + " must only contain valid characters!", Toast.LENGTH_SHORT).show();
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
                executorService.execute(() -> {

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
                            Toast.makeText(EditBag.this, "Server is not active. Cannot start scan.", Toast.LENGTH_SHORT).show();
                        }
                    });
                });
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // Method to check if the server is active
    private boolean isServerActive() throws JSONException {

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl)
                .get()
                .build();

        try {
            Response response = client.newCall(request).execute(); // Reuse the OkHttpClient instance
            return response.isSuccessful();
        } catch (Exception e) {
            Log.e("EditBag", "Error: " + e.getMessage());
            return false;
        }
    }

    // Method to start inventory (scanning)
    private void startInventoryThread() {

        // Start inventory tag reading
        if (rfidReader.startInventoryTag()) {
            isInventory = true;

            while (isInventory && !Thread.currentThread().isInterrupted()) {
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

                newEpcContent = uhftagInfo.getEPC();
                if (newEpcContent != null && !newEpcContent.isEmpty()) {
                    stopInventoryThread(); // Stop the inventory scanning when EPC is found
                    runOnUiThread(() -> updateEpcTextView(newEpcContent)); // Update UI with EPC code
                }
            }

        } else {
            Toast.makeText(EditBag.this, "Failed to start scanning", Toast.LENGTH_SHORT).show();
        }
    }

    // Method to stop the background thread for reading tags
    private void stopInventoryThread() {
        if (isInventory) {
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

    // Method to show the EPC code in a popup window
    private void showPopupWindow(String message) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Error");
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Optionally, reset or perform other actions after closing the dialog
        });
        builder.show();
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendDataToServer(String oldEpcCode, String newEpcContent, String code, String type, String maxcount) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBag.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("oldCode", oldEpcCode);
                payload.put("newCode", newEpcContent);
                payload.put("code", code);
                payload.put("type", type);
                payload.put("maxcount", maxcount);
                payload.put("username", GlobalVariable.getUsername(this));
                payload.put("isValidCode", GlobalVariable.getVariable(this));

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/laundry/editPhoneBag")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .put(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        String responseData = Objects.requireNonNull(response.body()).string();
                        response.body().close(); // Ensure the response is closed

                        JSONObject jsonResponse = new JSONObject(responseData);
                        String message = jsonResponse.optString("message", "Bag has been edited successfully.");
                        runOnUiThread(() -> {
                            Toast.makeText(EditBag.this, message, Toast.LENGTH_SHORT).show();
                            navigateToLaundry();
                        });
                    } else {
                        handleError(response);
                    }
                }
            } catch (Exception e) {
                Log.e("EditBag", "Error: " + e.getMessage());
                runOnUiThread(() -> showPopupWindow("Error sending EPCs to server: " + e.getMessage()));
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private void navigateToLaundry() {
        Intent intent = new Intent(EditBag.this, Laundry.class);
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
            runOnUiThread(() -> showPopupWindow(finalErrorMessage));
        } catch (Exception e) {
            Log.e("EditBag", "Error: " + e.getMessage());
            runOnUiThread(() -> showPopupWindow("Failed to process error response: " + e.getMessage()));
        } finally {
            if (response.body() != null) {
                response.body().close(); // Ensure the response body is closed
            }
        }
    }

    private void fetchAvailableBag() {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBag.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {

            try {

                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/bags?isValidCode=" + GlobalVariable.getVariable(this) + "&campId=" + GlobalVariable.getCamp(this))
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            JSONObject responseJson = new JSONObject(responseData);
                            JSONArray bags = responseJson.getJSONArray("allBags");
                            populateBagAutoComplete(bags);
                        } catch (JSONException e) {
                            Toast.makeText(EditBag.this, "JSON parsing error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    runOnUiThread(() -> Toast.makeText(EditBag.this, "Error fetching data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(EditBag.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private void populateBagAutoComplete(JSONArray bags) throws JSONException {
        ownerList.clear();
        bagInfoMap.clear();

        for (int i = 0; i < bags.length(); i++) {
            JSONObject bag = bags.getJSONObject(i);
            String bagId = bag.getString("id");
            String bagName = bag.getString("name");
            String bagType = bag.getString("type");
            String bagMaxWash = bag.getString("maxcountlandry");
            String bagStatus = bag.getString("status");

            if(bagStatus.equals("None")) {
                ownerList.add(bagName);
                bagInfoMap.put(bagName, new Bag(bagId, bagType, bagMaxWash));
            }
        }

        runOnUiThread(() -> {
            ArrayAdapter<String> adapter = new ArrayAdapter<>(EditBag.this, android.R.layout.simple_dropdown_item_1line, ownerList);
            bagAutoCompleteTextView.setAdapter(adapter);
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly
    }

}