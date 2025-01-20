package com.example.nfcreader;

import android.app.Dialog;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class SearchClient extends AppCompatActivity {

    private OkHttpClient client = new OkHttpClient();
    private ArrayList<String> ownerList = new ArrayList<>();
    private Map<String, String> clientIdMap = new HashMap<>();
    private AutoCompleteTextView clientAutoCompleteTextView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_search_client);

        clientAutoCompleteTextView = findViewById(R.id.clientAutoCompleteTextView);

        // Fetch client from the server
        fetchAvailableBikes();

        clientAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedClientName = (String) parent.getItemAtPosition(position);
            String clientId = clientIdMap.get(selectedClientName);
            loadBikeData(clientId);
        });
    }

    private void fetchAvailableBikes() {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchClient.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        new Thread(() -> {
            try {
                Request request = new Request.Builder()
                        .url("https://bunker.bg/getClient")
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful()) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            populateBikeAutoComplete(new JSONArray(responseData));
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    });
                } else {
                    runOnUiThread(() -> {
                        Toast.makeText(SearchClient.this, "Error fetching client", Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    Toast.makeText(SearchClient.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        }).start();
    }

    private void populateBikeAutoComplete(JSONArray bikes) throws JSONException {
        ownerList.clear();
        clientIdMap.clear();

        for (int i = 0; i < bikes.length(); i++) {
            JSONObject bike = bikes.getJSONObject(i);
            String bikeId = bike.getString("id");
            String bikeName = bike.getString("namesoldier");

            ownerList.add(bikeName);
            clientIdMap.put(bikeName, bikeId);
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, ownerList);
        clientAutoCompleteTextView.setAdapter(adapter);
    }

    private void loadBikeData(String bikeId) {
        // Create JSON object with the bike ID to send to the server
        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("id", bikeId);
        } catch (JSONException e) {
            e.printStackTrace();
            Toast.makeText(this, "Error creating JSON: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), JSON);

        // Make network request to your server endpoint
        Request request = new Request.Builder()
                .url("https://bunker.bg/searchClient")
                .post(body)
                .build();

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(SearchClient.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(SearchClient.this, "Error fetching data from server: " + e.getMessage(), Toast.LENGTH_SHORT).show();
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
                                Toast.makeText(SearchClient.this, "Error parsing data: " + e.getMessage(), Toast.LENGTH_SHORT).show()
                        );
                    }
                } else {
                    runOnUiThread(() ->
                            Toast.makeText(SearchClient.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show()
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