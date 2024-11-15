package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Bundle;
import android.os.Parcelable;
import android.util.Log;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.DatePicker;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class RentedBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private TextView nfcTextView;
    private DatePicker datePicker;
    private TimePicker timePicker;
    private Button submitButton;
    private String nfcContent = "";
    private Map<String, String> clientIdMap = new HashMap<>();

    private OkHttpClient client = new OkHttpClient();

    private AutoCompleteTextView clientAutoCompleteTextView;
    private ArrayList<String> ownerList = new ArrayList<>();

    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_rented_bike);

        clientAutoCompleteTextView = findViewById(R.id.clientAutoCompleteTextView);
        nfcTextView = findViewById(R.id.nfcTextView);
        datePicker = findViewById(R.id.datePicker);
        timePicker = findViewById(R.id.timePicker);
        submitButton = findViewById(R.id.submitButton);
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            Toast.makeText(this, "NFC is not available on this device.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        // Fetch client from the server
        fetchAvailableBikes();

        // Handle NFC intents
        handleIntent(getIntent());

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (!nfcContent.isEmpty()) {
                // Get selected date and time
                int day = datePicker.getDayOfMonth();
                int month = datePicker.getMonth() + 1; // Month is 0-based
                int year = datePicker.getYear();
                int hour = timePicker.getHour();
                int minute = timePicker.getMinute();

                // Check if date and time are set
                if (day == 0 || month == 0 || year == 0) {
                    Toast.makeText(this, "Please select a valid date!", Toast.LENGTH_SHORT).show();
                    return;
                }

                // Check if the bike type is selected
                String selectedClientName  = clientAutoCompleteTextView.getText().toString();
                String selectedClientId = clientIdMap.get(selectedClientName );

                if (selectedClientName.isEmpty()) {
                    Toast.makeText(this, "Please select a client!", Toast.LENGTH_SHORT).show();
                    return;
                }

                String date = year + "-" + (month < 10 ? "0" + month : month) + "-" + (day < 10 ? "0" + day : day);
                String time = (hour < 10 ? "0" + hour : hour) + ":" + (minute < 10 ? "0" + minute : minute);

                checkBikeRented(nfcContent, date, time, selectedClientId);

            } else {
                Toast.makeText(this, "No NFC content detected!", Toast.LENGTH_SHORT).show();
            }
        });
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
                        Toast.makeText(RentedBike.this, "Error fetching client", Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    Toast.makeText(RentedBike.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
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
        OkHttpClient client = new OkHttpClient();

        // Prepare the JSON request body
        JSONObject json = new JSONObject();
        try {
            json.put("nfcData", nfcData);
        } catch (JSONException e) {
            e.printStackTrace();
        }

        RequestBody body = RequestBody.create(json.toString(), MediaType.get("application/json; charset=utf-8"));

        // Define the request
        Request request = new Request.Builder()
                .url("https://bunker.bg/readBikeNfc")  // Replace with your server URL
                .post(body)
                .build();

        // Make the network call asynchronously
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    Toast.makeText(RentedBike.this, "Failed to read bike data", Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
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
                        Toast.makeText(RentedBike.this, "Bike not found", Toast.LENGTH_SHORT).show();
                    });
                }
            }
        });
    }

    private void checkBikeRented(String nfcData, String date, String time, String selectedClientId) {
        OkHttpClient client = new OkHttpClient();

        // Prepare the JSON request body
        JSONObject json = new JSONObject();
        try {
            json.put("bikeId", nfcData);
        } catch (JSONException e) {
            e.printStackTrace();
        }

        RequestBody body = RequestBody.create(json.toString(), MediaType.get("application/json; charset=utf-8"));

        // Define the request
        Request request = new Request.Builder()
                .url("https://bunker.bg/checkBike")  // Replace with your server URL
                .post(body)
                .build();

        // Make the network call asynchronously
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    Toast.makeText(RentedBike.this, "Failed to read bike data", Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    String responseData = response.body().string();
                    try {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        final String status = jsonResponse.getString("status");

                        if(isPastDateTime(date, time)) {
                            runOnUiThread(() -> {
                                Toast.makeText(RentedBike.this, "The select date is incorrect!", Toast.LENGTH_SHORT).show();
                            });
                        } else if(!status.equals("Available")) {
                            runOnUiThread(() -> {
                                Toast.makeText(RentedBike.this, "The bike is already rented!", Toast.LENGTH_SHORT).show();
                            });
                        } else {
                            // Send data to the server
                            sendDataToServer(nfcContent, date, time, selectedClientId);
                        }

                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                } else {
                    runOnUiThread(() -> {
                        Toast.makeText(RentedBike.this, "Bike not found", Toast.LENGTH_SHORT).show();
                    });
                }
            }
        });
    }

    // Method to check if the response date and time are in the past
    private boolean isPastDateTime(String date, String time) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault());
        try {
            Date parsedDate = sdf.parse(date + " " + time);

            // Get the current date and time
            Calendar calendar = Calendar.getInstance();
            calendar.setTime(new Date());

            Date currentDate = calendar.getTime();

            return parsedDate != null && parsedDate.after(currentDate);
        } catch (ParseException e) {
            e.printStackTrace();
            return false;
        }
    }


    private void sendDataToServer(String nfcData, String date, String time, String selectedClientId) {
        new Thread(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject jsonData = new JSONObject();
                jsonData.put("nfcData", nfcData);
                jsonData.put("date", date);
                jsonData.put("time", time);
                jsonData.put("selectClient", selectedClientId); // Include the client type

                RequestBody body = RequestBody.create(JSON, jsonData.toString());

                Request request = new Request.Builder()
                        .url("https://bunker.bg/nfcRent")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();

                if (response.isSuccessful()) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        Toast.makeText(RentedBike.this, "Server response: " + responseData, Toast.LENGTH_SHORT).show();

                        // Navigate back to the main page
                        Intent intent = new Intent(RentedBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });
                } else {
                    runOnUiThread(() -> {
                        Toast.makeText(RentedBike.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    Toast.makeText(RentedBike.this, "Error sending data to the server: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }
        }).start();
    }
}
