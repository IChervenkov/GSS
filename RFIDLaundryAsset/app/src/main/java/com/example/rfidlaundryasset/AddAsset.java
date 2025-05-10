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
import android.widget.Spinner;
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

public class AddAsset extends AppCompatActivity {

    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private String epc = "";
    private EditText assetCodeText;
    private EditText assetNameText;
    private final ArrayList<String> typeList = new ArrayList<>();
    private final Map<String, String> typeIdMap = new HashMap<>();
    private String typeAssetId = "";
    private String locationAssetId = "";
    private String subLocationAssetId = "";
    private AutoCompleteTextView assetTypeTextList;
    private AutoCompleteTextView assetLocationText;
    private AutoCompleteTextView assetSubLocationText;
    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private Spinner assetExpandableText;
    private EditText assetCategoriesText;
    private EditText assetQuantityText;
    private EditText assetMrahText;
    private EditText assetOwnerText;
    private Spinner assetStatusText;
    private EditText assetDescriptionText;
    private final ExecutorService executorService = Executors.newFixedThreadPool(3); // Adjust pool size as needed

    private void fetchCsrfToken() {
        Dialog loadingDialog = new Dialog(AddAsset.this);
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
                    runOnUiThread(() -> Toast.makeText(AddAsset.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(AddAsset.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_asset);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        fetchCsrfToken();

        // Initialize OkHttpClient (single instance)
        Button submitButton = findViewById(R.id.addButton);
        assetCodeText = findViewById(R.id.assetCodeText);
        assetNameText = findViewById(R.id.assetNameText);
        assetTypeTextList = findViewById(R.id.assetTypeAutoCompleteTextView);
        assetLocationText = findViewById(R.id.assetLocationAutoCompleteTextView);
        assetSubLocationText = findViewById(R.id.assetSubLocationAutoCompleteTextView);
        assetCategoriesText = findViewById(R.id.assetCategoriesText);
        assetExpandableText = findViewById(R.id.assetExpandableText);
        assetQuantityText = findViewById(R.id.assetQuantityText);
        assetMrahText = findViewById(R.id.assetMrahText);
        assetOwnerText = findViewById(R.id.assetOwnerText);
        assetStatusText = findViewById(R.id.assetStatusText);
        assetDescriptionText = findViewById(R.id.assetDescriptionText);

        assetSubLocationText.setEnabled(false);

        // Create an ArrayAdapter using the string array and a default spinner layout
        ArrayAdapter<CharSequence> adapter = ArrayAdapter.createFromResource(
                this,
                R.array.asset_expandable_options,
                android.R.layout.simple_spinner_item
        );

        // Specify the layout to use when the list of choices appears
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);

        // Apply the adapter to the spinner
        assetExpandableText.setAdapter(adapter);
        assetExpandableText.setSelection(0);

        // Create an ArrayAdapter using the string array and a default spinner layout
        ArrayAdapter<CharSequence> adapter_status = ArrayAdapter.createFromResource(
                this,
                R.array.asset_status_options,
                android.R.layout.simple_spinner_item
        );

        // Specify the layout to use when the list of choices appears
        adapter_status.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);

        // Apply the adapter to the spinner
        assetStatusText.setAdapter(adapter_status);
        assetStatusText.setSelection(0);

        // Fetch asset type from the server
        fetchAssetType();

        // Fetch asset location from the server
        fetchAssetLocation();

        assetTypeTextList.setOnItemClickListener((parent, view, position, id) -> {
            String selectedTypeCode = (String) parent.getItemAtPosition(position);
            String selectedBag = typeIdMap.get(selectedTypeCode);

            if (selectedBag != null) {
                typeAssetId = selectedBag;
                assetTypeTextList.setText(selectedTypeCode);

                if (!"1".equals(selectedBag)) {
                    // Disable the assetSubLocationText view
                    assetSubLocationText.setEnabled(false);
                    assetSubLocationText.setText(""); // Optionally clear its text
                    subLocationAssetId = "";
                } else {
                    // Enable the assetSubLocationText view
                    assetSubLocationText.setEnabled(true);
                }
            }
        });

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.init();

            Toast.makeText(AddAsset.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e("AddAsset", "Error: " + e.getMessage());
            Toast.makeText(AddAsset.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (epc.isEmpty()) {
                Toast.makeText(this, "No EPC content detected!", Toast.LENGTH_SHORT).show();
                return;
            }

            // Retrieve all inputs
            String assetCode = assetCodeText.getText().toString().trim();
            String assetName = assetNameText.getText().toString().trim();
            String assetType = typeAssetId;
            String assetLocation = locationAssetId;
            String assetSubLocation = subLocationAssetId;
            String assetCategory = assetCategoriesText.getText().toString().trim();
            String assetExpandable = assetExpandableText.getSelectedItem().toString().trim();
            String assetQuantity = assetQuantityText.getText().toString().trim();
            String assetMrah = assetMrahText.getText().toString().trim();
            String assetOwner = assetOwnerText.getText().toString().trim();
            String assetStatus = assetStatusText.getSelectedItem().toString().trim();
            String assetDescription = assetDescriptionText.getText().toString().trim();

            // Validation
            if (isValidText(assetCode, "Asset code", assetCodeText, "^[a-zA-Z0-9]+$")) return;
            if (isValidText(assetName, "Asset name", assetNameText, "^[a-zA-Z0-9\\s]+$")) return;
            if (isValidSelection(assetType, "asset type")) return;
            if (isValidSelection(assetLocation, "asset location")) return;
            if (assetSubLocationText.isEnabled() && assetSubLocation.isEmpty()) {
                assetSubLocationText.requestFocus();
                Toast.makeText(this, "Please select an asset sub-location!", Toast.LENGTH_SHORT).show();
                return;
            }
            if (isValidText(assetCategory, "Asset category", assetCategoriesText, "^[a-zA-Z\\s]+$")) return;
            if (assetExpandable.isEmpty()) {
                Toast.makeText(this, "Please select a asset expandable", Toast.LENGTH_SHORT).show();
                return;
            }
            if (isValidText(assetQuantity, "Asset quantity", assetQuantityText, "^[0-9]+$")) return;
            if (isValidText(assetMrah, "Asset MRAH", assetMrahText, "^[a-zA-Z\\s]+$")) return;
            if (isValidText(assetOwner, "Asset owner", assetOwnerText, "^[a-zA-Z\\s]+$")) return;
            if (assetStatus.isEmpty()) {
                Toast.makeText(this, "Please select a asset status", Toast.LENGTH_SHORT).show();
                return;
            }
            if (!assetDescription.matches("^[a-zA-Z\\s]*$")) {
                assetDescriptionText.requestFocus();
                Toast.makeText(this, "Asset description is invalid!", Toast.LENGTH_SHORT).show();
                return;
            }

            // Send data
            sendDataToServer(epc, assetCode, assetName, assetType, assetLocation, assetSubLocation, assetCategory, assetQuantity, assetMrah, assetOwner, assetStatus, assetExpandable, assetDescription);
        });
    }

