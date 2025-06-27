package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.app.PendingIntent;

import android.content.Intent;
import android.content.IntentFilter;

import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;

import android.util.Log;
import android.widget.Button;
import android.widget.DatePicker;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;

import java.io.IOException;

import java.net.CookieManager;
import java.net.CookiePolicy;

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
import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class ReturnBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private TextView nfcTextView;
    private TextView nfcHelmetTextView;
    private DatePicker datePicker;
    private TimePicker timePicker;
    private String nfcContent = "";
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;

    private void fetchCsrfToken() {

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/csrf-token")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> Toast.makeText(ReturnBike.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                if (response.isSuccessful() && response.body() != null) {
                    try {
                        String responseBody = response.body().string();
                        JSONObject jsonObject = new JSONObject(responseBody);
                        csrfToken = jsonObject.getString("csrfToken");
                    } catch (JSONException e) {
                        runOnUiThread(() -> Toast.makeText(ReturnBike.this, "Error parsing token", Toast.LENGTH_SHORT).show());
                    }
                } else {
                    runOnUiThread(() -> Toast.makeText(ReturnBike.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_return_bike);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        nfcTextView = findViewById(R.id.nfcTextView);
        nfcHelmetTextView = findViewById(R.id.nfcHelmetTextView);
        datePicker = findViewById(R.id.datePicker);
        timePicker = findViewById(R.id.timePicker);
        Button submitButton = findViewById(R.id.submitButton);
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            Toast.makeText(this, "NFC is not available on this device.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        // Handle NFC intents
        handleIntent(getIntent());

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {
            if (!nfcContent.isEmpty()) {
                // Get selected date and time
                int day = datePicker.getDayOfMonth();
                int month = datePicker.getMonth() + 1;
                int year = datePicker.getYear();
                int hour = timePicker.getHour();
                int minute = timePicker.getMinute();

                String date = year + "-" + (month < 10 ? "0" + month : month) + "-" + (day < 10 ? "0" + day : day);
                String time = (hour < 10 ? "0" + hour : hour) + ":" + (minute < 10 ? "0" + minute : minute);

                if (isPastDateTime(date, time)) {
                    runOnUiThread(() -> Toast.makeText(ReturnBike.this, "The selected date is already passed or is invalid with rented date!", Toast.LENGTH_SHORT).show());
                } else {
                    fetchCsrfToken();
                    sendDataToServer(nfcContent, date, time);
                }

            } else {
                Toast.makeText(this, "No NFC content detected!", Toast.LENGTH_SHORT).show();
            }
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
            Log.e("ReturnBike", "Error: " + e.getMessage());
            return false;
        }
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

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/readBikeNfc?nfcData=" + nfcData + "&isValidCode=" + GlobalVariable.getVariable(this))
                .build();

        Dialog loadingDialog = new Dialog(ReturnBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(Objects.requireNonNull(loadingDialog.getWindow())).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Log.e("ReturnBike", "Error: " + e.getMessage());
                runOnUiThread(() -> {
                    loadingDialog.dismiss(); // Ensure the dialog is dismissed
                    Toast.makeText(ReturnBike.this, "Failed to read bike data", Toast.LENGTH_SHORT).show();
                });
            }

            @SuppressLint("SetTextI18n")
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                loadingDialog.dismiss(); // Dismiss the dialog

                if (response.isSuccessful()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    try {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        final String bikeName = jsonResponse.getString("namebike");
                        final String helmetCode = jsonResponse.getString("getBikeHelmet");

                        if(!bikeName.isEmpty() && !helmetCode.isEmpty()) {
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
                        Log.e("ReturnBike", "Error: " + e.getMessage());
                    }
                } else {
                    runOnUiThread(() -> Toast.makeText(ReturnBike.this, "Bike not found", Toast.LENGTH_SHORT).show());
                }
            }
        });
    }

    private void sendDataToServer(String nfcData, String date, String time) {
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("nfcData", nfcData);
            jsonData.put("date", date);
            jsonData.put("time", time);
            jsonData.put("username", GlobalVariable.getUsername(this));
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));
        } catch (JSONException e) {
            Log.e("ReturnBike", "Error: " + e.getMessage());
            runOnUiThread(() ->
                    Toast.makeText(ReturnBike.this, "JSON Error: " + e.getMessage(), Toast.LENGTH_SHORT).show()
            );
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), MediaType.get("application/json; charset=utf-8"));
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/nfcReturn")
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        // Show loading dialog
        Dialog loadingDialog = new Dialog(ReturnBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Log.e("ReturnBike", "Error: " + e.getMessage());
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(ReturnBike.this, "Network Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                loadingDialog.dismiss();
                if (response.isSuccessful()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    runOnUiThread(() -> {
                        Toast.makeText(ReturnBike.this, "Success: " + responseData, Toast.LENGTH_SHORT).show();

                        // Navigate back to main activity
                        Intent intent = new Intent(ReturnBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });
                } else {
                    runOnUiThread(() ->
                            Toast.makeText(ReturnBike.this, "Server Error: " + response.code(), Toast.LENGTH_SHORT).show()
                    );
                }
            }
        });
    }
}