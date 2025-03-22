package com.example.nfcreader;

import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Typeface;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.os.Bundle;
import android.nfc.NfcAdapter;
import android.os.Parcelable;
import android.view.View;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;
import android.nfc.Tag;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class SearchBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private String nfcContent = "";
    private TextView nfcTextView;
    private OkHttpClient client = new OkHttpClient();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_search_bike);

        nfcTextView = findViewById(R.id.bike_info);

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

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        if (tag != null) {
            // Get the NFC ID (UID)
            byte[] tagId = tag.getId();
            String nfcId = bytesToHex(tagId);
            nfcContent = nfcId;

            // Call the server with the NFC data
            readBikeDataFromServer(nfcId);

            loadBikeData(nfcContent);
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

        // Prepare the JSON request body
        JSONObject json = new JSONObject();
        try {
            json.put("nfcData", nfcData);
            json.put("isValidCode", GlobalVariable.getVariable(this));
        } catch (JSONException e) {
            e.printStackTrace();
        }

        RequestBody body = RequestBody.create(json.toString(), MediaType.get("application/json; charset=utf-8"));

        // Define the request
        Request request = new Request.Builder()
                .url("https://bunker.bg/readBikeNfc")  // Replace with your server URL
                .post(body)
                .build();

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        // Make the network call asynchronously
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(SearchBike.this, "Failed to read bike data", Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {

                runOnUiThread(loadingDialog::dismiss);

                if (response.isSuccessful()) {
                    String responseData = response.body().string();
                    try {
                        // Parse the response if it's JSON
                        JSONObject jsonResponse = new JSONObject(responseData);
                        final String bikeName = jsonResponse.getString("namebike");

                        // Update the UI with the bike name
                        runOnUiThread(() -> nfcTextView.setText("Bike code: " + bikeName));
                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                } else {
                    runOnUiThread(() -> {
                        Toast.makeText(SearchBike.this, "Bike not found", Toast.LENGTH_SHORT).show();
                    });
                }
            }
        });
    }

    private void loadBikeData(String bikeId) {
        // Create JSON object with the bike ID to send to the server
        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("id", bikeId);
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));
        } catch (JSONException e) {
            e.printStackTrace();
            Toast.makeText(this, "Error creating JSON: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), JSON);

        // Make network request to your server endpoint
        Request request = new Request.Builder()
                .url("https://bunker.bg/searchBikes")
                .post(body)
                .build();

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(SearchBike.this, "Error fetching data from server: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {

                runOnUiThread(loadingDialog::dismiss);

                if (response.isSuccessful() && response.body() != null) {
                    String responseData = response.body().string();
                    try {
                        JSONArray bikesArray = new JSONArray(responseData);
                        runOnUiThread(() -> updateTableLayout(bikesArray));
                    } catch (JSONException e) {
                        e.printStackTrace();
                        runOnUiThread(() ->
                                Toast.makeText(SearchBike.this, "Error parsing data: " + e.getMessage(), Toast.LENGTH_SHORT).show()
                        );
                    }
                } else {
                    runOnUiThread(() ->
                            Toast.makeText(SearchBike.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show()
                    );
                }
            }
        });
    }

    private void updateTableLayout(JSONArray bikesArray) {
        try {
            TableLayout tableLayout = findViewById(R.id.table_layout);
            tableLayout.removeAllViews();
            tableLayout.setPadding(0,0,0,10);

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
            e.printStackTrace();
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

    // Method to create a spacer View
    private View createSpacer() {
        View spacer = new View(this);
        TableRow.LayoutParams params = new TableRow.LayoutParams(TableRow.LayoutParams.MATCH_PARENT, 100); // Height of the spacer
        spacer.setLayoutParams(params);
        return spacer;
    }
}