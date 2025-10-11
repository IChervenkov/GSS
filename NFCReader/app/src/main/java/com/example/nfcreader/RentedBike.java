package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;

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
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;

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

    private String campId;
    private String username;
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
    private OkHttpClient client;
    private AutoCompleteTextView clientAutoCompleteTextView;
    private final ArrayList<BikeInfo> ownerList = new ArrayList<>();
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
    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_rented_bike);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        clientAutoCompleteTextView = findViewById(R.id.clientAutoCompleteTextView);
        nfcTextView = findViewById(R.id.nfcTextView);
        nfcHelmetCode = findViewById(R.id.nfcHelmetCode);
        datePicker = findViewById(R.id.datePicker);
        timePicker = findViewById(R.id.timePicker);
        Button submitButton = findViewById(R.id.submitButton);
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            messageHelper.showError("NFC is not available on this device.");
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

            if (nfcContent.isEmpty()) {
                messageHelper.showError("Please scan a NFC tag");
                return;
            }

            // Get selected date and time
            int day = datePicker.getDayOfMonth();
            int month = datePicker.getMonth() + 1; // Month is 0-based
            int year = datePicker.getYear();
            int hour = timePicker.getHour();
            int minute = timePicker.getMinute();

            // Check if date and time are set
            if (day == 0 || month == 0 || year == 0) {
                messageHelper.showError("Please select a valid date!");
                return;
            }

            // Check if the bike type is selected
            String selectedClientName = clientAutoCompleteTextView.getText().toString();

            if (selectedClientName.isEmpty()) {
                messageHelper.showError("Please select a soldier!");
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

            new androidx.appcompat.app.AlertDialog.Builder(RentedBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to rent this bike?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            checkBikeRented(nfcContent, date, time, selectedClientId, nfcHelmetContent))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    private void fetchAvailableBikes() {

        if (isNetworkAvailable())
            return;

        Dialog loadingDialog = new Dialog(RentedBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/getClient?campId=" + campId)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                messageHelper.showError("Failed to fetch soldier. Please connect to the support.");
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        messageHelper.showError(errorMessage);
                        return;
                    }

                    JSONArray allSoldier = new JSONArray(responseData);
                    runOnUiThread(() -> populateBikeAutoComplete(allSoldier));

                } catch (Exception e) {
                    messageHelper.showError("Failed to fetch soldier. Please connect to the support.");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateBikeAutoComplete(JSONArray bikes) {

        try {
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

                BikeInfo bikeInfo = new BikeInfo(bikeName, !soldierKey.equals("null") ? soldierKey : "No key");

                ownerList.add(bikeInfo);
                clientIdMap.put(bikeInfo, bikeId);
                keyIdMap.put(bikeInfo, keyId);
                keyIdCountMap.put(keyId, countGetBikes);
            }

            ArrayAdapter<BikeInfo> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, ownerList);
            clientAutoCompleteTextView.setAdapter(adapter);

        } catch (Exception e) {
            messageHelper.showError("Failed to parsed soldier. Please connect to the support.");
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

            if (scanningIndex % 2 == 0) {
                String selectedClientName = null;

                for (Map.Entry<BikeInfo, String> entry : keyIdMap.entrySet()) {
                    if (entry.getValue().equals(nfcId)) {
                        selectedClientName = entry.getKey().toString(); // Assuming BikeInfo's toString() returns the name
                        break;
                    }
                }

                if (selectedClientName == null) {
                    messageHelper.showError("Soldier not found!");
                    scanningIndex++;
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

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        Dialog loadingDialog = new Dialog(RentedBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/readBikeNfc?nfcData=" + nfcData)
                .build();

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
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        messageHelper.showError(errorMessage);
                        return;
                    }

                    String bikeName = jsonResponse.getString("namebike");
                    String helmetCode = jsonResponse.getString("code");

                    if (!bikeName.isEmpty()) {
                        runOnUiThread(() -> nfcTextView.setText("Bike code: " + bikeName));
                        nfcContent = nfcData;

                    } else if (!helmetCode.isEmpty()) {
                        runOnUiThread(() -> nfcHelmetCode.setText("Helmet code: " + helmetCode));
                        nfcHelmetContent = nfcData;
                    }

                } catch (JSONException e) {
                    messageHelper.showError("Failed to read bike data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void checkBikeRented(String nfcData, String date, String time, String selectedClientId, String nfcHelmetDate) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RentedBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        // Define the request
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/checkBike?bikeId=" + nfcData)
                .build();

        // Make the network call asynchronously
        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                messageHelper.showError("Failed to read bike data. Please connect to the support!");
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        messageHelper.showError(errorMessage);
                        return;
                    }

                    if (isPastDateTime(date, time)) {
                        messageHelper.showError("The select date is incorrect!");
                        return;
                    }

                    sendDataToServer(nfcContent, date, time, selectedClientId, nfcHelmetDate);

                } catch (JSONException e) {
                    messageHelper.showError("Failed to read bike data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
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
            return false;
        }
    }

    private void sendDataToServer(String nfcData, String date, String time, String selectedClientId, String nfcHelmetDate) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performSendData(nfcData, date, time, selectedClientId, nfcHelmetDate);
    }

    private void performSendData(String nfcData, String date, String time, String selectedClientId, String nfcHelmetDate) {

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();

        try {
            jsonData.put("nfcData", nfcData);
            jsonData.put("date", date);
            jsonData.put("time", time);
            jsonData.put("selectClient", selectedClientId);
            jsonData.put("helmetId", nfcHelmetDate);
            jsonData.put("username", username);
        } catch (JSONException e) {
            messageHelper.showError("Error creating request data. Please contact support!");
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), JSON);

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/nfcRent")
                .post(body)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error to sending data. Please connect to the support!");
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);
                    String message = jsonResponse.optString("message", "Server error occurred.");

                    if (!response.isSuccessful()) {
                        messageHelper.showError(message);
                        return;
                    }

                    runOnUiThread(() -> {
                        Toast.makeText(RentedBike.this, message, Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(RentedBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });

                } catch (JSONException e) {
                    messageHelper.showError("Error to sending data. Please connect to the support!");
                }
            }
        });
    }
}
