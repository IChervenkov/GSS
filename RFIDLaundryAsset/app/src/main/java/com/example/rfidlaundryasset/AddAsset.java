package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
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
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.Spinner;
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
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
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

public class AddAsset extends AppCompatActivity implements CsrfTokenProvider {

    private boolean isValidCode;
    private String campId;
    private String username;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .addInterceptor(new CsrfInterceptor(this))
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
    private EditText assetStatusText;
    private EditText assetServiceText;
    private EditText assetM2InsideText;
    private CheckBox assetIsFixedCheckbox;
    private EditText assetDatePurchaseText;
    private EditText assetDateWrittenOffText;
    private EditText assetPurchasePriceText;
    private EditText assetCommentsText;
    private EditText assetReplacedOffText;
    private EditText assetYearOfLifeCycleText;
    private EditText assetRestOfLifeCycleText;
    private EditText assetReplacedByText;
    private EditText assetRestValueText;
    private EditText assetDescriptionText;
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

        Dialog loadingDialog = new Dialog(AddAsset.this);
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
        setContentView(R.layout.activity_add_asset);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        isValidCode = GlobalVariable.getVariable(this);
        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        fetchCsrfToken(null);

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
        assetYearOfLifeCycleText = findViewById(R.id.assetYearOfLifeCycleText);
        assetRestOfLifeCycleText = findViewById(R.id.assetRestOfLifeCycleText);
        assetRestValueText = findViewById(R.id.assetRestValueText);
        assetMrahText = findViewById(R.id.assetMrahText);
        assetOwnerText = findViewById(R.id.assetOwnerText);
        assetM2InsideText = findViewById(R.id.assetM2InsideText);
        assetCommentsText = findViewById(R.id.assetCommentsText);
        assetReplacedOffText = findViewById(R.id.assetReplacedOffText);
        assetReplacedByText = findViewById(R.id.assetReplacedByText);
        assetPurchasePriceText = findViewById(R.id.assetPurchasePriceText);
        assetDatePurchaseText = findViewById(R.id.assetDatePurchaseText);
        assetDateWrittenOffText = findViewById(R.id.assetDateWrittenOffText);
        assetIsFixedCheckbox = findViewById(R.id.assetIsFixedCheckbox);
        assetServiceText = findViewById(R.id.assetServiceText);
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

        // Fetch asset type from the server
        fetchAssetType();

        // Fetch asset location from the server
        fetchAssetLocation();

