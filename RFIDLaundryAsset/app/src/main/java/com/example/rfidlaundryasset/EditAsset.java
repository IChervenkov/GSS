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
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.SpinnerAdapter;
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
import java.util.List;
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

public class EditAsset extends AppCompatActivity {

    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private String oldEpc = "";
    private String newEpc = "";
    private EditText assetCodeText;
    private EditText assetNameText;
    private final ArrayList<String> typeList = new ArrayList<>();
    private final Map<String, String> typeIdMap = new HashMap<>();
    private final ArrayList<String> locations = new ArrayList<>();
    private final Map<String, String> locationIdMap = new HashMap<>();
    private final Map<String, ArrayList<String>> subLocationGroupedByLocation = new HashMap<>();
    private final Map<String, String> subLocationIdMap = new HashMap<>();
    private String typeAssetId = "";
    private String locationAssetId = "";
    private String subLocationAssetId = "";
    private AutoCompleteTextView assetTypeTextList;
    private AutoCompleteTextView assetLocationText;
    private AutoCompleteTextView assetSubLocationText;
    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private AutoCompleteTextView assetAutoCompleteTextView;
    private TextView assetEpcText;
    private EditText assetCategoriesText;
    private EditText assetQuantityText;
    private EditText assetMrahText;
    private EditText assetOwnerText;
    private EditText assetStatusText;
    private Spinner assetExpandableText;
    private EditText assetServiceText;
    private EditText assetDescriptionText;
    private EditText assetM2InsideText;
    private CheckBox assetIsFixedCheckbox;
    private EditText assetDatePurchaseText;
    private EditText assetDateWrittenOffText;
    private EditText assetPurchasePriceText;
    private EditText assetCommentsText;
    private EditText assetReplacedOffText;
    private EditText assetReplacedByText;
    private EditText assetYearOfLifeCycleText;
    private EditText assetRestOfLifeCycleText;
    private EditText assetRestValueText;
    private final ExecutorService executorService = Executors.newFixedThreadPool(3); // Adjust pool size as needed

