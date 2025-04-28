package com.example.rfidlaundryasset;

import android.app.Dialog;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.Log;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.ImageView;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class Inventory extends AppCompatActivity {

    private final OkHttpClient client = new OkHttpClient();
    private final ArrayList<String> ownerList = new ArrayList<>();
    private final Map<String, String> locationIdMap = new HashMap<>();
    private AutoCompleteTextView locationAutoCompleteTextView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inventory);

        locationAutoCompleteTextView = findViewById(R.id.locationAutoCompleteTextView);

        // Fetch room from the server
        fetchRoom();

        locationAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedLocationInfo = (String) parent.getItemAtPosition(position);

            String selectedLocationId = locationIdMap.get(selectedLocationInfo);

            loadAssetData(selectedLocationId);
        });
    }

    private void fetchRoom() {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(Inventory.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/getInventoryLocation?isValidCode=" + GlobalVariable.getVariable(this) + "&campId=" + GlobalVariable.getCamp(this))
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(Inventory.this, "Error fetching location: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                loadingDialog.dismiss();
                if (response.isSuccessful() && response.body() != null) {
                    String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            populateLocationAutoComplete(new JSONArray(responseData));
                        } catch (JSONException e) {
                            Log.e("Inventory", "Error: " + e.getMessage());
                            Toast.makeText(Inventory.this, "JSON Parsing Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    runOnUiThread(() ->
                            Toast.makeText(Inventory.this, "Error fetching inventory data, code: " + response.code(), Toast.LENGTH_SHORT).show()
                    );
                }
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

        // Make network request to your server endpoint
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/assets/getSortedAssets?numRoom=" + locationId + "&campId=" + GlobalVariable.getCamp(this) + "&isValidCode=" + GlobalVariable.getVariable(this))
                .build();

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(Inventory.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(Inventory.this, "Error fetching data from server: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                runOnUiThread(loadingDialog::dismiss);

                if (response.isSuccessful() && response.body() != null) {
                    String responseData = response.body().string();
                    try {
                        JSONArray assetsArray = new JSONArray(responseData);
                        runOnUiThread(() -> updateTableLayout(assetsArray));
                    } catch (JSONException e) {
                        Log.e("Inventory", "Error: " + e.getMessage());
                        runOnUiThread(() ->
                                Toast.makeText(Inventory.this, "Error parsing data: " + e.getMessage(), Toast.LENGTH_SHORT).show()
                        );
                    }
                } else {
                    runOnUiThread(() ->
                            Toast.makeText(Inventory.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show()
                    );
                }
            }
        });
    }

    private void updateTableLayout(JSONArray assetsArray) {
        try {
            TableLayout tableLayout = findViewById(R.id.table_assets_location);
            tableLayout.removeAllViews();
            tableLayout.setPadding(0,0,0,10);

            // Add table headers (optional)
            TableRow headerRow = new TableRow(this);
            String[] headers = {"Status", "Code", "Name", "Quantity"};
            for (String header : headers) {
                TextView tv = new TextView(this);
                tv.setText(header);
                tv.setPadding(16, 16, 16, 16);
                tv.setTypeface(null, Typeface.BOLD);
                headerRow.addView(tv);
            }
            tableLayout.addView(headerRow);

            // Iterate through the JSON array to extract each bike's data
            for (int i = 0; i < assetsArray.length(); i++) {
                JSONObject asset = assetsArray.getJSONObject(i);
                String assetStatus = asset.getString("status");
                String assetCode = asset.getString("code");
                String assetName = asset.getString("name");
                String assetQuantity = asset.getString("quantity");

                TableRow row = new TableRow(this);
                row.setPadding(10, 10, 10, 10);

                // Create status icon
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
                row.addView(statusIcon);

                // Add asset code
                TextView codeView = new TextView(this);
                codeView.setText(assetCode);
                codeView.setPadding(16, 0, 16, 0);
                row.addView(codeView);

                // Add asset name
                TextView nameView = new TextView(this);
                nameView.setText(assetName);
                nameView.setPadding(16, 0, 16, 0);
                row.addView(nameView);

                // Add asset quantity
                TextView quantityView = new TextView(this);
                quantityView.setText(assetQuantity);
                quantityView.setPadding(16, 0, 16, 0);
                row.addView(quantityView);

                // Add row to table
                tableLayout.addView(row);

            }
        } catch (JSONException e) {
            Log.e("SearchClient", "Error: " + e.getMessage());
            Toast.makeText(this, "Error updating UI: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }
}