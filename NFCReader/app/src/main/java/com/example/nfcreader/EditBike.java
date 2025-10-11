package com.example.nfcreader;

import android.annotation.SuppressLint;
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
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class EditBike extends AppCompatActivity {

    private String campId;
    private String username;
    private NfcAdapter nfcAdapter;
    private String oldNfcContent = "";
    private String newNfcContent = "";
    private TextView newNfcTextView;
    private EditText bikeNameText;
    private OkHttpClient client;
    private final ArrayList<String> ownerList = new ArrayList<>();
    private final Map<String, String> bikeIdMap = new HashMap<>();
    private AutoCompleteTextView bikeAutoCompleteTextView;
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
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_bike);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        bikeAutoCompleteTextView = findViewById(R.id.bikeAutoCompleteTextView);

        newNfcTextView = findViewById(R.id.newNfcTextView);
        Button submitButton = findViewById(R.id.editButton);
        Button submitHelmetButton = findViewById(R.id.editHelmetButton);
        bikeNameText = findViewById(R.id.bikeNameEditText);

        fetchAvailableBikesAndHelmets();

        bikeAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedBikeName = (String) parent.getItemAtPosition(position);
            oldNfcContent = bikeIdMap.get(selectedBikeName);
            newNfcContent = bikeIdMap.get(selectedBikeName);
            bikeNameText.setText(selectedBikeName);
        });

        // Initialize NFC Adapter
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            messageHelper.showError("NFC is not available on this device.");
            finish();
            return;
        }

        // Handle NFC intents
        handleIntent(getIntent());

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (oldNfcContent.isEmpty() && newNfcContent.isEmpty()) {
                messageHelper.showError("Please scans a NFC tag or chose old one");
                return;
            }
            String bikeName = bikeNameText.getText().toString().trim();

            // Check if bikeName matches the required format
            if (!bikeName.matches("^[0-9]{5}/[A-Za-z\\s]+$")) {
                messageHelper.showError("Please enter a valid bike name (e.g., '12345/Bike Name')!");
                return;
            }

            // Show a confirmation dialog
            new androidx.appcompat.app.AlertDialog.Builder(EditBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to edit this bike?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(oldNfcContent, newNfcContent, bikeName, "oldBikeId", "newBikeId", "bikeName", "/api/editParameturBike"))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });

        submitHelmetButton.setOnClickListener(v -> {
            if (oldNfcContent.isEmpty() && newNfcContent.isEmpty()) {
                messageHelper.showError("Please scans a NFC tag or chose old one");
                return;
            }
            String helmetName = bikeNameText.getText().toString().trim();

            // Check if bikeName matches the required format
            if (!helmetName.matches("^[0-9]+/[A-Za-z\\s]+$")) {
                messageHelper.showError("Please enter a valid helmet name (e.g., '123/Helmet Name')!");
                return;
            }

            // Show a confirmation dialog
            new androidx.appcompat.app.AlertDialog.Builder(EditBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to edit this helmet?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(oldNfcContent, newNfcContent, helmetName, "oldHelmetId", "newHelmetId", "helmetName", "/api/editParameturHelmet"))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    private void fetchAvailableBikesAndHelmets() {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request bikeRequest = new Request.Builder()
                .url(baseUrl + "/api/bikes?campId=" + campId)
                .build();

        Request helmetRequest = new Request.Builder()
                .url(baseUrl + "/api/helmets?campId=" + campId)
                .build();

        AtomicInteger pendingRequests = new AtomicInteger(2); // Track pending requests
        JSONArray combinedArray = new JSONArray(); // Store combined results

        Callback commonCallback = new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error to fetch bike and helmet. Please connect to the support!");
                if (pendingRequests.decrementAndGet() == 0) {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {

                try {
                    final String responseData = Objects.requireNonNull(response.body()).string();

                    if (!response.isSuccessful()) {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        messageHelper.showError(errorMessage);
                        return;
                    }

                    JSONArray dataArray = new JSONArray(responseData);
                    synchronized (combinedArray) { // Ensure thread safety
                        for (int i = 0; i < dataArray.length(); i++) {
                            combinedArray.put(dataArray.getJSONObject(i));
                        }
                    }

                    if (pendingRequests.decrementAndGet() == 0)
                        runOnUiThread(() -> populateBikeAutoComplete(combinedArray));

                } catch (Exception e) {
                    messageHelper.showError("Error to fetch bike and helmet. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        };

        currentCall = client.newCall(bikeRequest);
        currentCall.enqueue(commonCallback);

        currentCall = client.newCall(helmetRequest);
        currentCall.enqueue(commonCallback);
    }

    private void populateBikeAutoComplete(JSONArray bikes) {

        ownerList.clear();
        bikeIdMap.clear();

        try {
            for (int i = 0; i < bikes.length(); i++) {
                JSONObject bike = bikes.getJSONObject(i);
                String bikeId = bike.getString("id");
                String bikeName = bike.getString("name");

                ownerList.add(bikeName);
                bikeIdMap.put(bikeName, bikeId);
            }

            ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, ownerList);
            bikeAutoCompleteTextView.setAdapter(adapter);

        } catch (Exception e) {
            messageHelper.showError("Failed to parse bike/helmet list. Please connect to the support!");
        }
    }

    private void sendDataToServer(String oldNfcContent, String newNfcContent, String name, String oldIdEndPoint, String newIdEndPoint, String nameEndPoint, String urlEndPoint) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performSendData(oldNfcContent, newNfcContent, name, oldIdEndPoint, newIdEndPoint, nameEndPoint, urlEndPoint);
    }

    private void performSendData(String oldNfcContent, String newNfcContent, String name, String oldIdEndPoint, String newIdEndPoint, String nameEndPoint, String urlEndPoint) {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(EditBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put(oldIdEndPoint, oldNfcContent);
            jsonData.put(newIdEndPoint, newNfcContent);
            jsonData.put(nameEndPoint, name);
            jsonData.put("username", username);
            jsonData.put("campId", campId);

        } catch (JSONException e) {
            messageHelper.showError("There is a problem with send bike data to the server. Please contact to the support!");
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + urlEndPoint)
                .patch(body)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("There is a problem with send bike data to the server. Please contact to the support!");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    String responseData = response.body().string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        messageHelper.showError(errorMessage);
                        return;
                    }

                    String message = jsonResponse.getString("message");
                    runOnUiThread(() -> {
                        Toast.makeText(EditBike.this, message, Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(EditBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });

                } catch (JSONException e) {
                    messageHelper.showError("There is a problem with send bike data to the server. Please contact to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
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

    @SuppressLint("SetTextI18n")
    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    private void handleIntent(Intent intent) {
        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag.class);
        if (tag != null) {
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