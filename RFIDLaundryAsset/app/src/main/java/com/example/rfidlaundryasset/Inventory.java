package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
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

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
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

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class Inventory extends AppCompatActivity implements CsrfTokenProvider {

    private RFIDWithUHFUART rfidReader;
    private boolean isValidCode;
    private boolean shouldStopScanning;
    private String campId;
    private String username;
    private boolean isScaning = false;
    private boolean isSetRoom = false;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .addInterceptor(new CsrfInterceptor(this))
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private final ArrayList<String> ownerList = new ArrayList<>();
    private final Map<String, String> locationIdMap = new HashMap<>();
    private final Map<String, Map<String, String>> sublocationIdMap = new HashMap<>();
    private AutoCompleteTextView locationAutoCompleteTextView;
    private String csrfToken = null;
    private String curentLocation = null;
    private final List<JSONObject> additionalAssetsArrayList = new ArrayList<>();
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

        Dialog loadingDialog = new Dialog(Inventory.this);
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
                runOnUiThread(() -> showPopupWindow("Token error. Please connect to the support."));
                runOnUiThread(loadingDialog::dismiss);
            }

            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseBody = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonObject = new JSONObject(responseBody);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonObject.optString("message", "Error when fetch token. Please connect to the support.");
                        runOnUiThread(() -> showPopupWindow(serverMessage));
                        return;
                    }

                    csrfToken = jsonObject.getString("csrfToken");
                    if (onSuccess != null)
                        runOnUiThread(onSuccess);

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Token error. Please connect to the support."));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inventory);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        isValidCode = GlobalVariable.getVariable(this);
        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        fetchCsrfToken(null);

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.free();
            rfidReader.init();

        } catch (Exception e) {
            showPopupWindow("Error initializing RFID Reader");
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
    protected void onResume() {
        super.onResume();
        fetchCsrfToken(null);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 293) {
            if (isScaning) {
                stopScanningThread();
            } else if (isSetRoom) {
                startScanningThread();
            } else {
                runOnUiThread(() -> showPopupWindow("No room selected for inventory."));
            }

            return true;
        }

        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Ensures proper shutdown of background tasks

        stopScanningThread();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }

    // Method to stop the background thread for reading tags
    private void stopScanningThread() {
        if (isScaning) {
            runOnUiThread(() -> Toast.makeText(this, "Stop scanning", Toast.LENGTH_SHORT).show());
            isScaning = false;

            if (rfidReader != null) {
                rfidReader.stopInventory();
            }
        }
    }

    private void startScanningThread() {

        if(isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if(csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(this::performStartScanning);
        } else {
            performStartScanning();
        }
    }

    private void performStartScanning() {

        if (!rfidReader.startInventoryTag()) {
            runOnUiThread(() -> showPopupWindow("Failed to start scanning. Check if device supports RFID reader"));
            return;
        }

        shouldStopScanning = false;
        runOnUiThread(() -> Toast.makeText(this, "Start scanning", Toast.LENGTH_SHORT).show());

        isScaning = true;

        // Submit the RFID scanning task to the executor
        executorService.execute(() -> {

            final Set<String> processingEpcSet = Collections.synchronizedSet(new HashSet<>());

            while (isScaning && !shouldStopScanning && !Thread.currentThread().isInterrupted()) {
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

                String epc = uhftagInfo.getEPC();
                if (epc == null || epc.isEmpty()) {
                    continue;
                }

                // Skip already invalid EPCs
                if (processingEpcSet.contains(epc)) {
                    continue;
                }

                processingEpcSet.add(epc);

                // Proceed only if EPC passes local validation

                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject jsonPayload = new JSONObject();
                try {
                    jsonPayload.put("code", epc);
                    jsonPayload.put("location", curentLocation);
                    jsonPayload.put("isValidCode", isValidCode);

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when parsing of send data. Please connect to the support"));
                    return;
                }

                String jsonData = jsonPayload.toString();
                RequestBody body = RequestBody.create(jsonData, JSON);

                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/checkAndChangeScanningAsset")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                client.newCall(request).enqueue(new Callback() {
                    @Override
                    public void onFailure(@NonNull Call call, @NonNull IOException e) {
                        runOnUiThread(() -> showPopupWindow("Error when check scanning data. Please connect to the support!"));
                    }

                    @Override
                    public void onResponse(@NonNull Call call, @NonNull Response response) {
                        try {

                            String responseData = Objects.requireNonNull(response.body()).string();

                            if (!response.isSuccessful()) {
                                String errorMessage = "Internal server error";

                                JSONObject errorJson = new JSONObject(responseData);
                                errorMessage = errorJson.optString("message", errorMessage);

                                String globalErrorHeader = response.header("X-Global-Error");
                                if ("true".equalsIgnoreCase(globalErrorHeader)) {
                                    shouldStopScanning = true;
                                }

                                String finalErrorMessage = errorMessage;
                                runOnUiThread(() -> showPopupWindow(finalErrorMessage));

                                if (shouldStopScanning) {
                                    stopScanningThread();
                                }

                                return;
                            }

                            JSONObject jsonResponse = new JSONObject(responseData);
                            boolean isAdditionalAsset = jsonResponse.getBoolean("isAdditionalAsset");

                            if (!isAdditionalAsset) {
                                runOnUiThread(() -> loadAssetData(curentLocation));
                                return;
                            }

                            runOnUiThread(() -> updateAdditionalAssetTable(epc));

                        } catch (Exception e) {
                            runOnUiThread(() -> showPopupWindow("Error when check scanning data. Please connect to the support!"));
                        }
                    }
                });
            }
        });
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

        if (isNetworkAvailable())
            return;

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(Inventory.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        String url = baseUrl + "/getInventoryLocation?isValidCode=" + isValidCode + "&campId=" + campId;
        Request request = new Request.Builder().url(url).build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when fetch location. Please connect to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject errorJson = new JSONObject(responseData);
                        String errorMessage = errorJson.optString("message", "Internal server error");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    JSONObject jsonObject = new JSONObject(responseData);
                    JSONArray locationsArray = jsonObject.getJSONArray("locations");
                    JSONArray sublocationsArray = jsonObject.getJSONArray("sublocations");

                    runOnUiThread(() -> populateLocationAutoComplete(locationsArray));
                    runOnUiThread(() -> populateSublocations(sublocationsArray));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when fetch location. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateLocationAutoComplete(JSONArray locations) {

        try {
            ownerList.clear();
            locationIdMap.clear();

            for (int i = 0; i < locations.length(); i++) {
                JSONObject location = locations.getJSONObject(i);
                String id = location.getString("id");
                String name = location.getString("nameroom");

                ownerList.add(name);
                locationIdMap.put(name, id);
            }

            ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                    android.R.layout.simple_dropdown_item_1line, ownerList);
            locationAutoCompleteTextView.setAdapter(adapter);
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Invalid asset location data from server!"));
        }
    }

    private void populateSublocations(JSONArray keys) {

        try {
            sublocationIdMap.clear();

            for (int i = 0; i < keys.length(); i++) {
                JSONObject k = keys.getJSONObject(i);
                String keyId = k.getString("id");
                String keyName = k.getString("namekey");
                String roomId = k.getString("roomid");

                // Build the nested map: roomId → (keyName → keyId)
                Map<String, String> map = sublocationIdMap.computeIfAbsent(roomId, r -> new HashMap<>());
                map.put(keyName, keyId);
            }
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Invalid asset sub-location data from server!"));
        }
    }

    private void loadAssetData(String locationId) {

        if (isNetworkAvailable())
            return;

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(Inventory.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        String url = baseUrl + "/assets/getSortedAssets?numRoom=" + locationId
                + "&campId=" + campId
                + "&isValidCode=" + isValidCode;

        Request request = new Request.Builder().url(url).build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when load asset data. Please connect to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject errorJson = new JSONObject(responseData);
                        String errorMessage = errorJson.optString("message", "Internal server error");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    JSONArray assetsArray = new JSONArray(responseData);
                    runOnUiThread(() -> updateTableLayout(assetsArray));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when load asset data. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void updateAdditionalAssetTable(String epc) {

        if (isNetworkAvailable())
            return;

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(Inventory.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        String url = baseUrl + "/getDataForAdditionalAsset?assetId=" + epc
                + "&isValidCode=" + isValidCode;
        Request request = new Request.Builder().url(url).build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when update additional asset data. Please connect to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject errorJson = new JSONObject(responseData);
                        String errorMessage = errorJson.optString("message", "Internal server error");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    JSONObject newObject = new JSONObject(responseData);

                    synchronized (additionalAssetsArrayList) {
                        additionalAssetsArrayList.add(newObject);
                    }

                    runOnUiThread(() -> updateAdditionalTableLayout(additionalAssetsArrayList));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when update additional asset data. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
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
                String assetTypeId = asset.getString("type_id");

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
                        runOnUiThread(() -> showPopupWindow("Please stop scanning before relocating asset."));
                        return;
                    }

                    AlertDialog.Builder builder = new AlertDialog.Builder(this);
                    builder.setTitle("Edit Location");

                    // Container for dropdowns
                    LinearLayout container = new LinearLayout(this);
                    container.setOrientation(LinearLayout.VERTICAL);
                    container.setPadding(50, 40, 50, 10);

                    // Room dropdown
                    AutoCompleteTextView input = new AutoCompleteTextView(this);
                    input.setHint("Select Room");
                    input.setInputType(InputType.TYPE_NULL);
                    input.setFocusable(false);
                    input.setOnClickListener(view -> input.showDropDown());

                    ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                            android.R.layout.simple_dropdown_item_1line, ownerList);
                    input.setAdapter(adapter);

                    // Key dropdown
                    AutoCompleteTextView inputKey = new AutoCompleteTextView(this);
                    inputKey.setHint("Select Key");
                    inputKey.setInputType(InputType.TYPE_NULL);
                    inputKey.setFocusable(false);
                    inputKey.setOnClickListener(view -> inputKey.showDropDown());

                    ArrayAdapter<String> adapterKey = new ArrayAdapter<>(this,
                            android.R.layout.simple_dropdown_item_1line, new ArrayList<>());
                    inputKey.setAdapter(adapterKey);

                    // Pre-select current location if available
                    String roomId = null;
                    for (Map.Entry<String, String> entry : locationIdMap.entrySet()) {

                        if (!entry.getValue().equals(curentLocation))
                            continue;

                        input.setText(entry.getKey(), false);
                        roomId = entry.getValue();
                        break;
                    }

                    // Initialize key dropdown for current room
                    if (roomId != null) {
                        Map<String, String> keysForRoom = sublocationIdMap.get(roomId);
                        adapterKey.clear();
                        if (assetTypeId.equals("1")) {
                            adapterKey.addAll(Objects.requireNonNull(keysForRoom).keySet());
                            inputKey.setEnabled(true);
                            inputKey.setHint("Select Key");
                        } else {
                            inputKey.setEnabled(false);
                            inputKey.setText("Select Key");
                        }
                    }

                    // When user selects a different room
                    input.setOnItemClickListener((parent, view, position, id) -> {
                        String selectedRoom = adapter.getItem(position);
                        String selectedRoomId = locationIdMap.get(selectedRoom);

                        Map<String, String> keysForRoom = sublocationIdMap.get(selectedRoomId);
                        adapterKey.clear();

                        if (assetTypeId.equals("1")) {
                            adapterKey.addAll(Objects.requireNonNull(keysForRoom).keySet());
                            inputKey.setEnabled(true);
                            inputKey.setHint("Select Key");
                        } else {
                            inputKey.setEnabled(false);
                            inputKey.setText("Select Key");
                        }
                    });

                    // Add inputs to the dialog
                    container.addView(input);
                    container.addView(inputKey);
                    builder.setView(container);

                    builder.setPositiveButton("OK", null);
                    builder.setNegativeButton("Cancel", (dialog, which) -> dialog.cancel());

                    AlertDialog dialog = builder.create();
                    dialog.setOnShowListener(dialogInterface -> {
                        Button okButton = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
                        okButton.setOnClickListener(view -> {
                            String selectedRoomName = input.getText().toString();

                            if (!locationIdMap.containsKey(selectedRoomName)) {
                                runOnUiThread(() -> input.setError("Please select a valid room."));
                                return;
                            }

                            String locationId = locationIdMap.get(selectedRoomName);

                            if (!inputKey.isEnabled()) {
                                updateAdditionalAssetLocation(assetId, locationId, "");
                                dialog.dismiss();
                                return;
                            }

                            String selectedKeyName = inputKey.getText().toString();
                            Map<String, String> keysForRoom = sublocationIdMap.get(locationId);

                            if (keysForRoom == null || !keysForRoom.containsKey(selectedKeyName)) {
                                runOnUiThread(() -> inputKey.setError("Please select a valid key."));
                                return;
                            }

                            String keyId = keysForRoom.get(selectedKeyName);
                            updateAdditionalAssetLocation(assetId, locationId, keyId);
                            dialog.dismiss();
                        });
                    });

                    dialog.show();
                });

                tableLayout.addView(row);
            }

        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("There is a problem with update additional table data. Please connect to the support!"));
        }
    }

    private void updateAdditionalAssetLocation(String assetId, String locationId, String sublocationId) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performUpdateAdditionalAssetLocation(assetId, locationId, sublocationId));
        } else {
                performUpdateAdditionalAssetLocation(assetId, locationId, sublocationId);
        }
    }

    private void performUpdateAdditionalAssetLocation(String assetId, String locationId, String sublocationId) {

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject payload = new JSONObject();

        try {
            payload.put("id", assetId);
            payload.put("locationId", locationId);
            payload.put("sublocationId", sublocationId);
            payload.put("username", username);
            payload.put("isValidCode", isValidCode);
            payload.put("campId", campId);
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("There is a problem with parsing data in additional asset location table data. Please connect to the support!"));
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/updateAssetLocation")
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("There is a problem with fetch data in additional asset location table data. Please connect to the support!"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = response.body().string();
                    JSONObject responseBody = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = responseBody.optString("message", "Internal server error");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    String message = responseBody.optString("message", "Internal server error");
                    runOnUiThread(() -> Toast.makeText(Inventory.this, message, Toast.LENGTH_SHORT).show());

                    runOnUiThread(() -> loadAssetData(curentLocation));

                    synchronized (additionalAssetsArrayList) {
                        for (int i = 0; i < additionalAssetsArrayList.size(); i++) {
                            JSONObject obj = additionalAssetsArrayList.get(i);
                            if (assetId.equals(obj.optString("id"))) {
                                additionalAssetsArrayList.remove(i);
                                break;
                            }
                        }
                    }

                    runOnUiThread(() -> updateAdditionalTableLayout(new ArrayList<>(additionalAssetsArrayList)));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("There is a problem with fetch data in additional asset location table data. Please connect to the support!"));
                }
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
                        runOnUiThread(() -> showPopupWindow("Please stop scanning before editing quantity"));
                        return;
                    }

                    AlertDialog.Builder builder = new AlertDialog.Builder(this);
                    builder.setTitle("Edit Quantity");

                    // Input field
                    final EditText input = new EditText(this);
                    input.setInputType(InputType.TYPE_CLASS_NUMBER);
                    input.setText(quantityView.getText().toString());

                    InputFilter minMaxFilter = (source, start, end, dest, dstart, dend) -> {

                        String newVal = dest.toString().substring(0, dstart) +
                                source.toString() +
                                dest.toString().substring(dend);

                        if (newVal.isEmpty())
                            return null;

                        int inputVal = Integer.parseInt(newVal);
                        if (inputVal >= 0) {
                            return null;
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

                            if (newQuantity.isEmpty()) {
                                runOnUiThread(() -> input.setError("Quantity cannot be empty"));
                                return;
                            }

                            EditQuantity(newQuantity, assetId);
                            dialog.dismiss();
                        });
                    });

                    dialog.show();
                });

                tableLayout.addView(row);
            }
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("There is a problem with update table data. Please connect to the support!"));
        }
    }

    private void EditQuantity(String newQuantity, String assetId) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performEditQuantity(newQuantity, assetId));
        } else {
            performEditQuantity(newQuantity, assetId);
        }
    }

    private void performEditQuantity(String newQuantity, String assetId) {

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject payload = new JSONObject();

        try {
            payload.put("id", assetId);
            payload.put("newQuantity", newQuantity);
            payload.put("username", username);
            payload.put("isValidCode", isValidCode);
            payload.put("campId", campId);
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Error when parsing of send data. Please connect to the support"));
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/updateAssetQuantity")
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when edit quantity asset. Please connect to the support!"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = response.body().string();
                    JSONObject responseBody = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = responseBody.optString("message", "Internal server error");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    String message = responseBody.optString("message", "Internal server error");
                    runOnUiThread(() -> Toast.makeText(Inventory.this, message, Toast.LENGTH_SHORT).show());
                    runOnUiThread(() -> loadAssetData(curentLocation));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when edit quantity asset. Please connect to the support!"));
                }
            }
        });
    }
}