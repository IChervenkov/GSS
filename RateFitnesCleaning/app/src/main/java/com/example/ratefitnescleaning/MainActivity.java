package com.example.ratefitnescleaning;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.material.button.MaterialButton;

import okhttp3.FormBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private String clientId = null;
    private final OkHttpClient client = HttpClientSingleton.getInstance();
    private ArrayList<String> ownerList = new ArrayList<>();
    private Map<String, String> clientIdMap = new HashMap<>();
    private AutoCompleteTextView clientAutoCompleteTextView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        clientAutoCompleteTextView = findViewById(R.id.clientAutoCompleteTextView);

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
        new Thread(() -> {
            try {
                // Prepare the request body
                RequestBody body = new FormBody.Builder()
                        .add("userId", userId)
                        .build();

                // Make the request to the server
                Request request = new Request.Builder()
                        .url("https://bunker.bg/sendClientData") // Replace with your endpoint
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
                    runOnUiThread(() -> {
                        showErrorDialog("Failed to send your data. Try again");
                    });
                }
            } catch (IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    showErrorDialog("Error: " + e.getMessage());
                });
            }
        }).start();
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
                        Toast.makeText(MainActivity.this, "Error fetching client", Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
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

    // Clear old data (clientId and selectedEmoji)
    private void clearOldData() {
        clientId = null;
        clientAutoCompleteTextView.setText(""); // Clear the text
    }
}