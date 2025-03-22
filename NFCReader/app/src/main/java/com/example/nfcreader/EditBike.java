package com.example.nfcreader;

import android.app.Dialog;
import android.app.PendingIntent;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class EditBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private String oldNfcContent = "";
    private String newNfcContent = "";
    private TextView newNfcTextView;
    private Button submitButton;
    private Button submitHelmetButton;
    private EditText bikeNameText;
    private OkHttpClient client = new OkHttpClient();
    private ArrayList<String> ownerList = new ArrayList<>();
    private Map<String, String> bikeIdMap = new HashMap<>();
    private AutoCompleteTextView bikeAutoCompleteTextView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_bike);

        bikeAutoCompleteTextView = findViewById(R.id.bikeAutoCompleteTextView);

        newNfcTextView = findViewById(R.id.newNfcTextView);
        submitButton = findViewById(R.id.editButton);
        submitHelmetButton = findViewById(R.id.editHelmetButton);
        bikeNameText = findViewById(R.id.bikeNameEditText);

        // Fetch bike from the server
        try {
            fetchAvailableBikesAndHelmets();
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        bikeAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedBikeName = (String) parent.getItemAtPosition(position);
            String bikeId = bikeIdMap.get(selectedBikeName);
            oldNfcContent = bikeId;
            bikeNameText.setText(selectedBikeName);
        });

        // Initialize NFC Adapter
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            Toast.makeText(this, "NFC is not available on this device.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        // Handle NFC intents
        handleIntent(getIntent());

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (!oldNfcContent.isEmpty() && !newNfcContent.isEmpty()) {
                String bikeName = bikeNameText.getText().toString().trim();

                // Check if bikeName matches the required format
                if (!bikeName.matches("^[0-9]{5}/[A-Za-z\\s]+$")) {
                    Toast.makeText(this, "Please enter a valid bike name (e.g., '12345/Bike Name')!", Toast.LENGTH_SHORT).show();
                    return;
                }

                sendDataToServer(oldNfcContent, newNfcContent, bikeName);

            } else {
                Toast.makeText(this, "No NFC content detected!", Toast.LENGTH_SHORT).show();
            }
        });

        submitHelmetButton.setOnClickListener(v -> {
            if (!oldNfcContent.isEmpty() && !newNfcContent.isEmpty()) {
                String helmetName = bikeNameText.getText().toString().trim();

                // Check if bikeName matches the required format
                if (!helmetName.matches("^[0-9]+/[A-Za-z\\s]+$")) {
                    Toast.makeText(this, "Please enter a valid bike name (e.g., '123/Helmet Name')!", Toast.LENGTH_SHORT).show();
                    return;
                }

                sendHelmetDataToServer(oldNfcContent, newNfcContent, helmetName);

            } else {
                Toast.makeText(this, "No NFC content detected!", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void fetchAvailableBikesAndHelmets() throws JSONException {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();

        jsonData.put("campId", GlobalVariable.getCamp(this));
        jsonData.put("isValidCode", GlobalVariable.getVariable(this));

        RequestBody body = RequestBody.create(JSON, jsonData.toString());

        Request bikeRequest = new Request.Builder()
                .url("https://bunker.bg/bikes")
                .post(body)
                .build();

        Request helmetRequest = new Request.Builder()
                .url("https://bunker.bg/helmets")
                .post(body)
                .build();

        AtomicInteger pendingRequests = new AtomicInteger(2); // Track pending requests
        JSONArray combinedArray = new JSONArray(); // Store combined results

        Callback commonCallback = new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                runOnUiThread(() -> {
                    Toast.makeText(EditBike.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    if (pendingRequests.decrementAndGet() == 0) {
                        loadingDialog.dismiss();
                    }
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            JSONArray dataArray = new JSONArray(responseData);
                            synchronized (combinedArray) { // Ensure thread safety
                                for (int i = 0; i < dataArray.length(); i++) {
                                    combinedArray.put(dataArray.getJSONObject(i));
                                }
                            }
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                        if (pendingRequests.decrementAndGet() == 0) {
                            // Once both requests complete, process combined result
                            try {
                                populateBikeAutoComplete(combinedArray);
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                            loadingDialog.dismiss();
                        }
                    });
                } else {
                    runOnUiThread(() -> {
                        Toast.makeText(EditBike.this, "Error fetching data", Toast.LENGTH_SHORT).show();
                        if (pendingRequests.decrementAndGet() == 0) {
                            loadingDialog.dismiss();
                        }
                    });
                }
            }
        };

        client.newCall(bikeRequest).enqueue(commonCallback);
        client.newCall(helmetRequest).enqueue(commonCallback);
    }

    private void populateBikeAutoComplete(JSONArray bikes) throws JSONException {

        ownerList.clear();
        bikeIdMap.clear();

        for (int i = 0; i < bikes.length(); i++) {
            JSONObject bike = bikes.getJSONObject(i);
            String bikeId = bike.getString("id");
            String bikeName = bike.getString("name");

            ownerList.add(bikeName);
            bikeIdMap.put(bikeName, bikeId);
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, ownerList);
        bikeAutoCompleteTextView.setAdapter(adapter);
    }

    private void sendDataToServer(String oldNfcContent, String newNfcContent, String bikeName) {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("oldBikeId", oldNfcContent);
            jsonData.put("newBikeId", newNfcContent);
            jsonData.put("bikeName", bikeName);
            jsonData.put("campId", GlobalVariable.getCamp(this));
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));

            RequestBody body = RequestBody.create(JSON, jsonData.toString());
            Request request = new Request.Builder()
                    .url("https://bunker.bg/editParameturBike")
                    .post(body)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    runOnUiThread(() -> {
                        Toast.makeText(EditBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        loadingDialog.dismiss();
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.body() != null) {
                        String responseData = response.body().string();
                        try {
                            JSONObject jsonResponse = new JSONObject(responseData);
                            if (response.isSuccessful()) {
                                String message = jsonResponse.optString("message", "Bike edit successfully.");
                                runOnUiThread(() -> {
                                    Toast.makeText(EditBike.this, message, Toast.LENGTH_SHORT).show();
                                    Intent intent = new Intent(EditBike.this, MainActivity.class);
                                    intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(intent);
                                    finish();
                                });
                            } else {
                                String error = jsonResponse.optString("error", "Server error occurred.");
                                runOnUiThread(() -> {
                                    Toast.makeText(EditBike.this, "Error: " + error, Toast.LENGTH_SHORT).show();
                                });
                            }
                        } catch (JSONException e) {
                            e.printStackTrace();
                            runOnUiThread(() -> {
                                Toast.makeText(EditBike.this, "Error processing response", Toast.LENGTH_SHORT).show();
                            });
                        }
                    } else {
                        runOnUiThread(() -> {
                            Toast.makeText(EditBike.this, "Response body is null", Toast.LENGTH_SHORT).show();
                            loadingDialog.dismiss();
                        });
                    }
                }
            });
        } catch (JSONException e) {
            e.printStackTrace();
            runOnUiThread(() -> {
                Toast.makeText(EditBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                loadingDialog.dismiss();
            });
        }
    }

    private void sendHelmetDataToServer(String oldNfcContent, String newNfcContent, String helmetName) {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("oldHelmetId", oldNfcContent);
            jsonData.put("newHelmetId", newNfcContent);
            jsonData.put("helmetName", helmetName);
            jsonData.put("campId", GlobalVariable.getCamp(this));
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));

            RequestBody body = RequestBody.create(JSON, jsonData.toString());
            Request request = new Request.Builder()
                    .url("https://bunker.bg/editParameturHelmet")
                    .post(body)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    runOnUiThread(() -> {
                        Toast.makeText(EditBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        loadingDialog.dismiss();
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.body() != null) {
                        String responseData = response.body().string();
                        try {
                            JSONObject jsonResponse = new JSONObject(responseData);
                            if (response.isSuccessful()) {
                                String message = jsonResponse.optString("message", "Helmet edit successfully.");
                                runOnUiThread(() -> {
                                    Toast.makeText(EditBike.this, message, Toast.LENGTH_SHORT).show();
                                    Intent intent = new Intent(EditBike.this, MainActivity.class);
                                    intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(intent);
                                    finish();
                                });
                            } else {
                                String error = jsonResponse.optString("error", "Server error occurred.");
                                runOnUiThread(() -> {
                                    Toast.makeText(EditBike.this, "Error: " + error, Toast.LENGTH_SHORT).show();
                                });
                            }
                        } catch (JSONException e) {
                            e.printStackTrace();
                            runOnUiThread(() -> {
                                Toast.makeText(EditBike.this, "Error processing response", Toast.LENGTH_SHORT).show();
                            });
                        }
                    } else {
                        runOnUiThread(() -> {
                            Toast.makeText(EditBike.this, "Response body is null", Toast.LENGTH_SHORT).show();
                            loadingDialog.dismiss();
                        });
                    }
                }
            });
        } catch (JSONException e) {
            e.printStackTrace();
            runOnUiThread(() -> {
                Toast.makeText(EditBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                loadingDialog.dismiss();
            });
        }
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
        if(tag != null) {
            // Get the NFC ID (UID)
            byte[] tagId = tag.getId();
            String nfcId = bytesToHex(tagId);
            newNfcContent = nfcId;

            newNfcTextView.setText("New NFC code: " + nfcId);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }
}