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
import android.widget.EditText;
import android.widget.TextView;
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

public class EditBag extends AppCompatActivity {

    private Call currentCall;
    private String campId;
    private String username;
    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private AutoCompleteTextView bagAutoCompleteTextView;
    private OkHttpClient client;
    private final ArrayList<String> ownerList = new ArrayList<>();
    private final Map<String, Bag> bagInfoMap = new HashMap<>();
    private String oldEpcContent = "";
    private String newEpcContent = "";
    private TextView bagEpcText;
    private EditText bagCodeText;
    private EditText bagTypeText;
    private EditText bagMaxWashText;
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

    @SuppressLint("SetTextI18n")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_bag);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

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
            rfidReader.free();
            rfidReader.init();

        } catch (Exception e) {
            messageHelper.showError("Error initializing RFID Reader");
        }

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (newEpcContent.isEmpty()) {
                messageHelper.showError("No EPC content detected!");
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

            new androidx.appcompat.app.AlertDialog.Builder(EditBag.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to edit this bag?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(oldEpcCode, newEpcCode, bagCode, bagType, bagMaxWash))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    // Helper method for text validation
    private boolean isValidText(String input, String fieldName) {
        if (input.isEmpty()) {
            messageHelper.showError("Please enter " + fieldName + "!");
            return true;
        }
        return false;
    }

    // Overloaded helper method for validation with regex
    private boolean isValidText(String input, String fieldName, String regex) {
        if (input.isEmpty()) {
            messageHelper.showError("Please enter " + fieldName + "!");
            return true;
        }
        if (!input.matches(regex)) {
            messageHelper.showError(fieldName + " must only contain valid characters!");
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

                newEpcContent = uhftagInfo.getEPC();
                if (newEpcContent != null && !newEpcContent.isEmpty()) {
                    stopInventoryThread(); // Stop the inventory scanning when EPC is found
                    runOnUiThread(() -> updateEpcTextView(newEpcContent)); // Update UI with EPC code
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
    private void sendDataToServer(String oldEpcCode, String newEpcContent, String code, String type, String maxcount) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performSendData(oldEpcCode, newEpcContent, code, type, maxcount);
    }

    private void performSendData(String oldEpcCode, String newEpcContent, String code, String type, String maxcount) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBag.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject payload = new JSONObject();

        try {
            payload.put("oldCode", oldEpcCode);
            payload.put("newCode", newEpcContent);
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
                .url(baseUrl + "/api/laundry/editPhoneBag")
                .put(body)
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

                    JSONObject jsonResponse = new JSONObject(responseData);
                    String message = jsonResponse.optString("message", "Bag has been edited successfully.");
                    runOnUiThread(() -> {
                        Toast.makeText(EditBag.this, message, Toast.LENGTH_SHORT).show();
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
        Intent intent = new Intent(EditBag.this, Laundry.class);
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
            messageHelper.showError("Failed to process error response");
        } finally {
            response.body().close(); // Ensure the response body is closed
        }
    }

    private void fetchAvailableBag() {

        if (isNetworkAvailable()) {
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBag.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/bags?campId=" + campId)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error when fetch bag data. Please connect to the support!");
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
                    JSONArray bags = responseJson.getJSONArray("allBags");
                    runOnUiThread(() -> populateBagAutoComplete(bags));

                } catch (Exception e) {
                    messageHelper.showError("Error when fetch bag data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateBagAutoComplete(JSONArray bags) {

        try {
            ownerList.clear();
            bagInfoMap.clear();

            for (int i = 0; i < bags.length(); i++) {
                JSONObject bag = bags.getJSONObject(i);
                String bagId = bag.getString("id");
                String bagName = bag.getString("name");
                String bagType = bag.getString("type");
                String bagMaxWash = bag.getString("maxcountlandry");
                String bagStatus = bag.getString("status");

                if (bagStatus.equals("None")) {
                    ownerList.add(bagName);
                    bagInfoMap.put(bagName, new Bag(bagId, bagType, bagMaxWash));
                }
            }

            ArrayAdapter<String> adapter = new ArrayAdapter<>(EditBag.this, android.R.layout.simple_dropdown_item_1line, ownerList);
            bagAutoCompleteTextView.setAdapter(adapter);
        } catch (JSONException e) {
            messageHelper.showError("Invalid bag data from server!");
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