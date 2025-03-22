package com.example.nfcreader;

import android.app.Dialog;
import android.app.PendingIntent;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Bundle;
import android.os.Parcelable;
import android.util.Log;
import android.widget.Button;
import android.widget.DatePicker;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

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

    private NfcAdapter nfcAdapter;
    private TextView nfcTextView;
    private TextView nfcHelmetTextView;
    private DatePicker datePicker;
    private TimePicker timePicker;
    private Button submitButton;
    private String nfcContent = "";

    private OkHttpClient client = new OkHttpClient();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_return_bike);

        nfcTextView = findViewById(R.id.nfcTextView);
        nfcHelmetTextView = findViewById(R.id.nfcHelmetTextView);
        datePicker = findViewById(R.id.datePicker);
        timePicker = findViewById(R.id.timePicker);
        submitButton = findViewById(R.id.submitButton);
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
                    runOnUiThread(() -> {
                        Toast.makeText(ReturnBike.this, "The selected date is already passed or is invalid with rented date!", Toast.LENGTH_SHORT).show();
                    });
                } else {
                    // Send data to the server
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
            e.printStackTrace();
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
        // Reuse existing OkHttpClient
        JSONObject json = new JSONObject();
        try {
            json.put("nfcData", nfcData);
            json.put("isValidCode", GlobalVariable.getVariable(this));
        } catch (JSONException e) {
            e.printStackTrace();
        }

        RequestBody body = RequestBody.create(json.toString(), MediaType.get("application/json; charset=utf-8"));
        Request request = new Request.Builder()
                .url("https://bunker.bg/readBikeNfc")
                .post(body)
                .build();

        Dialog loadingDialog = new Dialog(ReturnBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    loadingDialog.dismiss(); // Ensure the dialog is dismissed
                    Toast.makeText(ReturnBike.this, "Failed to read bike data", Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                loadingDialog.dismiss(); // Dismiss the dialog

                if (response.isSuccessful()) {
                    String responseData = response.body().string();
                    try {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        final String bikeName = jsonResponse.getString("namebike");
                        final String helmetCode = jsonResponse.getString("getBikeHelmet");

                        if(!bikeName.isEmpty() && !helmetCode.isEmpty()) {
                            runOnUiThread(() -> nfcTextView.setText("Bike code: " + bikeName));
                            runOnUiThread(() -> nfcHelmetTextView.setText("Helmet code: " + helmetCode));
                        } else if (!bikeName.isEmpty() && helmetCode.isEmpty()) {
                            runOnUiThread(() -> nfcTextView.setText("Bike code: " + bikeName));
                            runOnUiThread(() -> nfcHelmetTextView.setText("Helmet code: None"));
                        } else {
                            runOnUiThread(() -> nfcTextView.setText("Bike code: None"));
                            runOnUiThread(() -> nfcHelmetTextView.setText("Helmet code: None"));
                        }

                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                } else {
                    runOnUiThread(() -> {
                        Toast.makeText(ReturnBike.this, "Bike not found", Toast.LENGTH_SHORT).show();
                    });
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
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));
        } catch (JSONException e) {
            e.printStackTrace();
            runOnUiThread(() ->
                    Toast.makeText(ReturnBike.this, "JSON Error: " + e.getMessage(), Toast.LENGTH_SHORT).show()
            );
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), MediaType.get("application/json; charset=utf-8"));
        Request request = new Request.Builder()
                .url("https://bunker.bg/nfcReturn")
                .post(body)
                .build();

        // Show loading dialog
        Dialog loadingDialog = new Dialog(ReturnBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(ReturnBike.this, "Network Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                loadingDialog.dismiss();
                if (response.isSuccessful()) {
                    String responseData = response.body().string();
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