        assetTypeTextList.setOnItemClickListener((parent, view, position, id) -> {
            String selectedTypeCode = (String) parent.getItemAtPosition(position);
            String selectedBag = typeIdMap.get(selectedTypeCode);

            if (selectedBag == null)
                return;

            typeAssetId = selectedBag;
            assetTypeTextList.setText(selectedTypeCode);

            if ("1".equals(selectedBag)) {
                assetSubLocationText.setEnabled(true);
                return;
            }

            // Disable the assetSubLocationText view
            assetSubLocationText.setEnabled(false);
            assetSubLocationText.setText(""); // Optionally clear its text
            subLocationAssetId = "";

        });

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.free();
            rfidReader.init();

        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Error initializing RFID Reader"));
        }

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (epc.isEmpty()) {
                runOnUiThread(() -> showPopupWindow("No EPC content detected!"));
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
            String assetYearOfLifeCycle = assetYearOfLifeCycleText.getText().toString().trim();
            String assetRestOfLifeCycle = assetRestOfLifeCycleText.getText().toString().trim();
            String assetRestValue = assetRestValueText.getText().toString().trim();
            String assetMrah = assetMrahText.getText().toString().trim();
            String assetOwner = assetOwnerText.getText().toString().trim();
            String assetM2Inside = assetM2InsideText.getText().toString().trim();
            String assetComments = assetCommentsText.getText().toString().trim();
            String assetReplacedOff = assetReplacedOffText.getText().toString().trim();
            String assetReplacedBy = assetReplacedByText.getText().toString().trim();
            String assetPurchasePrice = assetPurchasePriceText.getText().toString().trim();
            String assetDatePurchase = assetDatePurchaseText.getText().toString().trim();
            String assetDateWrittenOff = assetDateWrittenOffText.getText().toString().trim();
            String assetStatus = assetStatusText.getText().toString().trim();
            String assetDescription = assetDescriptionText.getText().toString().trim();
            String assetService = assetServiceText.getText().toString().trim();
            boolean assetIsFixed = assetIsFixedCheckbox.isChecked();

            // Validation
            if (isValidText(assetCode, "Asset code", assetCodeText, "^[a-zA-Z0-9]+$")) return;
            if (isValidText(assetName, "Asset name", assetNameText, "^[a-zA-Z0-9\\s]+$")) return;
            if (isValidSelection(assetType, "asset type")) return;
            if (isValidSelection(assetLocation, "asset location")) return;
            if (assetSubLocationText.isEnabled() && assetSubLocation.isEmpty()) {
                assetSubLocationText.requestFocus();
                runOnUiThread(() -> showPopupWindow("Please select an asset sub-location!"));
                return;
            }
            if (isValidText(assetCategory, "Asset category", assetCategoriesText, "^[a-zA-Z\\s]*$"))
                return;
            if (isValidText(assetQuantity, "Asset quantity", assetQuantityText, "^[1-9]*$")) return;
            if (isValidText(assetMrah, "Asset MRAH", assetMrahText, "^[a-zA-Z\\s]*$")) return;
            if (isValidText(assetOwner, "Asset owner", assetOwnerText, "^[a-zA-Z\\s]*$")) return;
            if (isValidText(assetStatus, "Asset status", assetStatusText, "^[a-zA-Z0-9\\s]*$"))
                return;
            if (!assetDescription.matches("^[a-zA-Z\\s]*$")) {
                assetDescriptionText.requestFocus();
                runOnUiThread(() -> showPopupWindow("Asset description is invalid!"));
                return;
            }
            if (isValidText(assetService, "Asset service", assetServiceText, "^[a-zA-Z\\s]*$"))
                return;
            if (isValidText(assetM2Inside, "Asset M2 inside", assetM2InsideText, "^([0-9]+,[0-9]+)?$"))
                return;
            if (isValidText(assetPurchasePrice, "Asset purchase price", assetPurchasePriceText, "^([0-9]+,[0-9]+)?$"))
                return;
            if (isValidText(assetComments, "Asset comments", assetCommentsText, "^[a-zA-Z0-9]*$"))
                return;
            if (isValidText(assetReplacedOff, "Asset replaced off", assetReplacedOffText, "^[a-zA-Z0-9]*$"))
                return;
            if (isValidText(assetYearOfLifeCycle, "Asset year of life cycle", assetYearOfLifeCycleText, "^[1-9]*$"))
                return;
            if (isValidText(assetRestOfLifeCycle, "Asset rest of life cycle", assetRestOfLifeCycleText, "^[1-9]*$"))
                return;
            if (isValidText(assetReplacedBy, "Asset replaced by", assetReplacedByText, "^[a-zA-Z0-9]*$"))
                return;
            if (isValidText(assetRestValue, "Asset rest value", assetRestValueText, "^[1-9]*$"))
                return;

            new androidx.appcompat.app.AlertDialog.Builder(AddAsset.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to add this asset?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(epc, assetCode, assetName, assetType, assetLocation, assetSubLocation, assetCategory, assetQuantity, assetMrah, assetOwner, assetStatus, assetExpandable, assetDescription, assetService, assetM2Inside, assetIsFixed, assetDatePurchase, assetDateWrittenOff, assetPurchasePrice, assetComments, assetReplacedOff, assetYearOfLifeCycle, assetRestOfLifeCycle, assetReplacedBy, assetRestValue))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchCsrfToken(null);
    }

    // Helper method to validate text fields
    private boolean isValidText(String input, String fieldName, EditText field, String regex) {
        if (!input.matches(regex)) {
            field.requestFocus();
            runOnUiThread(() -> showPopupWindow(fieldName + " is invalid!"));
            return true;
        }
        return false;
    }

    // Helper method to validate selection fields
    private boolean isValidSelection(String input, String fieldName) {
        if (input.isEmpty()) {
            runOnUiThread(() -> showPopupWindow("Please select " + fieldName + "!"));
            return true;
        }
        return false;
    }

    private void sendDataToServer(String epc, String code, String name, String type, String location, String subLocation, String category, String quantity, String mrah, String owner, String status, String expandable, String description, String service, String m2Inside, boolean isFixed, String datePurchase, String dateWrittenOff, String purchasePrice, String comments, String replacedOff, String yearOfLifeCycle, String restOfLifeCycle, String replacedBy, String restValue) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performSendData(epc, code, name, type, location, subLocation, category, quantity, mrah, owner, status, expandable, description, service, m2Inside, isFixed, datePurchase, dateWrittenOff, purchasePrice, comments, replacedOff, yearOfLifeCycle, restOfLifeCycle, replacedBy, restValue));
        } else {
            performSendData(epc, code, name, type, location, subLocation, category, quantity, mrah, owner, status, expandable, description, service, m2Inside, isFixed, datePurchase, dateWrittenOff, purchasePrice, comments, replacedOff, yearOfLifeCycle, restOfLifeCycle, replacedBy, restValue);
        }
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void performSendData(String epc, String code, String name, String type, String location, String subLocation, String category, String quantity, String mrah, String owner, String status, String expandable, String description, String service, String m2Inside, boolean isFixed, String datePurchase, String dateWrittenOff, String purchasePrice, String comments, String replacedOff, String yearOfLifeCycle, String restOfLifeCycle, String replacedBy, String restValue) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject payload = new JSONObject();

        try {

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
            payload.put("assetAddService", service);
            payload.put("assetAddDescription", description);
            payload.put("assetAddM2Inside", m2Inside);
            payload.put("assetAddIsFixed", isFixed);
            payload.put("assetAddDatePurchase", datePurchase);
            payload.put("assetAddDateWrittenOff", dateWrittenOff);
            payload.put("assetAddPurchasePrice", purchasePrice);
            payload.put("assetAddComments", comments);
            payload.put("assetAddReplacedOff", replacedOff);
            payload.put("assetAddYearOfLifeCycle", yearOfLifeCycle);
            payload.put("assetAddRestOfLifeCycle", restOfLifeCycle);
            payload.put("assetAddReplacedBy", replacedBy);
            payload.put("assetAddRestValue", restValue);
            payload.put("username", username);
            payload.put("campId", campId);
            payload.put("isValidCode", isValidCode);
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Error to parsed data. Please connect to the support!"));
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/assets/addAsset")
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when send data. Please connect to the support!"));
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
                    String message = jsonResponse.optString("message", "Asset has been added successfully.");
                    runOnUiThread(() -> {
                        Toast.makeText(AddAsset.this, message, Toast.LENGTH_SHORT).show();
                        navigateToAssets();
                    });

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when send data. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
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
            String errorMessage;
            String responseBody = response.body().string(); // Read response body
            JSONObject errorJson = new JSONObject(responseBody);
            errorMessage = errorJson.optString("message", "Internal server error");
            String finalErrorMessage = errorMessage;
            runOnUiThread(() -> showPopupWindow(finalErrorMessage));
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Failed to process error response. Please connect to the support!"));
        } finally {
            response.body().close(); // Ensure the response body is closed
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
            runOnUiThread(() -> showPopupWindow("Failed to start scanning. Check if device supports RFID reader"));
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

        if (isNetworkAvailable())
            return;

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(Objects.requireNonNull(loadingDialog.getWindow())).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/assets/getAllType?isValidCode=" + isValidCode)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when get asset type. Please connect to support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    final String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject errorJson = new JSONObject(responseData);
                        String errorMessage = errorJson.optString("message", "Internal server error");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    JSONArray responseJson = new JSONArray(responseData);
                    runOnUiThread(() -> populateAssetTypeAutoComplete(responseJson));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when get asset type. Please connect to support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateAssetTypeAutoComplete(JSONArray types) {

        try {
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
        } catch (JSONException e) {
            runOnUiThread(() -> showPopupWindow("Invalid asset type data from server!"));
        }
    }

    private void fetchAssetLocation() {

        if (isNetworkAvailable())
            return;

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddAsset.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/asset/keys?isValidCode=" + isValidCode + "&campId=" + campId)
                .build();

        // Execute the network call
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error to get asset location. Please connect to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    final String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject errorJson = new JSONObject(responseData);
                        String errorMessage = errorJson.optString("message", "Internal server error");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    // Parse the response
                    JSONArray jsonArray = new JSONArray(responseData);

                    // Populate the dropdowns on the main thread
                    runOnUiThread(() -> populateAssetLocationAutoComplete(jsonArray));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error to get asset location. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateAssetLocationAutoComplete(JSONArray jsonArray) {

        try {
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
                    return;
                }

                assetSubLocationText.setEnabled(false);
                assetSubLocationText.setText(""); // Clear the sublocation field
                subLocationAssetId = ""; // Clear the sublocation ID
            });

            assetSubLocationText.setOnItemClickListener((parent, view, position, id) -> {
                String selectedSubLocation = (String) parent.getItemAtPosition(position);
                subLocationAssetId = subLocationIdMap.get(selectedSubLocation);
                assetSubLocationText.setText(selectedSubLocation);
            });
        } catch (JSONException e) {
            runOnUiThread(() -> showPopupWindow("Invalid location data from server!"));
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly

        stopInventoryThread();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }
}