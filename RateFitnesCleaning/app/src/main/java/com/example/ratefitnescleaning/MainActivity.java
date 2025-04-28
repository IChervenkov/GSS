package com.example.ratefitnescleaning;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import android.util.Log;

import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Toast;

import okhttp3.FormBody;
import okhttp3.JavaNetCookieJar;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

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

public class MainActivity extends AppCompatActivity {

    private String clientId = null;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private final ArrayList<String> ownerList = new ArrayList<>();
    private final Map<String, String> clientIdMap = new HashMap<>();
    private AutoCompleteTextView clientAutoCompleteTextView;
    private final ExecutorService executorService = Executors.newFixedThreadPool(3);

    private void fetchCsrfToken() {

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
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
            }
        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        clientAutoCompleteTextView = findViewById(R.id.clientAutoCompleteTextView);

        fetchCsrfToken();

        // Fetch client from the server
        fetchAvailableBikes();

        clientAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedClientName = (String) parent.getItemAtPosition(position);
            clientId = clientIdMap.get(selectedClientName);
            onClientSelected();
        });
    }

    private void onClientSelected() {

        if (clientId == null || clientId.isEmpty()) {
            // User ID is not entered
            Toast.makeText(this, "Please enter your ID first", Toast.LENGTH_SHORT).show();
        } else {
            // User ID and emoji are ready, now send to serve
            sendClientData(clientId);
        }
    }

    // Modify the sendEmojiData method to include modal and clear old data
    private void sendClientData(String userId) {
        executorService.execute(() -> {
            try {
                // Prepare the request body
                RequestBody body = new FormBody.Builder()
                        .add("userId", userId)
                        .build();

                // Make the request to the server
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/sendClientData") // Replace with your endpoint
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful()) {
                    // Handle success
                    runOnUiThread(() -> {
                        Intent intent = new Intent(MainActivity.this, Rated.class);
                        startActivity(intent);
                        finish();
                        clearOldData();
                    });
                } else {
                    // Handle failure
                    runOnUiThread(() -> showErrorDialog("Failed to send your data. Try again"));
                }
            } catch (IOException e) {
                Log.e("MainActivity", "Error: " + e.getMessage());
                runOnUiThread(() -> showErrorDialog("Error: " + e.getMessage()));
            }
        });
    }

    // Method to show error dialog
    private void showErrorDialog(String message) {
        new AlertDialog.Builder(MainActivity.this)
                .setTitle("Error")
                .setMessage(message)
                .setPositiveButton("OK", (dialog, which) -> {
                    // Do something when OK is clicked (if needed)
                })
                .setCancelable(false)
                .show();
    }

    private void fetchAvailableBikes() {
        executorService.execute(() -> {
            try {
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/getClient")
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful()) {
                    final String responseData = Objects.requireNonNull(response.body()).string();
                    runOnUiThread(() -> {
                        try {
                            populateBikeAutoComplete(new JSONArray(responseData));
                        } catch (JSONException e) {
                            Log.e("MainActivity", "Error: " + e.getMessage());
                        }
                    });
                } else {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error fetching client", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                Log.e("MainActivity", "Error: " + e.getMessage());
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        });
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

    // Clear old data (clientId and selectedEmoji)
    private void clearOldData() {
        clientId = null;
        clientAutoCompleteTextView.setText(""); // Clear the text
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly
    }
}