package com.example.nfcreader;

import android.app.AlertDialog;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SearchClient extends AppCompatActivity {

    private boolean isValidCode;
    private String campId;
    private final OkHttpClient client = new OkHttpClient();
    private final ArrayList<BikeInfo> ownerList = new ArrayList<>();
    private final Map<BikeInfo, String> clientIdMap = new HashMap<>();
    private final Map<BikeInfo, String> keyIdMap = new HashMap<>();
    private final Map<String, String> keyIdCountMap = new HashMap<>();
    private AutoCompleteTextView clientAutoCompleteTextView;
    private NfcAdapter nfcAdapter;

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

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_search_client);

        campId = GlobalVariable.getCamp(this);
        isValidCode = GlobalVariable.getVariable(this);

        clientAutoCompleteTextView = findViewById(R.id.clientAutoCompleteTextView);
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            showPopupWindow("NFC is not available on this device.");
            finish();
            return;
        }

        // Fetch client from the server
        fetchAvailableBikes();

        // Handle NFC intents
        handleIntent(getIntent());

        clientAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            BikeInfo selectedBikeInfo = (BikeInfo) parent.getItemAtPosition(position);

            // Fetch the ID from the map using the selected BikeInfo
            String selectedClientId = clientIdMap.get(selectedBikeInfo);
            String selectedClientKeyId = keyIdMap.get(selectedBikeInfo);
            String selectClientCount = keyIdCountMap.get(selectedClientKeyId);

            if (selectClientCount != null && Integer.parseInt(selectClientCount) > 0) {
                showPopup("Soldier: " + selectedBikeInfo + "\nNumber of bikes taken: " + selectClientCount);
            }

            loadBikeData(selectedClientId);
        });
    }

    private void showPopup(String message) {
        new AlertDialog.Builder(this)
                .setTitle("Soldier Information")
                .setMessage(message)
                .setPositiveButton("OK", (dialog, which) -> dialog.dismiss())
                .setCancelable(false)
                .show();
    }

    private void fetchAvailableBikes() {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchClient.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/getClient?campId=" + campId + "&isValidCode=" + isValidCode)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                runOnUiThread(() -> showPopupWindow("Error when fetching soldier. Please connect to the support!"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    JSONArray allSoldier = new JSONArray(responseData);
                    runOnUiThread(() -> populateBikeAutoComplete(allSoldier));

                } catch (JSONException e) {
                    runOnUiThread(() -> showPopupWindow("Error when fetching soldier. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateBikeAutoComplete(JSONArray bikes) {

        try {
            ownerList.clear();
            clientIdMap.clear();
            keyIdMap.clear();
            keyIdCountMap.clear();

            Set<String> seenNames = new HashSet<>();

            for (int i = 0; i < bikes.length(); i++) {
                JSONObject bike = bikes.getJSONObject(i);
                String bikeId = bike.getString("id");
                String keyId = bike.getString("keyid");
                String bikeName = bike.getString("namesoldier");
                String soldierKey = bike.getString("namekey");
                String countGetBikes = bike.getString("count_get_bike");

                if (seenNames.contains(bikeName)) {
                    continue;
                }

                seenNames.add(bikeName);

                BikeInfo bikeInfo = new BikeInfo(bikeName, !soldierKey.equals("null") ? soldierKey : "No key");

                ownerList.add(bikeInfo);
                clientIdMap.put(bikeInfo, bikeId);
                keyIdMap.put(bikeInfo, keyId);
                keyIdCountMap.put(keyId, countGetBikes);
            }

            ArrayAdapter<BikeInfo> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, ownerList);
            clientAutoCompleteTextView.setAdapter(adapter);

        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Failed to fetch soldier. Please connect to the support."));
        }
    }


    private void loadBikeData(String bikeId) {

        if (isNetworkAvailable()) {
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchClient.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        // Make network request to your server endpoint
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/searchClient?id=" + bikeId + "&isValidCode=" + isValidCode)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                runOnUiThread(() -> showPopupWindow("Error fetching data from server. Please connect to the support!"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    JSONArray bikesArray = new JSONArray(responseData);
                    runOnUiThread(() -> updateTableLayout(bikesArray));

                } catch (JSONException e) {
                    runOnUiThread(() -> showPopupWindow("Error fetching data from server. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void updateTableLayout(JSONArray bikesArray) {

        try {
            TableLayout tableLayout = findViewById(R.id.table_layout);
            tableLayout.removeAllViews();
            tableLayout.setPadding(0, 0, 0, 10);

            // Iterate through the JSON array to extract each bike's data
            for (int i = 0; i < bikesArray.length(); i++) {
                JSONObject bike = bikesArray.getJSONObject(i);
                String fetchedBikeId = bike.getString("namebike");
                String dateFrom = bike.getString("datefrom");
                String dateTo = bike.getString("dateto");

                tableLayout.addView(createSpacer()); // Add empty row for spacing

                // Create rows for each bike's details
                tableLayout.addView(createDetailRow("Bike", fetchedBikeId));
                tableLayout.addView(createDetailRow("Date From", dateFrom));
                tableLayout.addView(createDetailRow("Date To", dateTo));


            }
        } catch (JSONException e) {
            runOnUiThread(() -> showPopupWindow("Error when updating UI. Please connect ot the support!"));
        }
    }

    private TableRow createDetailRow(String label, String value) {
        TableRow row = new TableRow(this);

        TextView labelView = new TextView(this);
        labelView.setLayoutParams(new TableRow.LayoutParams(TableRow.LayoutParams.WRAP_CONTENT, TableRow.LayoutParams.WRAP_CONTENT));
        labelView.setText(label);
        labelView.setPadding(8, 8, 8, 8);
        labelView.setTypeface(null, Typeface.BOLD); // Set to bold

        TextView valueView = new TextView(this);
        valueView.setLayoutParams(new TableRow.LayoutParams(TableRow.LayoutParams.WRAP_CONTENT, TableRow.LayoutParams.WRAP_CONTENT));
        valueView.setText(value);
        valueView.setPadding(8, 8, 8, 8);

        row.addView(labelView);
        row.addView(valueView);

        return row;
    }

    // Method to create a spacer View
    private View createSpacer() {
        View spacer = new View(this);
        TableRow.LayoutParams params = new TableRow.LayoutParams(TableRow.LayoutParams.MATCH_PARENT, 100); // Height of the spacer
        spacer.setLayoutParams(params);
        return spacer;
    }

    @Override
    protected void onResume() {
        super.onResume();

        Intent intent = new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_MUTABLE);
        IntentFilter[] intentFilters = new IntentFilter[]{};
        nfcAdapter.enableForegroundDispatch(this, pendingIntent, intentFilters, null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        nfcAdapter.disableForegroundDispatch(this);
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    private void handleIntent(Intent intent) {
        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag.class);
        if (tag != null) {
            // Get the NFC ID (UID)
            byte[] tagId = tag.getId();
            String nfcId = bytesToHex(tagId);

            String selectedClientName = null;
            BikeInfo selectedClientInfoId = null;

            for (Map.Entry<BikeInfo, String> entry : keyIdMap.entrySet()) {
                if (entry.getValue().equals(nfcId)) {
                    selectedClientInfoId = entry.getKey();
                    selectedClientName = entry.getKey().toString(); // Assuming BikeInfo's toString() returns the name
                    break;
                }
            }

            if (selectedClientName == null) {
                showPopupWindow("Soldier not found!");
                return;
            }

            clientAutoCompleteTextView.setText(selectedClientName);
            
            // Get the ID of the selected bike
            String selectedClientCount = keyIdCountMap.get(nfcId);
            String selectedClientId = clientIdMap.get(selectedClientInfoId);

            if (selectedClientCount != null && Integer.parseInt(selectedClientCount) > 0) {
                showPopup("Soldier: " + selectedClientName + "\nNumber of bikes taken: " + selectedClientCount);
            }

            // Call the server with the NFC data
            loadBikeData(selectedClientId);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
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
}