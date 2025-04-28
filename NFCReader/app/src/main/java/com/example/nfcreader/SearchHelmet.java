package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Typeface;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

import java.util.Objects;

import okhttp3.Call;
import okhttp3.Callback;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SearchHelmet extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private TextView nfcTextView;
    private final OkHttpClient client = new OkHttpClient();

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_search_helmet);

        nfcTextView = findViewById(R.id.helmet_info);

        // Initialize NFC Adapter
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            Toast.makeText(this, "NFC is not available on this device.", Toast.LENGTH_LONG).show();
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

            // Call the server with the NFC data
            readHelmetDataFromServer(nfcId);

            loadHelmetData(nfcId);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    private void readHelmetDataFromServer(String nfcData) {

        // Define the request
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/readBikeNfc?nfcData=" + nfcData + "&isValidCode=" + GlobalVariable.getVariable(this))
                .build();

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchHelmet.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        // Make the network call asynchronously
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Log.e("SearchHelmet", "Error: " + e.getMessage());
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(SearchHelmet.this, "Failed to read helmet data", Toast.LENGTH_SHORT).show();
                });
            }

            @SuppressLint("SetTextI18n")
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                runOnUiThread(loadingDialog::dismiss);

                if (response.isSuccessful()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    try {
                        // Parse the response if it's JSON
                        JSONObject jsonResponse = new JSONObject(responseData);
                        final String helmetName = jsonResponse.getString("code");

                        // Update the UI with the bike name
                        runOnUiThread(() -> nfcTextView.setText("Helmet code: " + helmetName));
                    } catch (JSONException e) {
                        Log.e("SearchHelmet", "Error: " + e.getMessage());
                    }
                } else {
                    runOnUiThread(() -> Toast.makeText(SearchHelmet.this, "Helmet not found", Toast.LENGTH_SHORT).show());
                }
            }
        });
    }

    private void loadHelmetData(String bikeId) {

        // Make network request to your server endpoint
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/searchHelmet?id=" + bikeId + "&isValidCode=" + GlobalVariable.getVariable(this))
                .build();

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchHelmet.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(SearchHelmet.this, "Error fetching data from server: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                runOnUiThread(loadingDialog::dismiss);

                if (response.isSuccessful() && response.body() != null) {
                    String responseData = response.body().string();
                    try {
                        JSONArray helmetsArray = new JSONArray(responseData);
                        runOnUiThread(() -> updateTableLayout(helmetsArray));
                    } catch (JSONException e) {
                        Log.e("SearchHelmet", "Error: " + e.getMessage());
                        runOnUiThread(() ->
                                Toast.makeText(SearchHelmet.this, "Error parsing data: " + e.getMessage(), Toast.LENGTH_SHORT).show()
                        );
                    }
                } else {
                    runOnUiThread(() ->
                            Toast.makeText(SearchHelmet.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show()
                    );
                }
            }
        });
    }

    private void updateTableLayout(JSONArray helmetsArray) {
        try {
            TableLayout tableLayout = findViewById(R.id.table_layout);
            tableLayout.removeAllViews();
            tableLayout.setPadding(0,0,0,10);

            // Iterate through the JSON array to extract each bike's data
            for (int i = 0; i < helmetsArray.length(); i++) {
                JSONObject helmet = helmetsArray.getJSONObject(i);
                String fetchedBikeId = helmet.getString("namesoldier");
                String dateFrom = helmet.getString("datefrom");
                String dateTo = helmet.getString("dateto");

                tableLayout.addView(createSpacer()); // Add empty row for spacing

                // Create rows for each bike's details
                tableLayout.addView(createDetailRow("Client", fetchedBikeId));
                tableLayout.addView(createDetailRow("Date From", dateFrom));
                tableLayout.addView(createDetailRow("Date To", dateTo));

            }
        } catch (JSONException e) {
            Log.e("SearchHelmet", "Error: " + e.getMessage());
            Toast.makeText(this, "Error updating UI: " + e.getMessage(), Toast.LENGTH_SHORT).show();
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

    private View createSpacer() {
        View spacer = new View(this);
        TableRow.LayoutParams params = new TableRow.LayoutParams(TableRow.LayoutParams.MATCH_PARENT, 100); // Height of the spacer
        spacer.setLayoutParams(params);
        return spacer;
    }
}