    // Helper method to validate text fields
    private boolean isValidText(String input, String fieldName, EditText field, String regex) {
        if (input.isEmpty()) {
            field.requestFocus();
            Toast.makeText(this, "Please enter " + fieldName + "!", Toast.LENGTH_SHORT).show();
            return true;
        }
        if (!input.matches(regex)) {
            field.requestFocus();
            Toast.makeText(this, fieldName + " is invalid!", Toast.LENGTH_SHORT).show();
            return true;
        }
        return false;
    }

    // Helper method to validate selection fields
    private boolean isValidSelection(String input, String fieldName) {
        if (input.isEmpty()) {
            Toast.makeText(this, "Please select " + fieldName + "!", Toast.LENGTH_SHORT).show();
            return true;
        }
        return false;
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendDataToServer(String epc, String code, String name, String type, String location, String subLocation, String category, String quantity, String mrah, String owner, String status, String expandable, String description) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("assetEps", epc);
                payload.put("assetCodeSearch", code);
                payload.put("assetAddName", name);
                payload.put("selectedAddTypeId", type);
                payload.put("selectedAddLocationId", location);
                payload.put("selectedAddSubLocationId", subLocation);
                payload.put("assetAddCategorie", category);
                payload.put("assetQuantity", quantity);
                payload.put("assetAddMrah", mrah);
                payload.put("assetAddOwner", owner);
                payload.put("assetStatus", status);
                payload.put("assetAddExpandable", expandable);
                payload.put("assetAddDescription", description);
                payload.put("campId", GlobalVariable.getCamp(this));
                payload.put("isValidCode", GlobalVariable.getVariable(this));

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/assets/addAsset")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    response.body().close(); // Ensure the response is closed

                    JSONObject jsonResponse = new JSONObject(responseData);
                    String message = jsonResponse.optString("message", "Asset has been added successfully.");
                    runOnUiThread(() -> {
                        Toast.makeText(AddAsset.this, message, Toast.LENGTH_SHORT).show();
                        navigateToAssets();
                    });
                } else {
                    handleError(response);
                }
            } catch (Exception e) {
                Log.e("AddAsset", "Error: " + e.getMessage());
                runOnUiThread(() -> showPopupWindow("Error sending EPCs to server: " + e.getMessage()));
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private void navigateToAssets() {
        Intent intent = new Intent(AddAsset.this, Assets.class);
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
            Log.e("AddAsset", "Error: " + e.getMessage());
            runOnUiThread(() -> showPopupWindow("Failed to process error response: " + e.getMessage()));
        } finally {
            if (response.body() != null) {
                response.body().close(); // Ensure the response body is closed
            }
        }
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
                            Toast.makeText(AddAsset.this, "Server is not active. Cannot start scan.", Toast.LENGTH_SHORT).show();
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
            Log.e("AddAsset", "Error: " + e.getMessage());
            return false;
        }
    }

    // Method to start inventory (scanning)
    private void startInventoryThread() {

        // Start inventory tag reading
        if (rfidReader.startInventoryTag()) {
            isInventory = true;

            executorService.execute(() -> {

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

                    epc = uhftagInfo.getEPC();
                    if (epc != null && !epc.isEmpty()) {
                        stopInventoryThread(); // Stop the inventory scanning when EPC is found
                        runOnUiThread(() -> updateEpcTextView(epc)); // Update UI with EPC code
                    }
                }
            });

        } else {
            Toast.makeText(AddAsset.this, "Failed to start scanning", Toast.LENGTH_SHORT).show();
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

    private void fetchAssetType() {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(Objects.requireNonNull(loadingDialog.getWindow())).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            try {

                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/assets/getAllType?isValidCode=" + GlobalVariable.getVariable(this))
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            JSONArray responseJson = new JSONArray(responseData);
                            populateAssetTypeAutoComplete(responseJson);
                        } catch (JSONException e) {
                            Toast.makeText(AddAsset.this, "JSON parsing error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    runOnUiThread(() -> Toast.makeText(AddAsset.this, "Error fetching data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(AddAsset.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private void populateAssetTypeAutoComplete(JSONArray types) throws JSONException {

        typeList.clear();
        typeIdMap.clear();

        for (int i = 0; i < types.length(); i++) {
            JSONObject type = types.getJSONObject(i);
            String typeId = type.getString("id");
            String typeName = type.getString("name");

            typeList.add(typeName);
            typeIdMap.put(typeName, typeId);
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, typeList);
        assetTypeTextList.setAdapter(adapter);
    }

    private void fetchAssetLocation() {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            try {

                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/asset/keys?isValidCode=" + GlobalVariable.getVariable(this) + "&campId=" + GlobalVariable.getCamp(this))
                        .build();

                // Execute the network call
                Response response = client.newCall(request).execute();

                if (response.isSuccessful() && response.body() != null) {
                    final String responseData = response.body().string();

                    // Parse the response
                    JSONArray jsonArray = new JSONArray(responseData);

                    // Maps to store locations and sublocations
                    ArrayList<String> locations = new ArrayList<>();
                    Map<String, String> locationIdMap = new HashMap<>();
                    Map<String, ArrayList<String>> subLocationGroupedByLocation = new HashMap<>();
                    Map<String, String> subLocationIdMap = new HashMap<>();

                    // Extract unique locations and sub-locations
                    for (int i = 0; i < jsonArray.length(); i++) {
                        JSONObject row = jsonArray.getJSONObject(i);

                        String roomId = row.optString("roomid", "Unknown Room Id");
                        String nameroom = row.optString("nameroom", "Unknown Room");
                        String keyId = row.optString("id", "Unknown Key Id");
                        String namekey = row.optString("name", "Unknown Key");

                        if (!locations.contains(nameroom)) {
                            locations.add(nameroom);
                            locationIdMap.put(nameroom, roomId);
                            subLocationGroupedByLocation.put(roomId, new ArrayList<>());
                        }

                        if (subLocationGroupedByLocation.containsKey(roomId)) {
                            Objects.requireNonNull(subLocationGroupedByLocation.get(roomId)).add(namekey);
                            subLocationIdMap.put(namekey, keyId);
                        }
                    }

                    // Populate the dropdowns on the main thread
                    runOnUiThread(() -> {
                        ArrayAdapter<String> locationAdapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, locations);
                        assetLocationText.setAdapter(locationAdapter);

                        assetLocationText.setOnItemClickListener((parent, view, position, id) -> {
                            String selectedLocation = (String) parent.getItemAtPosition(position);
                            locationAssetId = locationIdMap.get(selectedLocation);
                            assetLocationText.setText(selectedLocation);

                            // Update sublocations based on the selected location
                            ArrayList<String> filteredSubLocations = subLocationGroupedByLocation.get(locationAssetId);
                            if (filteredSubLocations != null && "1".equals(typeAssetId)) { // Check if typeId is "1"
                                ArrayAdapter<String> subLocationAdapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, filteredSubLocations);
                                assetSubLocationText.setAdapter(subLocationAdapter);
                                assetSubLocationText.setEnabled(true);
                            } else {
                                assetSubLocationText.setEnabled(false);
                                assetSubLocationText.setText(""); // Clear the sublocation field
                                subLocationAssetId = ""; // Clear the sublocation ID
                            }
                        });


                        assetSubLocationText.setOnItemClickListener((parent, view, position, id) -> {
                            String selectedSubLocation = (String) parent.getItemAtPosition(position);
                            subLocationAssetId = subLocationIdMap.get(selectedSubLocation);
                            assetSubLocationText.setText(selectedSubLocation);
                        });
                    });

                } else {
                    runOnUiThread(() -> Toast.makeText(AddAsset.this, "Error fetching location data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(AddAsset.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly
    }
}