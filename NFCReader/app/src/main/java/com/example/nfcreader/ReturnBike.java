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

import android.widget.Button;
import android.widget.DatePicker;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import java.io.IOException;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.Objects;

import org.json.JSONException;
import org.json.JSONObject;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class ReturnBike extends AppCompatActivity {

    private String username;
    private NfcAdapter nfcAdapter;
    private TextView nfcTextView;
    private TextView nfcHelmetTextView;
    private DatePicker datePicker;
    private TimePicker timePicker;
    private String nfcContent = "";
    private OkHttpClient client;
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
        setContentView(R.layout.activity_return_bike);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        username = GlobalVariable.getUsername(this);

        nfcTextView = findViewById(R.id.nfcTextView);
        nfcHelmetTextView = findViewById(R.id.nfcHelmetTextView);
        datePicker = findViewById(R.id.datePicker);
        timePicker = findViewById(R.id.timePicker);
        Button submitButton = findViewById(R.id.submitButton);
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
            if (nfcContent.isEmpty()) {
                messageHelper.showError("No NFC content detected!");
                return;
            }

            // Get selected date and time
            int day = datePicker.getDayOfMonth();
            int month = datePicker.getMonth() + 1;
            int year = datePicker.getYear();
            int hour = timePicker.getHour();
            int minute = timePicker.getMinute();

            String date = year + "-" + (month < 10 ? "0" + month : month) + "-" + (day < 10 ? "0" + day : day);
            String time = (hour < 10 ? "0" + hour : hour) + ":" + (minute < 10 ? "0" + minute : minute);

            if (isPastDateTime(date, time)) {
                messageHelper.showError("The selected date is already passed or is invalid with rented date!");
                return;
            }

            new androidx.appcompat.app.AlertDialog.Builder(ReturnBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to return this bike?")
                    .setPositiveButton("Yes", (dialog, which) ->
                            sendDataToServer(nfcContent, date, time))
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });
    }

    private boolean isPastDateTime(String date, String time) {

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault());

        try {
            Date parsedDate = sdf.parse(date + " " + time);

            // Get the current date and time
            Calendar calendar = Calendar.getInstance();
            calendar.setTime(new Date());

            // Subtract 1 second from the current time
            calendar.add(Calendar.MINUTE, -1);

            Date currentDate = calendar.getTime();

            return parsedDate != null && parsedDate.before(currentDate);

        } catch (ParseException e) {
            return false;
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

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        Dialog loadingDialog = new Dialog(ReturnBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(Objects.requireNonNull(loadingDialog.getWindow())).setBackgroundDrawableResource(android.R.color.transparent);
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

                    final String bikeName = jsonResponse.getString("namebike");
                    final String helmetCode = jsonResponse.getString("getBikeHelmet");

                    if (!bikeName.isEmpty() && !helmetCode.isEmpty()) {
                        runOnUiThread(() -> nfcTextView.setText("Bike code: " + bikeName));
                        runOnUiThread(() -> nfcHelmetTextView.setText("Helmet code: " + helmetCode));

                    } else if (!bikeName.isEmpty()) {
                        runOnUiThread(() -> nfcTextView.setText("Bike code: " + bikeName));
                        runOnUiThread(() -> nfcHelmetTextView.setText("Helmet code: None"));

                    } else {
                        runOnUiThread(() -> nfcTextView.setText("Bike code: None"));
                        runOnUiThread(() -> nfcHelmetTextView.setText("Helmet code: None"));
                    }

                } catch (JSONException e) {
                    messageHelper.showError("Failed to read bike data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void sendDataToServer(String nfcData, String date, String time) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performSendData(nfcData, date, time);
    }

    private void performSendData(String nfcData, String date, String time) {

        Dialog loadingDialog = new Dialog(ReturnBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(Objects.requireNonNull(loadingDialog.getWindow())).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        JSONObject jsonData = new JSONObject();

        try {
            jsonData.put("nfcData", nfcData);
            jsonData.put("date", date);
            jsonData.put("time", time);
            jsonData.put("username", username);

        } catch (JSONException e) {
            messageHelper.showError("Error when send your data to the server. Please connect to the support!");
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), MediaType.get("application/json; charset=utf-8"));
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/nfcReturn")
                .post(body)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                messageHelper.showError("Error when send your data to the server. Please connect to the support!");
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {

                try {

                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);
                    String message = jsonResponse.optString("message", "Server error occurred.");

                    if (!response.isSuccessful()) {
                        messageHelper.showError(message);
                        return;
                    }

                    runOnUiThread(() -> {
                        Toast.makeText(ReturnBike.this, message, Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(ReturnBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });

                } catch (Exception e) {
                    messageHelper.showError("Error when send your data to the server. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }
}