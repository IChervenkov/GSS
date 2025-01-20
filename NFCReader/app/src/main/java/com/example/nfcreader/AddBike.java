package com.example.nfcreader;

import android.app.Dialog;
import android.app.PendingIntent;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONObject;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AddBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private String nfcContent = "";
    private TextView nfcTextView;
    private Button submitButton;
    private EditText bikeNameText;
    private OkHttpClient client = new OkHttpClient();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_bike);

        nfcTextView = findViewById(R.id.nfcTextView);
        submitButton = findViewById(R.id.addButton);
        bikeNameText = findViewById(R.id.bikeNameEditText);

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
            if (!nfcContent.isEmpty()) {
                String bikeName = bikeNameText.getText().toString().trim();

                if (bikeName.isEmpty()) {
                    Toast.makeText(this, "Please enter a bike name!", Toast.LENGTH_SHORT).show();
                    return;
                }

                // Check if bikeName matches the required format
                if (!bikeName.matches("^[0-9]{5}/[A-Za-z\\s]+$")) {
                    Toast.makeText(this, "Please enter a valid bike name (e.g., '12345/Bike Name')!", Toast.LENGTH_SHORT).show();
                    return;
                }

                sendDataToServer(nfcContent, bikeName);

            } else {
                Toast.makeText(this, "No NFC content detected!", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void sendDataToServer(String nfcContent, String bikeName) {

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(AddBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        new Thread(() -> {
            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
            JSONObject jsonData = new JSONObject();
            try {
                jsonData.put("bikeAddId", nfcContent);
                jsonData.put("bikeName", bikeName);

                RequestBody body = RequestBody.create(JSON, jsonData.toString());
                Request request = new Request.Builder()
                        .url("https://bunker.bg/bicycles/addBike")
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (response.body() != null) {
                        String responseData = response.body().string();

                        if (response.isSuccessful()) {
                            JSONObject jsonResponse = new JSONObject(responseData);
                            String message = jsonResponse.optString("message", "Bike added successfully.");

                            runOnUiThread(() -> {
                                Toast.makeText(AddBike.this, message, Toast.LENGTH_SHORT).show();
                                Intent intent = new Intent(AddBike.this, MainActivity.class);
                                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                finish();
                            });
                        } else {
                            JSONObject jsonResponse = new JSONObject(responseData);
                            String error = jsonResponse.optString("error", "Server error occurred.");

                            runOnUiThread(() -> {
                                Toast.makeText(AddBike.this, "Error: " + error, Toast.LENGTH_SHORT).show();
                            });
                        }
                    } else {
                        runOnUiThread(() -> {
                            Toast.makeText(AddBike.this, "Response body is null", Toast.LENGTH_SHORT).show();
                        });
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    Toast.makeText(AddBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        }).start();
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

            nfcTextView.setText("NFC code: " + nfcId);
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