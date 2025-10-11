package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Typeface;

import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.nfc.NfcAdapter;

import android.view.View;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.nfc.Tag;

import okhttp3.Call;
import okhttp3.Callback;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

import java.util.Objects;

public class SearchBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private TextView nfcTextView;
    private OkHttpClient client;
    private Call currentCall;
    private final DebounceMessageHelper messageHelper = new DebounceMessageHelper(this);

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
        setContentView(R.layout.activity_search_bike);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        nfcTextView = findViewById(R.id.bike_info);

        // Initialize NFC Adapter
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            messageHelper.showError("NFC is not available on this device.");
            finish();
            return;
        }

        // Handle NFC intents
        handleIntent(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();

        Intent intent = new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_MUTABLE);
        IntentFilter[] intentFilters = new IntentFilter[]{};
        nfcAdapter.enableForegroundDispatch(this, pendingIntent, intentFilters, null);
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
        nfcAdapter.disableForegroundDispatch(this);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelAllCalls();
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

            // Call the server with the NFC data
            readBikeDataFromServer(nfcId);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    // Method to call the API endpoint
    private void readBikeDataFromServer(String nfcData) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        // Define the request
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/readBikeNfc?nfcData=" + nfcData)
                .build();

        // Make the network call asynchronously
        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                messageHelper.showError("Failed to read bike data. Please connect to the support!");
            }

            @SuppressLint("SetTextI18n")
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    // Parse the response if it's JSON
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        messageHelper.showError(errorMessage);
                        return;
                    }

                    final String bikeName = jsonResponse.getString("namebike");
                    runOnUiThread(() -> nfcTextView.setText("Bike code: " + bikeName));
                    runOnUiThread(() -> loadBikeData(nfcData));

                } catch (JSONException e) {
                    messageHelper.showError("Failed to read bike data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void loadBikeData(String bikeId) {

        if (isNetworkAvailable()) {
            return;
        }

        // Make network request to your server endpoint
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/searchBikes?id=" + bikeId)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error fetching data from server. Please connect to the support!");
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    String responseData = response.body().string();
                    JSONArray bikesArray = new JSONArray(responseData);

                    if (!response.isSuccessful()) {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        messageHelper.showError(errorMessage);
                        return;
                    }

                    runOnUiThread(() -> updateTableLayout(bikesArray));
                    
                } catch (JSONException e) {
                    messageHelper.showError("Error fetching data from server. Please connect to the support!");
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
                String fetchedBikeId = bike.getString("namesoldier");
                String dateFrom = bike.getString("datefrom");
                String dateTo = bike.getString("dateto");

                tableLayout.addView(createSpacer()); // Add empty row for spacing

                // Create rows for each bike's details
                tableLayout.addView(createDetailRow("Client", fetchedBikeId));
                tableLayout.addView(createDetailRow("Date From", dateFrom));
                tableLayout.addView(createDetailRow("Date To", dateTo));

            }
        } catch (JSONException e) {
            messageHelper.showError("Error updating UI. Please connect to the support!");
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
}