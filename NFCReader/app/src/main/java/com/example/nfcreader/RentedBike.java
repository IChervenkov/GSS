package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;

import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;

import android.util.Log;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.DatePicker;

import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class RentedBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private TextView nfcTextView;
    private TextView nfcHelmetCode;
    private DatePicker datePicker;
    private TimePicker timePicker;
    private String nfcContent = "";
    private String nfcHelmetContent = "";
    private Integer scanningIndex = 1;
    private final Map<BikeInfo, String> clientIdMap = new HashMap<>();
    private final Map<BikeInfo, String> keyIdMap = new HashMap<>();
    private final Map<String, String> keyIdCountMap = new HashMap<>();
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private AutoCompleteTextView clientAutoCompleteTextView;
    private final ArrayList<BikeInfo> ownerList = new ArrayList<>();

    private void fetchCsrfToken() {

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/csrf-token")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> Toast.makeText(RentedBike.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                if (response.isSuccessful() && response.body() != null) {
                    try {
                        String responseBody = response.body().string();
                        JSONObject jsonObject = new JSONObject(responseBody);
                        csrfToken = jsonObject.getString("csrfToken");
                    } catch (JSONException e) {
                        runOnUiThread(() -> Toast.makeText(RentedBike.this, "Error parsing token", Toast.LENGTH_SHORT).show());
                    }
                } else {
                    runOnUiThread(() -> Toast.makeText(RentedBike.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_rented_bike);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        clientAutoCompleteTextView = findViewById(R.id.clientAutoCompleteTextView);
        nfcTextView = findViewById(R.id.nfcTextView);
        nfcHelmetCode = findViewById(R.id.nfcHelmetCode);
        datePicker = findViewById(R.id.datePicker);
        timePicker = findViewById(R.id.timePicker);
        Button submitButton = findViewById(R.id.submitButton);
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

        clientAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            BikeInfo selectedBikeInfo = (BikeInfo) parent.getItemAtPosition(position);

            // Fetch the ID from the map using the selected BikeInfo
            String selectedClientKeyId = keyIdMap.get(selectedBikeInfo);
            String selectClientCount = keyIdCountMap.get(selectedClientKeyId);

            if (selectClientCount != null && Integer.parseInt(selectClientCount) > 0)
                showPopup("Soldier: " + selectedBikeInfo + "\nNumber of bikes taken: " + selectClientCount);
        });

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

                if (selectedClientName.isEmpty()) {
                    Toast.makeText(this, "Please select a client!", Toast.LENGTH_SHORT).show();
                    return;
                }

                // Find the selected BikeInfo
                BikeInfo selectedBikeInfo = null;
                for (BikeInfo bike : ownerList) {
                    if (selectedClientName.equals(bike.toString())) {
                        selectedBikeInfo = bike;
                        break;
                    }
                }

                // Get the ID of the selected bike
                String selectedClientId = clientIdMap.get(selectedBikeInfo);

                String date = year + "-" + (month < 10 ? "0" + month : month) + "-" + (day < 10 ? "0" + day : day);
                String time = (hour < 10 ? "0" + hour : hour) + ":" + (minute < 10 ? "0" + minute : minute);

                checkBikeRented(nfcContent, date, time, selectedClientId, nfcHelmetContent);

            } else {
                Toast.makeText(this, "No NFC content detected!", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void fetchAvailableBikes() {
        runOnUiThread(() -> {
            Dialog loadingDialog = new Dialog(RentedBike.this);
            loadingDialog.setContentView(R.layout.progress_dialog);
            loadingDialog.setCancelable(false);
            Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
            loadingDialog.show();

            String baseUrl = getString(R.string.base_url);
            Request request = new Request.Builder()
                    .url(baseUrl + "/getClient?campId=" + GlobalVariable.getCamp(this) + "&isValidCode=" + GlobalVariable.getVariable(this))
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    runOnUiThread(() -> {
                        loadingDialog.dismiss();
                        Toast.makeText(RentedBike.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    });
                }

                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) {
                    try (response) {
                        if (response.isSuccessful() && response.body() != null) {
                            String responseData = response.body().string();
                            runOnUiThread(() -> {
                                loadingDialog.dismiss();
                                try {
                                    populateBikeAutoComplete(new JSONArray(responseData));
                                } catch (JSONException e) {
                                    Log.e("RentedBike", "Error: " + e.getMessage());
                                }
                            });
                        } else {
                            runOnUiThread(() -> {
                                loadingDialog.dismiss();
                                Toast.makeText(RentedBike.this, "Error fetching client", Toast.LENGTH_SHORT).show();
                            });
                        }
                    } catch (Exception e) {
                        Log.e("RentedBike", "Error: " + e.getMessage());
                        runOnUiThread(() -> {
                            loadingDialog.dismiss();
                            Toast.makeText(RentedBike.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        });
                    }
                }
            });
        });
    }

    private void populateBikeAutoComplete(JSONArray bikes) throws JSONException {
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

            BikeInfo bikeInfo = new BikeInfo(bikeName, soldierKey);

            ownerList.add(bikeInfo);
            clientIdMap.put(bikeInfo, bikeId);
            keyIdMap.put(bikeInfo, keyId);
            keyIdCountMap.put(keyId, countGetBikes);
        }

        ArrayAdapter<BikeInfo> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, ownerList);
        clientAutoCompleteTextView.setAdapter(adapter);
    }

    @Override
    protected void onResume() {
        super.onResume();

        fetchCsrfToken();

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

            if(scanningIndex % 2 == 0) {
                String selectedClientName = null;

                for (Map.Entry<BikeInfo, String> entry : keyIdMap.entrySet()) {
                    if (entry.getValue().equals(nfcId)) {
                        selectedClientName = entry.getKey().toString(); // Assuming BikeInfo's toString() returns the name
                        break;
                    }
                }

                if (selectedClientName == null) {
                    Toast.makeText(this, "Soldier not found!", Toast.LENGTH_SHORT).show();
                    return;
                }

                String selectedClientCount = keyIdCountMap.get(nfcId);

                clientAutoCompleteTextView.setText(selectedClientName);

                if (selectedClientCount != null && Integer.parseInt(selectedClientCount) > 0)
                    showPopup("Soldier: " + selectedClientName + "\nNumber of bikes taken: " + selectedClientCount);
            }

            scanningIndex++;

            // Call the server with the NFC data
            readBikeDataFromServer(nfcId);
        }
    }

    private void showPopup(String message) {
        new AlertDialog.Builder(this)
                .setTitle("Soldier Information")
                .setMessage(message)
                .setPositiveButton("OK", (dialog, which) -> dialog.dismiss())
                .setCancelable(false)
                .show();
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
        runOnUiThread(() -> {
            Dialog loadingDialog = new Dialog(RentedBike.this);
            loadingDialog.setContentView(R.layout.progress_dialog);
            loadingDialog.setCancelable(false);
            Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
            loadingDialog.show();

            String baseUrl = getString(R.string.base_url);
            Request request = new Request.Builder()
                    .url(baseUrl + "/readBikeNfc?nfcData=" + nfcData + "&isValidCode=" + GlobalVariable.getVariable(this))  // Replace with your server URL
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    runOnUiThread(() -> {
                        loadingDialog.dismiss();
                        Toast.makeText(RentedBike.this, "Failed to read bike data", Toast.LENGTH_SHORT).show();
                    });
                }

                @SuppressLint("SetTextI18n")
                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    runOnUiThread(() -> {
                        loadingDialog.dismiss();
                        try {
                            JSONObject jsonResponse = new JSONObject(responseData);
                            String bikeName = jsonResponse.getString("namebike");
                            String helmetCode = jsonResponse.getString("code");

                            if(!bikeName.isEmpty()) {
                                nfcTextView.setText("Bike code: " + bikeName);
                                nfcContent = nfcData;
                            }
                            else if(!helmetCode.isEmpty()) {
                                nfcHelmetCode.setText("Helmet code: " + helmetCode);
                                nfcHelmetContent = nfcData;
                            }

                        } catch (JSONException e) {
                            Log.e("RentedBike", "Error: " + e.getMessage());
                        }
                    });
                }
            });
        });
    }

    private void checkBikeRented(String nfcData, String date, String time, String selectedClientId, String nfcHelmetDate) {

        // Define the request
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/checkBike?bikeId=" + nfcData + "&isValidCode=" + GlobalVariable.getVariable(this))  // Replace with your server URL
                .build();

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RentedBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        // Make the network call asynchronously
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Log.e("RentedBike", "Error: " + e.getMessage());
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(RentedBike.this, "Failed to read bike data", Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                runOnUiThread(loadingDialog::dismiss);

                if (response.isSuccessful()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    try {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        final String status = jsonResponse.getString("status");

                        if(isPastDateTime(date, time)) {
                            runOnUiThread(() -> Toast.makeText(RentedBike.this, "The select date is incorrect!", Toast.LENGTH_SHORT).show());
                        } else if(!status.equals("Available")) {
                            runOnUiThread(() -> Toast.makeText(RentedBike.this, "The bike is already rented!", Toast.LENGTH_SHORT).show());
                        } else {
                            // Send data to the server
                            fetchCsrfToken();
                            sendDataToServer(nfcContent, date, time, selectedClientId, nfcHelmetDate);
                        }

                    } catch (JSONException e) {
                        Log.e("RentedBike", "Error: " + e.getMessage());
                    }
                } else {
                    runOnUiThread(() -> Toast.makeText(RentedBike.this, "Bike not found", Toast.LENGTH_SHORT).show());
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
            Log.e("RentedBike", "Error: " + e.getMessage());
            return false;
        }
    }

    private void sendDataToServer(String nfcData, String date, String time, String selectedClientId, String nfcHelmetDate) {

        try {
            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
            JSONObject jsonData = new JSONObject();
            jsonData.put("nfcData", nfcData);
            jsonData.put("date", date);
            jsonData.put("time", time);
            jsonData.put("selectClient", selectedClientId);
            jsonData.put("helmetId", nfcHelmetDate);
            jsonData.put("username", GlobalVariable.getUsername(this));
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));

            RequestBody body = RequestBody.create(jsonData.toString(), JSON);

            String baseUrl = getString(R.string.base_url);
            Request request = new Request.Builder()
                    .url(baseUrl + "/nfcRent")
                    .addHeader("X-CSRF-Token", csrfToken)
                    .post(body)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    Log.e("RentedBike", "Error: " + e.getMessage());
                    runOnUiThread(() -> Toast.makeText(RentedBike.this, "Error sending data: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                }

                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                    if (response.isSuccessful()) {
                        String responseData = Objects.requireNonNull(response.body()).string();
                        runOnUiThread(() -> {
                            Toast.makeText(RentedBike.this, "Server response: " + responseData, Toast.LENGTH_SHORT).show();
                            Intent intent = new Intent(RentedBike.this, MainActivity.class);
                            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                            finish();
                        });
                    } else {
                        runOnUiThread(() -> Toast.makeText(RentedBike.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show());
                    }
                }
            });
        } catch (JSONException e) {
            Log.e("RentedBike", "Error: " + e.getMessage());
            runOnUiThread(() -> Toast.makeText(RentedBike.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
        }
    }
}
