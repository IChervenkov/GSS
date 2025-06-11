package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class Inventory extends AppCompatActivity {

    private RFIDWithUHFUART rfidReader;
    private boolean isScaning = false;
    private boolean isSetRoom = false;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private final ArrayList<String> ownerList = new ArrayList<>();
    private final Map<String, String> locationIdMap = new HashMap<>();
    private AutoCompleteTextView locationAutoCompleteTextView;
    private String csrfToken = null;
    private String curentLocation = null;
    private final List<JSONObject> additionalAssetsArrayList = new ArrayList<>();
    private final ExecutorService executorService = Executors.newFixedThreadPool(3);

    private void fetchCsrfToken() {
        Dialog loadingDialog = new Dialog(Inventory.this);
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
                    runOnUiThread(() -> Toast.makeText(Inventory.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(Inventory.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inventory);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);
        fetchCsrfToken();

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.free();
            rfidReader.init();

            Toast.makeText(Inventory.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e("MainActivity", "Error: " + e.getMessage());
            Toast.makeText(Inventory.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }

        locationAutoCompleteTextView = findViewById(R.id.locationAutoCompleteTextView);

        // Fetch room from the server
        fetchRoom();

        locationAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedLocationInfo = (String) parent.getItemAtPosition(position);

            String selectedLocationId = locationIdMap.get(selectedLocationInfo);
            curentLocation = selectedLocationId;

            TableLayout tableLayout = findViewById(R.id.table_additional_assets);
            tableLayout.removeAllViews();

            isSetRoom = true;
            loadAssetData(selectedLocationId);
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 293) {
            if (isScaning) {
                stopScanningThread();
            } else if(isSetRoom) {
                executorService.execute(() -> runOnUiThread(this::startScanningThread));
            } else {
                Toast.makeText(Inventory.this, "No room selected for inventory.", Toast.LENGTH_SHORT).show();
            }

            return true;
        }

        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Ensures proper shutdown of background tasks
        // Stop inventory and free resources when activity is destroyed
        stopScanningThread();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }

    // Method to stop the background thread for reading tags
    private void stopScanningThread() {
        if (isScaning) {
            isScaning = false;

            if (rfidReader != null) {
                rfidReader.stopInventory();
            }

            runOnUiThread(() ->
                    Toast.makeText(this, "Scanning stopped", Toast.LENGTH_SHORT).show()
            );
        }
    }

    private void startScanningThread() {

        if (rfidReader.startInventoryTag()) {
            isScaning = true;

            runOnUiThread(() ->
                    Toast.makeText(this, "Scanning started", Toast.LENGTH_SHORT).show()
            );

            // Submit the RFID scanning task to the executor
            executorService.execute(() -> {

                final Set<String> invalidEpcSet = Collections.synchronizedSet(new HashSet<>()); // To store invalid EPCs
                final Set<String> scanningEpcSet = Collections.synchronizedSet(new HashSet<>());

                while (isScaning && !Thread.currentThread().isInterrupted()) {
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

                    String epc = uhftagInfo.getEPC();

                    if (epc != null && !epc.isEmpty()) {
                        // Skip invalid EPCs that have already been marked
                        synchronized (invalidEpcSet) {
                            if (invalidEpcSet.contains(epc)) {
                                continue; // Skip rescanning invalid EPC
                            }
                        }

                        // Check if the EPC is already processed
                        synchronized (scanningEpcSet) {
                            if (scanningEpcSet.contains(epc)) {
                                continue; // Skip processing for already handled EPCs
                            }
                        }

                        // Proceed only if EPC passes local validation
                        if (checkAssetCode(epc)) {
                            try {

                                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                                JSONObject jsonPayload = new JSONObject();
                                try {
                                    jsonPayload.put("code", epc);
                                    jsonPayload.put("location", curentLocation);
                                    jsonPayload.put("isValidCode", GlobalVariable.getVariable(this));

                                } catch (JSONException e) {
                                    Log.e("Inventory", "Error: " + e.getMessage());
                                }

                                String jsonData = jsonPayload.toString();
                                RequestBody body = RequestBody.create(jsonData, JSON);

                                String baseUrl = getString(R.string.base_url);
                                Request request = new Request.Builder()
                                        .url(baseUrl + "/checkAndChangeScanningAsset")
                                        .addHeader("X-CSRF-Token", csrfToken)
                                        .post(body)
                                        .build();

                                Response response = client.newCall(request).execute();

                                if (response.isSuccessful()) {
                                    String responseData = Objects.requireNonNull(response.body()).string();
                                    JSONObject jsonResponse = new JSONObject(responseData);
                                    boolean isAdditionalAsset = jsonResponse.getBoolean("isAdditionalAsset");

                                    boolean isNewEpc;
                                    synchronized (scanningEpcSet) {
                                        isNewEpc = scanningEpcSet.add(epc);
                                    }

                                    if (isNewEpc && !isAdditionalAsset) {
                                        runOnUiThread(() -> loadAssetData(curentLocation));

                                    } else if (isNewEpc) {
                                        runOnUiThread(() -> updateAdditionalAssetTable(epc));
                                    }

                                } else {
                                    // Extract the error message from the server response
                                    String errorMessage = "Unknown error";
                                    try {
                                        if (response.body() != null) {
                                            String responseBody = response.body().string();
                                            JSONObject errorJson = new JSONObject(responseBody);
                                            errorMessage = errorJson.optString("message", "Internal server error");
                                        }
                                    } catch (Exception e) {
                                        Log.e("MainActivity", "Error: " + e.getMessage());
                                    }

                                    // Mark the EPC as invalid and skip it in future scans
                                    synchronized (invalidEpcSet) {
                                        invalidEpcSet.add(epc);
                                    }

                                    String finalErrorMessage = errorMessage; // Pass the extracted message to UI thread
                                    runOnUiThread(() -> showPopupWindow(finalErrorMessage));
                                }


                            } catch (Exception e) {
                                Log.e("Inventory", "Error: " + e.getMessage());
                                runOnUiThread(() -> showPopupWindow("Error checking bag code: " + e.getMessage()));

                                // Mark the EPC as invalid and skip it in future scans
                                synchronized (invalidEpcSet) {
                                    invalidEpcSet.add(epc);
                                }
                            }
                        } else {
                            // Mark the EPC as invalid if it fails local validation
                            synchronized (invalidEpcSet) {
                                invalidEpcSet.add(epc);
                            }
                        }
                    }
                }
            });
        } else {
            runOnUiThread(() ->
                    Toast.makeText(Inventory.this, "Failed to start scanning", Toast.LENGTH_SHORT).show()
            );
        }
    }

    private boolean checkAssetCode(String epc) {
        try {
            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
            JSONObject jsonPayload = new JSONObject();
            try {
                jsonPayload.put("assetId", epc);
                jsonPayload.put("isValidCode", GlobalVariable.getVariable(this));
            } catch (JSONException e) {
                Log.e("Inventory", "Error: " + e.getMessage());
            }
            String jsonData = jsonPayload.toString();

            RequestBody body = RequestBody.create(jsonData, JSON);

            String baseUrl = getString(R.string.base_url);
            Request request = new Request.Builder()
                    .url(baseUrl + "/check-asset") // Use the new endpoint
                    .addHeader("X-CSRF-Token", csrfToken)
                    .post(body)
                    .build();

            Response response = client.newCall(request).execute();

            if (response.isSuccessful()) {
                String responseData = Objects.requireNonNull(response.body()).string();
                JSONObject jsonResponse = new JSONObject(responseData);
                return jsonResponse.getBoolean("exists");
            } else {
                // Extract the error message from the server response
                String errorMessage = "Unknown error";
                try {
                    if (response.body() != null) {
                        String responseBody = response.body().string();
                        JSONObject errorJson = new JSONObject(responseBody);
                        errorMessage = errorJson.optString("message", "Internal server error");
                    }
                } catch (Exception e) {
                    Log.e("Inventory", "Error: " + e.getMessage());
                }

                String finalErrorMessage = errorMessage; // Pass the extracted message to UI thread
                runOnUiThread(() -> showPopupWindow(finalErrorMessage));
            }

        } catch (InterruptedIOException e) {
            // Log the error or handle it as needed
            Log.e("Inventory", "Error: " + e.getMessage());
            return false;

        } catch (Exception e) {
            Log.e("Inventory", "Error: " + e.getMessage());
            runOnUiThread(() -> showPopupWindow("Error checking bag code: " + e.getMessage()));
        }

        return false; // Default to false if there's an error
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

    private void fetchRoom() {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(Inventory.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        String url = baseUrl + "/getInventoryLocation?isValidCode=" + GlobalVariable.getVariable(this) + "&campId=" + GlobalVariable.getCamp(this);

        executorService.execute(() -> {
            Request request = new Request.Builder().url(url).build();
            try (Response response = client.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            populateLocationAutoComplete(new JSONArray(responseData));
                        } catch (JSONException e) {
                            Log.e("Inventory", "Error: " + e.getMessage());
                            Toast.makeText(Inventory.this, "JSON Parsing Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        } finally {
                            loadingDialog.dismiss();
                        }
                    });
                } else {
                    runOnUiThread(() -> {
                        loadingDialog.dismiss();
                        Toast.makeText(Inventory.this, "Error fetching inventory data, code: " + response.code(), Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (IOException e) {
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(Inventory.this, "Error fetching location: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private void populateLocationAutoComplete(JSONArray locations) throws JSONException {
        ownerList.clear();
        locationIdMap.clear();

        for (int i = 0; i < locations.length(); i++) {
            JSONObject location = locations.getJSONObject(i);
            String locationId = location.getString("id");
            String locationName = location.getString("nameroom");

            ownerList.add(locationName);
            locationIdMap.put(locationName, locationId);
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, ownerList);
        locationAutoCompleteTextView.setAdapter(adapter);
    }

    private void loadAssetData(String locationId) {

        String baseUrl = getString(R.string.base_url);
        String url = baseUrl + "/assets/getSortedAssets?numRoom=" + locationId
                + "&campId=" + GlobalVariable.getCamp(this)
                + "&isValidCode=" + GlobalVariable.getVariable(this);

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(Inventory.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            Request request = new Request.Builder().url(url).build();
            try (Response response = client.newCall(request).execute()) {
                String responseData = response.body() != null ? response.body().string() : "";

                if (response.isSuccessful() && !responseData.isEmpty()) {
                    try {
                        JSONArray assetsArray = new JSONArray(responseData);
                        runOnUiThread(() -> {
                            loadingDialog.dismiss();
                            updateTableLayout(assetsArray);
                        });
                    } catch (JSONException e) {
                        Log.e("Inventory", "Error: " + e.getMessage());
                        runOnUiThread(() -> {
                            loadingDialog.dismiss();
                            Toast.makeText(Inventory.this, "Error parsing data: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        });
                    }
                } else {
                    runOnUiThread(() -> {
                        loadingDialog.dismiss();
                        Toast.makeText(Inventory.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (IOException e) {
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(Inventory.this, "Error fetching data from server: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private void updateAdditionalAssetTable(String epc) {

        String baseUrl = getString(R.string.base_url);
        String url = baseUrl + "/getDataForAdditionalAsset?assetId=" + epc
                + "&isValidCode=" + GlobalVariable.getVariable(this);

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(Inventory.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            Request request = new Request.Builder().url(url).build();
            try (Response response = client.newCall(request).execute()) {
                String responseData = response.body() != null ? response.body().string() : "";

                if (response.isSuccessful() && !responseData.isEmpty()) {
                    try {
                        JSONObject newObject = new JSONObject(responseData);

                        synchronized (additionalAssetsArrayList) {
                            additionalAssetsArrayList.add(newObject);
                        }

                        runOnUiThread(() -> {
                            loadingDialog.dismiss();
                            updateAdditionalTableLayout(additionalAssetsArrayList);
                        });

                    } catch (JSONException e) {
                        Log.e("Inventory", "JSON Error: " + e.getMessage());
                        runOnUiThread(() -> {
                            loadingDialog.dismiss();
                            Toast.makeText(Inventory.this, "Error parsing data: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        });
                    }
                } else {
                    runOnUiThread(() -> {
                        loadingDialog.dismiss();
                        Toast.makeText(Inventory.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (IOException e) {
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(Inventory.this, "Error fetching additional asset data: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    @SuppressLint("SetTextI18n")
    private void updateAdditionalTableLayout(List<JSONObject> assetsDataArray) {
        try {
            TableLayout tableLayout = findViewById(R.id.table_additional_assets);
            tableLayout.removeAllViews();
            tableLayout.setPadding(0, 0, 0, 10);

            // Table Headers
            TableRow headerRow = new TableRow(this);
            String[] headers = {"Code", "Name", "Location", ""};
            for (String header : headers) {
                TextView tv = new TextView(this);
                tv.setText(header);
                tv.setPadding(16, 16, 16, 16);
                tv.setTypeface(null, Typeface.BOLD);
                tv.setGravity(Gravity.CENTER); // Center alignment
                TableRow.LayoutParams lp = new TableRow.LayoutParams(
                        0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                tv.setLayoutParams(lp);
                headerRow.addView(tv);
            }
            tableLayout.addView(headerRow);

            // Asset Rows
            for (JSONObject asset : assetsDataArray) {
                String assetId = asset.getString("id");
                String assetCode = asset.getString("code");
                String assetName = asset.getString("name_assets");
                String assetLocation = asset.getString("location_name");

                    TableRow row = new TableRow(this);
                    row.setPadding(10, 10, 10, 10);

                    // Code
                    TextView codeView = new TextView(this);
                    codeView.setText(assetCode);
                    codeView.setGravity(Gravity.CENTER);
                    codeView.setLayoutParams(new TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                    row.addView(codeView);

                    // Name
                    TextView nameView = new TextView(this);
                    nameView.setText(assetName);
                    nameView.setGravity(Gravity.CENTER);
                    nameView.setLayoutParams(new TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                    row.addView(nameView);

                    // Location
                    TextView locationView = new TextView(this);
                    locationView.setText(assetLocation);
                    locationView.setGravity(Gravity.CENTER);
                    locationView.setLayoutParams(new TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                    row.addView(locationView);

                    Button changeButton = new Button(this);
                    changeButton.setText("Edit");
                    changeButton.setLayoutParams(new TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                    changeButton.setBackgroundColor(Color.parseColor("#4CAF50")); // Green
                    changeButton.setTextColor(Color.WHITE);
                    row.addView(changeButton);

                    // Handle button click
                    changeButton.setOnClickListener(v -> {

                        if (isScaning) {
                            Toast.makeText(this, "Please stop scanning before relocation asset", Toast.LENGTH_SHORT).show();
                            return;
                        }

                        AlertDialog.Builder builder = new AlertDialog.Builder(this);
                        builder.setTitle("Edit Location");

                        // Create a container layout to hold the AutoCompleteTextView
                        LinearLayout layout = new LinearLayout(this);
                        layout.setOrientation(LinearLayout.VERTICAL);
                        layout.setPadding(50, 40, 50, 10);

                        AutoCompleteTextView input = new AutoCompleteTextView(this);
                        input.setHint("Select Room");

                        // Set adapter for dropdown list
                        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                                android.R.layout.simple_dropdown_item_1line, ownerList);
                        input.setAdapter(adapter);
                        input.setInputType(InputType.TYPE_NULL); // Prevent keyboard
                        input.setFocusable(false);               // Only show dropdown

                        // Show dropdown when clicked
                        input.setOnClickListener(view -> input.showDropDown());

                        // Set default selection based on currentLocation
                        for (Map.Entry<String, String> entry : locationIdMap.entrySet()) {
                            if (entry.getValue().equals(curentLocation)) {
                                input.setText(entry.getKey(), false); // Set default value without filtering
                                break;
                            }
                        }

                        layout.addView(input);
                        builder.setView(layout);

                        // Buttons
                        builder.setPositiveButton("OK", null); // We override later
                        builder.setNegativeButton("Cancel", (dialog, which) -> dialog.cancel());

                        AlertDialog dialog = builder.create();
                        dialog.setOnShowListener(dialogInterface -> {
                            Button okButton = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
                            okButton.setOnClickListener(view -> {
                                String selectedRoom = input.getText().toString();

                                if (locationIdMap.containsKey(selectedRoom)) {
                                    String locationId = locationIdMap.get(selectedRoom);
                                    runOnUiThread(() -> updateAdditionalAssetLocation(assetId, locationId));
                                    dialog.dismiss();
                                } else {
                                    input.setError("Please select a valid room.");
                                }
                            });
                        });

                        dialog.show();

                    });

                    tableLayout.addView(row);
            }
        } catch (JSONException e) {
            Log.e("Inventory", "Error: " + e.getMessage());
            Toast.makeText(this, "Error updating UI: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void updateAdditionalAssetLocation(String assetId, String locationId) {
        executorService.execute(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("id", assetId);
                payload.put("locationId", locationId);
                payload.put("username", GlobalVariable.getUsername(this));
                payload.put("isValidCode", GlobalVariable.getVariable(this));
                payload.put("campId", GlobalVariable.getCamp(this));

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/updateAssetLocation")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        runOnUiThread(() -> {
                            loadAssetData(curentLocation);

                            synchronized (additionalAssetsArrayList) {
                                for (int i = 0; i < additionalAssetsArrayList.size(); i++) {
                                    JSONObject obj = additionalAssetsArrayList.get(i);
                                    if (assetId.equals(obj.optString("id"))) {
                                        additionalAssetsArrayList.remove(i);
                                        break;
                                    }
                                }

                                updateAdditionalTableLayout(new ArrayList<>(additionalAssetsArrayList));
                            }
                        });
                    } else {
                        runOnUiThread(() -> Toast.makeText(Inventory.this, "Cannot update location of this asset", Toast.LENGTH_SHORT).show());
                    }
                } catch (IOException e) {
                    runOnUiThread(() -> Toast.makeText(Inventory.this, "Update failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                }

            } catch (Exception e) {
                Log.e("Inventory", "Error: " + e.getMessage());
                runOnUiThread(() -> Toast.makeText(this, "Error updating asset location: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        });
    }

    @SuppressLint("SetTextI18n")
    private void updateTableLayout(JSONArray assetsArray) {
        try {
            TableLayout tableLayout = findViewById(R.id.table_assets_location);
            tableLayout.removeAllViews();
            tableLayout.setPadding(0, 0, 0, 10);

            // Table Headers
            TableRow headerRow = new TableRow(this);
            String[] headers = {"Status", "Code", "Name", "Quantity", ""};
            for (String header : headers) {
                TextView tv = new TextView(this);
                tv.setText(header);
                tv.setPadding(16, 16, 16, 16);
                tv.setTypeface(null, Typeface.BOLD);
                tv.setGravity(Gravity.CENTER); // Center alignment
                TableRow.LayoutParams lp = new TableRow.LayoutParams(
                        0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                tv.setLayoutParams(lp);
                headerRow.addView(tv);
            }
            tableLayout.addView(headerRow);

            // Asset Rows
            for (int i = 0; i < assetsArray.length(); i++) {
                JSONObject asset = assetsArray.getJSONObject(i);
                String assetStatus = asset.getString("inventory_status");
                String assetId = asset.getString("id");
                String assetCode = asset.getString("code");
                String assetName = asset.getString("name");
                String assetQuantity = asset.getString("quantity");

                TableRow row = new TableRow(this);
                row.setPadding(10, 10, 10, 10);

                ImageView statusIcon = new ImageView(this);
                switch (assetStatus) {
                    case "undiscovered":
                        statusIcon.setImageResource(R.drawable.ic_undiscovered);
                        break;
                    case "discovered":
                        statusIcon.setImageResource(R.drawable.ic_discovered);
                        break;
                    case "edited":
                        statusIcon.setImageResource(R.drawable.ic_edited);
                        break;
                }
                TableRow.LayoutParams iconParams = new TableRow.LayoutParams(
                        0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                iconParams.gravity = Gravity.CENTER;
                statusIcon.setLayoutParams(iconParams);
                row.addView(statusIcon);

                // Code
                TextView codeView = new TextView(this);
                codeView.setText(assetCode);
                codeView.setGravity(Gravity.CENTER);
                codeView.setLayoutParams(new TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                row.addView(codeView);

                // Name
                TextView nameView = new TextView(this);
                nameView.setText(assetName);
                nameView.setGravity(Gravity.CENTER);
                nameView.setLayoutParams(new TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                row.addView(nameView);

                // Quantity
                TextView quantityView = new TextView(this);
                quantityView.setText(assetQuantity);
                quantityView.setGravity(Gravity.CENTER);
                quantityView.setLayoutParams(new TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                row.addView(quantityView);

                Button changeButton = new Button(this);
                changeButton.setText("Edit");
                changeButton.setLayoutParams(new TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                changeButton.setBackgroundColor(Color.parseColor("#4CAF50")); // Green
                changeButton.setTextColor(Color.WHITE);
                row.addView(changeButton);

                // Handle button click
                changeButton.setOnClickListener(v -> {

                    if (isScaning) {
                        Toast.makeText(this, "Please stop scanning before editing quantity", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    AlertDialog.Builder builder = new AlertDialog.Builder(this);
                    builder.setTitle("Edit Quantity");

                    // Input field
                    final EditText input = new EditText(this);
                    input.setInputType(InputType.TYPE_CLASS_NUMBER);
                    input.setText(quantityView.getText().toString());

                    InputFilter minMaxFilter = (source, start, end, dest, dstart, dend) -> {
                        try {
                            String newVal = dest.toString().substring(0, dstart) +
                                    source.toString() +
                                    dest.toString().substring(dend);
                            if (newVal.isEmpty()) return null;

                            int inputVal = Integer.parseInt(newVal);
                            if (inputVal >= 0) {
                                return null;
                            }
                        } catch (NumberFormatException e) {
                            // Ignore
                        }
                        return "";
                    };

                    input.setFilters(new InputFilter[]{minMaxFilter});
                    builder.setView(input);

                    // Buttons
                    builder.setPositiveButton("OK", null); // We override later
                    builder.setNegativeButton("Cancel", (dialog, which) -> dialog.cancel());

                    AlertDialog dialog = builder.create();

                    dialog.setOnShowListener(dlg -> {
                        Button okButton = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
                        okButton.setOnClickListener(view -> {
                            String newQuantity = input.getText().toString().trim();
                            String currentQuantity = quantityView.getText().toString();

                            if (newQuantity.isEmpty()) {
                                input.setError("Quantity cannot be empty");
                            } else if (newQuantity.equals(currentQuantity)) {
                                input.setError("New quantity must be different");
                            } else {
                                EditQuantity(newQuantity, assetId);
                                dialog.dismiss();
                            }
                        });
                    });

                    dialog.show();
                });

                tableLayout.addView(row);
            }
        } catch (JSONException e) {
            Log.e("Inventory", "Error: " + e.getMessage());
            Toast.makeText(this, "Error updating UI: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void EditQuantity(String newQuantity, String assetId) {
        executorService.execute(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("id", assetId);
                payload.put("newQuantity", newQuantity);
                payload.put("username", GlobalVariable.getUsername(this));
                payload.put("isValidCode", GlobalVariable.getVariable(this));
                payload.put("campId", GlobalVariable.getCamp(this));

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/updateAssetQuantity")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        runOnUiThread(() -> loadAssetData(curentLocation));
                    } else {
                        runOnUiThread(() -> Toast.makeText(Inventory.this, "Cannot update quantity of this asset", Toast.LENGTH_SHORT).show());
                    }
                } catch (IOException e) {
                    runOnUiThread(() -> Toast.makeText(Inventory.this, "Update failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                }

            } catch (Exception e) {
                Log.e("Inventory", "Error: " + e.getMessage());
                runOnUiThread(() -> Toast.makeText(this, "Error updating asset quantity: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        });
    }
}