    private void fetchCsrfToken() {
        Dialog loadingDialog = new Dialog(EditAsset.this);
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
                    runOnUiThread(() -> Toast.makeText(EditAsset.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(EditAsset.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_asset);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        fetchCsrfToken();

        assetAutoCompleteTextView = findViewById(R.id.assetAutoCompleteTextView);

        Button submitButton = findViewById(R.id.editButton);
        assetCodeText = findViewById(R.id.assetCodeText);
        assetNameText = findViewById(R.id.assetNameText);
        assetTypeTextList = findViewById(R.id.assetTypeAutoCompleteTextView);
        assetLocationText = findViewById(R.id.assetLocationAutoCompleteTextView);
        assetSubLocationText = findViewById(R.id.assetSubLocationAutoCompleteTextView);
        assetEpcText = findViewById(R.id.epcTextView);
        assetCategoriesText = findViewById(R.id.assetCategoriesText);
        assetQuantityText = findViewById(R.id.assetQuantityText);
        assetYearOfLifeCycleText = findViewById(R.id.assetYearOfLifeCycleText);
        assetRestOfLifeCycleText = findViewById(R.id.assetRestOfLifeCycleText);
        assetRestValueText = findViewById(R.id.assetRestValueText);
        assetMrahText = findViewById(R.id.assetMrahText);
        assetOwnerText = findViewById(R.id.assetOwnerText);
        assetCommentsText = findViewById(R.id.assetCommentsText);
        assetReplacedOffText = findViewById(R.id.assetReplacedOffText);
        assetReplacedByText = findViewById(R.id.assetReplacedByText);
        assetM2InsideText = findViewById(R.id.assetM2InsideText);
        assetPurchasePriceText = findViewById(R.id.assetPurchasePriceText);
        assetIsFixedCheckbox = findViewById(R.id.assetIsFixedCheckbox);
        assetDatePurchaseText = findViewById(R.id.assetDatePurchaseText);
        assetDateWrittenOffText = findViewById(R.id.assetDateWrittenOffText);
        assetStatusText = findViewById(R.id.assetStatusText);
        assetExpandableText = findViewById(R.id.assetExpandableText);
        assetServiceText = findViewById(R.id.assetServiceText);
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

        // Fetch asset type from the server
        fetchAssetType();

        // Fetch asset location from the server
        fetchAssetLocation();

        // Fetch all assets from the server
        fetchAssetCode();

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.init();

            Toast.makeText(EditAsset.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e("EditAsset", "Error: " + e.getMessage());
            Toast.makeText(EditAsset.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (newEpc.isEmpty()) {
                Toast.makeText(this, "No EPC content detected!", Toast.LENGTH_SHORT).show();
                return;
            }

            String selectAssetCode = assetAutoCompleteTextView.getText().toString().trim();
            String newEpcCode = newEpc;
            String oldEpcCode = oldEpc;
            String assetCode = assetCodeText.getText().toString().trim();
            String assetName = assetNameText.getText().toString().trim();
            String assetType = typeAssetId;
            String assetLocation = locationAssetId;
            String assetSubLocation = subLocationAssetId;
            String assetCategories = assetCategoriesText.getText().toString().trim();
            String assetQuantity = assetQuantityText.getText().toString().trim();
            String assetYearOfLifeCycle = assetYearOfLifeCycleText.getText().toString().trim();
            String assetRestOfLifeCycle = assetRestOfLifeCycleText.getText().toString().trim();
            String assetRestValue = assetRestValueText.getText().toString().trim();
            String assetMrah = assetMrahText.getText().toString().trim();
            String assetOwner = assetOwnerText.getText().toString().trim();
            String assetComments = assetCommentsText.getText().toString().trim();
            String assetReplacedOff = assetReplacedOffText.getText().toString().trim();
            String assetReplacedBy = assetReplacedByText.getText().toString().trim();
            String assetM2Inside = assetM2InsideText.getText().toString().trim();
            String assetPurchasePrice = assetPurchasePriceText.getText().toString().trim();
            boolean assetIsFixed = assetIsFixedCheckbox.isChecked();
            String assetDatePurchase = assetDatePurchaseText.getText().toString().trim();
            String assetDateWrittenOff = assetDateWrittenOffText.getText().toString().trim();
            String assetStatus = assetStatusText.getText().toString();
            String assetExpandable = assetExpandableText.getSelectedItem().toString();
            String assetService = assetServiceText.getText().toString().trim();
            String assetDescription = assetDescriptionText.getText().toString().trim();

            // Validation
            if (isValidText(selectAssetCode, "edit asset code")) return;
            if (isValidText(assetCode, "asset code")) return;
            if (isValidText(assetName, "asset name", "^[a-zA-Z0-9\\s]+$")) return;
            if (isValidText(assetType, "asset type")) return;
            if (isValidText(assetLocation, "asset location")) return;
            if (assetSubLocationText.isEnabled() && isValidText(assetSubLocation, "asset sub-location")) return;
            if (isValidText(assetCategories, "asset category", "^[a-zA-Z\\s]*$")) return;
            if (isValidText(assetQuantity, "asset quantity", "^[1-9]*$")) return;
            if (isValidText(assetYearOfLifeCycle, "asset year of life cycle", "^[1-9]*$")) return;
            if (isValidText(assetRestOfLifeCycle, "asset rest of life cycle", "^[1-9]*$")) return;
            if (isValidText(assetRestValue, "asset rest value", "^[1-9]*$")) return;
            if (isValidText(assetMrah, "asset MRAH", "^[a-zA-Z\\s]*$")) return;
            if (isValidText(assetOwner, "asset owner", "^[a-zA-Z\\s]*$")) return;
            if (isValidText(assetComments, "asset comments", "^[a-zA-Z0-9\\s]*$")) return;
            if (isValidText(assetReplacedOff, "asset replaced off", "^[a-zA-Z0-9\\s]*$")) return;
            if (isValidText(assetReplacedBy, "asset replaced by", "^[a-zA-Z0-9\\s]*$")) return;
            if (isValidText(assetM2Inside, "asset M2 inside", "^([0-9]+,[0-9]+)?$")) return;
            if (isValidText(assetPurchasePrice, "asset purchase price", "^([0-9]+,[0-9]+)?$")) return;
            if (isValidText(assetStatus, "asset status", "^[a-zA-Z0-9]*$")) return;
            if (isValidText(assetExpandable, "asset expandable", "^[a-zA-Z0-9]*$")) return;
            if (isValidText(assetService, "asset service", "^[a-zA-Z\\s]*$")) return;
            if (isValidText(assetDescription, "asset description", "^[a-zA-Z0-9\\s]*$")) return;

            // Send data to server
            sendDataToServer(oldEpcCode, newEpcCode, assetCode, assetName, assetType, assetLocation, assetSubLocation, assetCategories, assetQuantity, assetMrah, assetOwner, assetStatus, assetExpandable, assetService, assetDescription, assetM2Inside, assetIsFixed, assetDatePurchase, assetDateWrittenOff, assetPurchasePrice, assetComments, assetReplacedOff, assetYearOfLifeCycle, assetRestOfLifeCycle, assetReplacedBy, assetRestValue);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchCsrfToken();
    }

    // Helper method for validation
    private boolean isValidText(String input, String fieldName) {
        if (input.isEmpty()) {
            Toast.makeText(this, "Please enter/select " + fieldName + "!", Toast.LENGTH_SHORT).show();
            return true;
        }
        return false;
    }

    // Overloaded helper method with regex validation
    private boolean isValidText(String input, String fieldName, String regex) {
        if (!input.matches(regex)) {
            Toast.makeText(this, fieldName + " must contain only valid characters!", Toast.LENGTH_SHORT).show();
            return true;
        }
        return false;
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendDataToServer(String oldEpcCode, String newEpcCode, String assetCode, String assetName, String assetType, String assetLocation, String assetSubLocation, String assetCategories, String assetQuantity, String assetMrah, String assetOwner, String assetStatus, String assetExpandable, String assetService, String assetDescription, String assetM2Inside, boolean assetIsFixed, String assetDatePurchase, String assetDateWrittenOff, String assetPurchasePrice, String assetComments, String assetReplacedOff, String assetYearOfLifeCycle, String assetRestOfLifeCycle, String assetReplacedBy, String assetRestValue) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {

            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("oldCode", oldEpcCode);
                payload.put("newCode", newEpcCode);
                payload.put("code", assetCode);
                payload.put("name", assetName);
                payload.put("type", assetType);
                payload.put("location", assetLocation);
                payload.put("subLocation", assetSubLocation);
                payload.put("category", assetCategories);
                payload.put("quantity", assetQuantity);
                payload.put("mrah", assetMrah);
                payload.put("owner", assetOwner);
                payload.put("status", assetStatus);
                payload.put("expandable", assetExpandable);
                payload.put("service", assetService);
                payload.put("description", assetDescription);
                payload.put("m2Inside", assetM2Inside);
                payload.put("isFixed", assetIsFixed);
                payload.put("datePurchase", assetDatePurchase);
                payload.put("dateWrittenOff", assetDateWrittenOff);
                payload.put("purchasePrice", assetPurchasePrice);
                payload.put("comments", assetComments);
                payload.put("replacedOff", assetReplacedOff);
                payload.put("yearOfLifeCycle", assetYearOfLifeCycle);
                payload.put("restOfLifeCycle", assetRestOfLifeCycle);
                payload.put("replacedBy", assetReplacedBy);
                payload.put("restValue", assetRestValue);
                payload.put("username", GlobalVariable.getUsername(this));
                payload.put("campId", GlobalVariable.getCamp(this));
                payload.put("isValidCode", GlobalVariable.getVariable(this));

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/assets/editAssetDevice")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        String responseData = Objects.requireNonNull(response.body()).string();
                        response.body().close(); // Ensure the response is closed

                        JSONObject jsonResponse = new JSONObject(responseData);
                        String message = jsonResponse.optString("message", "Asset has been edited successfully.");
                        runOnUiThread(() -> {
                            Toast.makeText(EditAsset.this, message, Toast.LENGTH_SHORT).show();
                            navigateToAssets();
                        });
                    } else {
                        handleError(response);
                    }
                }
            } catch (Exception e) {
                Log.e("EditAsset", "Error: " + e.getMessage());
                runOnUiThread(() -> showPopupWindow("Error sending EPCs to server: " + e.getMessage()));
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private void navigateToAssets() {
        Intent intent = new Intent(EditAsset.this, Assets.class);
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
            Log.e("EditAsset", "Error: " + e.getMessage());
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
                            Toast.makeText(EditAsset.this, "Server is not active. Cannot start scan.", Toast.LENGTH_SHORT).show();
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
            Log.e("EditAsset", "Error: " + e.getMessage());
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
                newEpc = uhftagInfo.getEPC();
                if (newEpc != null && !newEpc.isEmpty()) {
                    stopInventoryThread(); // Stop the inventory scanning when EPC is found
                    runOnUiThread(() -> updateEpcTextView(newEpc)); // Update UI with EPC code
                }
            }
        } else {
            Toast.makeText(EditAsset.this, "Failed to start scanning", Toast.LENGTH_SHORT).show();
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
        Dialog loadingDialog = new Dialog(EditAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
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
                            Toast.makeText(EditAsset.this, "JSON parsing error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    runOnUiThread(() -> Toast.makeText(EditAsset.this, "Error fetching data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(EditAsset.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
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

        assetTypeTextList.setOnItemClickListener((parent, view, position, id) -> {
            String selectedTypeCode = (String) parent.getItemAtPosition(position);
            String selectedBag = typeIdMap.get(selectedTypeCode);

            if (selectedBag != null) {
                typeAssetId = selectedBag;
                assetTypeTextList.setText(selectedTypeCode);

                ArrayList<String> filteredSubLocations = subLocationGroupedByLocation.get(locationAssetId);
                if (!"1".equals(selectedBag)) {
                    // Disable the assetSubLocationText view
                    assetSubLocationText.setEnabled(false);
                    assetSubLocationText.setText(""); // Optionally clear its text
                    subLocationAssetId = "";
                } else {
                    ArrayAdapter<String> subLocationAdapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, Objects.requireNonNull(filteredSubLocations));
                    assetSubLocationText.setAdapter(subLocationAdapter);
                    assetSubLocationText.setEnabled(true);
                }
            }
        });
    }

    private void fetchAssetLocation() {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditAsset.this);
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
                    runOnUiThread(() -> Toast.makeText(EditAsset.this, "Error fetching location data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(EditAsset.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private void fetchAssetCode() {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {

            try {

                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/allAssets?isValidCode=" + GlobalVariable.getVariable(this) + "&campId=" + GlobalVariable.getCamp(this))
                        .build();

                Response response = client.newCall(request).execute();

                if (response.isSuccessful() && response.body() != null) {
                    final String responseData = response.body().string();

                    JSONObject responseJson = new JSONObject(responseData);
                    JSONArray assets = responseJson.getJSONArray("allAssets");

                    List<String> assetCodes = new ArrayList<>();
                    Map<String, JSONObject> assetDetailsMap = new HashMap<>();

                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject row = assets.getJSONObject(i);
                        String assetCode = row.optString("code", "Unknown Asset Code");

                        // Fetch type_name, location_name, sub_location_name
                        String typeId = row.optString("type_id", "Unknown Type");
                        String locationId = row.optString("location_id", "Unknown Location");
                        String subLocationId = row.optString("sub_location_id", "Unknown SubLocation");

                        // Assuming you have mappings or lists to get the names based on these IDs
                        String typeName = getTypeNameById(typeId);
                        String locationName = getLocationNameById(locationId);
                        String subLocationName = getSubLocationNameById(subLocationId);

                        row.put("type_name", typeName);
                        row.put("location_name", locationName);
                        row.put("sub_location_name", subLocationName);

                        row.put("type_id", typeId);
                        row.put("location_id", locationId);
                        row.put("sub_location_id", subLocationId);

                        assetCodes.add(assetCode);
                        assetDetailsMap.put(assetCode, row); // Map the asset name to its details
                    }

                    // Update UI on the main thread
                    runOnUiThread(() -> populateAssetAutoComplete(assetCodes, assetDetailsMap));

                } else {
                    runOnUiThread(() -> Toast.makeText(EditAsset.this, "Error fetching asset data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(EditAsset.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private String getTypeNameById(String typeId) {
        // Return the type name for the given typeId
        return typeIdMap.entrySet()
                .stream()
                .filter(entry -> entry.getValue().equals(typeId))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse("Unknown Type"); // Return "Unknown Type" if not found
    }

    private String getLocationNameById(String locationId) {
        // Return the location name for the given locationId
        return locationIdMap.entrySet()
                .stream()
                .filter(entry -> entry.getValue().equals(locationId))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse("Unknown Location"); // Return "Unknown Location" if not found
    }

    private String getSubLocationNameById(String subLocationId) {
        // Return the sub-location name for the given subLocationId
        return subLocationIdMap.entrySet()
                .stream()
                .filter(entry -> entry.getValue().equals(subLocationId))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse("Unknown Sub-Location"); // Return "Unknown Sub-Location" if not found
    }

    @SuppressLint("SetTextI18n")
    private void populateAssetAutoComplete(List<String> assetCodes, Map<String, JSONObject> assetDetailsMap) {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_dropdown_item_1line,
                assetCodes
        );
        assetAutoCompleteTextView.setAdapter(adapter);

        assetAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedAssetCode = (String) parent.getItemAtPosition(position);
            JSONObject selectedAssetDetails = assetDetailsMap.get(selectedAssetCode);

            if (selectedAssetDetails == null) {
                Toast.makeText(EditAsset.this, "Details not found for the selected asset.", Toast.LENGTH_SHORT).show();
                return;
            }

            try {
                // Extract data from the selected asset details
                String assetName = selectedAssetDetails.optString("name_assets", "");
                String assetTypeName = selectedAssetDetails.optString("type_name", "");
                String assetLocationName = selectedAssetDetails.optString("location_name", "");
                String assetSubLocationName = selectedAssetDetails.optString("sub_location_name", "");
                String assetEPC = selectedAssetDetails.optString("id", "");
                String assetCategory = selectedAssetDetails.optString("categorie", "");
                String assetQuantity = selectedAssetDetails.optString("quantity", "");
                String assetYearOfLifeCycle = selectedAssetDetails.optString("year_of_life_cycle", "");
                String assetRestOfLifeCycle = selectedAssetDetails.optString("rest_of_life_cycle", "");
                String assetRestValue = selectedAssetDetails.optString("rest_value", "");
                String assetMrah = selectedAssetDetails.optString("mrah", "");
                String assetOwner = selectedAssetDetails.optString("owner", "");
                String assetComments = selectedAssetDetails.optString("comments", "");
                String assetReplacedOff = selectedAssetDetails.optString("replaced_off", "");
                String assetReplacedBy = selectedAssetDetails.optString("replaced_by", "");
                String assetM2Inside = selectedAssetDetails.optString("m2_inside", "");
                String assetPurchasePrice = selectedAssetDetails.optString("purchase_price", "");
                boolean assetIsFixed = selectedAssetDetails.optBoolean("is_fixed");
                String assetDatePurchase = selectedAssetDetails.optString("date_purchase", "");
                String assetDateWrittenOff = selectedAssetDetails.optString("date_written_off", "");
                String assetStatus = selectedAssetDetails.optString("status", "");
                String assetExpandable = selectedAssetDetails.optString("expandable", "");
                String assetService = selectedAssetDetails.optString("service", "");
                String assetDescription = selectedAssetDetails.optString("description", "");

                // Update UI fields
                assetNameText.setText(assetName);
                assetCodeText.setText(selectedAssetCode);
                assetTypeTextList.setText(assetTypeName, false);
                assetLocationText.setText(assetLocationName, false);
                assetSubLocationText.setText(assetSubLocationName, false);
                assetEpcText.setText("EPC code: " + assetEPC);
                assetCategoriesText.setText(!assetCategory.equals("null") && !assetCategory.isEmpty() ? assetCategory : "");
                assetQuantityText.setText(assetQuantity);
                assetMrahText.setText(!assetMrah.equals("null") && !assetMrah.isEmpty() ? assetMrah : "");
                assetOwnerText.setText(!assetOwner.equals("null") && !assetOwner.isEmpty() ? assetOwner : "");
                assetCommentsText.setText(!assetComments.equals("null") && !assetComments.isEmpty() ? assetComments : "");
                assetReplacedOffText.setText(!assetReplacedOff.equals("null") && !assetReplacedOff.isEmpty() ? assetReplacedOff : "");
                assetReplacedByText.setText(!assetReplacedBy.equals("null") && !assetReplacedBy.isEmpty() ? assetReplacedBy : "");
                assetM2InsideText.setText(!assetM2Inside.equals("null") && !assetM2Inside.isEmpty() ? assetM2Inside : "");
                assetPurchasePriceText.setText(!assetPurchasePrice.equals("null") && !assetPurchasePrice.isEmpty() ? assetPurchasePrice : "");
                assetIsFixedCheckbox.setChecked(assetIsFixed);
                assetDatePurchaseText.setText(!assetDatePurchase.equals("null") && !assetDatePurchase.isEmpty() ? assetDatePurchase : "");
                assetDateWrittenOffText.setText(!assetDateWrittenOff.equals("null") && !assetDateWrittenOff.isEmpty() ? assetDateWrittenOff : "");
                assetStatusText.setText(!assetStatus.equals("null") && !assetStatus.isEmpty() ? assetStatus : "");
                assetServiceText.setText(!assetService.equals("null") && !assetService.isEmpty() ? assetService : "");
                assetYearOfLifeCycleText.setText(!assetYearOfLifeCycle.equals("null") && !assetYearOfLifeCycle.isEmpty() ? assetYearOfLifeCycle : "");
                assetRestOfLifeCycleText.setText(!assetRestOfLifeCycle.equals("null") && !assetRestOfLifeCycle.isEmpty() ? assetRestOfLifeCycle : "");
                assetRestValueText.setText(!assetRestValue.equals("null") && !assetRestValue.isEmpty() ? assetRestValue : "");

                SpinnerAdapter rawAdapterExpandable = assetExpandableText.getAdapter();
                if (rawAdapterExpandable instanceof ArrayAdapter<?>) {
                    @SuppressWarnings("unchecked")
                    ArrayAdapter<String> adapterSpinnerExpandable = (ArrayAdapter<String>) rawAdapterExpandable;

                    int positionExpandable = adapterSpinnerExpandable.getPosition(assetExpandable);
                    assetExpandableText.setSelection(positionExpandable);
                } else {
                    Log.w("EditAsset", "Unexpected adapter type for assetExpandableText");
                }

                assetDescriptionText.setText(!assetDescription.equals("null") && !assetDescription.isEmpty() ? assetDescription : "");

                oldEpc = newEpc = assetEPC;

                // Update IDs
                typeAssetId = selectedAssetDetails.optString("type_id", "");
                locationAssetId = selectedAssetDetails.optString("location_id", "");
                subLocationAssetId = selectedAssetDetails.optString("sub_location_id", "");

                // Enable or disable sub-location based on type ID
                ArrayList<String> filteredSubLocations = subLocationGroupedByLocation.get(locationAssetId);
                if ("1".equals(typeAssetId)) {
                    ArrayAdapter<String> subLocationAdapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, Objects.requireNonNull(filteredSubLocations));
                    assetSubLocationText.setAdapter(subLocationAdapter);
                    assetSubLocationText.setEnabled(true);
                } else {
                    assetSubLocationText.setEnabled(false);
                    assetSubLocationText.setText(""); // Clear sub-location field
                    subLocationAssetId = ""; // Clear sub-location ID
                }
            } catch (Exception e) {
                Toast.makeText(EditAsset.this, "Error updating asset details: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly
    }
}