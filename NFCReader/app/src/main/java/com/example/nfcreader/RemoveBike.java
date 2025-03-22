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
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class RemoveBike extends AppCompatActivity {

    private NfcAdapter nfcAdapter;
    private TextView nfcTextView;
    private Button submitButton;
    private Button submitHelmetButton;
    private String nfcContent = "";
    private OkHttpClient client = new OkHttpClient();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_remove_bike);

        nfcTextView = findViewById(R.id.nfcTextView);
        submitButton = findViewById(R.id.removeButton);
        submitHelmetButton = findViewById(R.id.removeHelmetButton);
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
                // Show a confirmation dialog
                new AlertDialog.Builder(RemoveBike.this)
                        .setTitle("Attention")
                        .setMessage("Are you sure you want to remove this bike?")
                        .setPositiveButton("Yes", (dialog, which) -> {
                            sendDataToServer(nfcContent);  // Proceed with submission
                        })
                        .setNegativeButton("No", (dialog, which) -> {
                            // Do nothing, just dismiss the dialog
                            dialog.dismiss();
                        })
                        .show();
            } else {
                Toast.makeText(this, "Bike code not detected!", Toast.LENGTH_SHORT).show();
            }
        });

        submitHelmetButton.setOnClickListener(v -> {
            if (!nfcContent.isEmpty()) {
                // Show a confirmation dialog
                new AlertDialog.Builder(RemoveBike.this)
                        .setTitle("Attention")
                        .setMessage("Are you sure you want to remove this helmet?")
                        .setPositiveButton("Yes", (dialog, which) -> {
                            sendHelmetDataToServer(nfcContent);  // Proceed with submission
                        })
                        .setNegativeButton("No", (dialog, which) -> {
                            // Do nothing, just dismiss the dialog
                            dialog.dismiss();
                        })
                        .show();
            } else {
                Toast.makeText(this, "Helmet code not detected!", Toast.LENGTH_SHORT).show();
            }
        });

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

    private void readBikeDataFromServer(String nfcData) {

        // Prepare the JSON request body
        JSONObject json = new JSONObject();
        try {
            json.put("nfcData", nfcData);
            json.put("isValidCode", GlobalVariable.getVariable(this));

        } catch (JSONException e) {
            e.printStackTrace();
        }

        RequestBody body = RequestBody.create(json.toString(), MediaType.get("application/json; charset=utf-8"));

        // Define the request
        Request request = new Request.Builder()
                .url("https://bunker.bg/readBikeNfc")  // Replace with your server URL
                .post(body)
                .build();

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RemoveBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        // Make the network call asynchronously
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    loadingDialog.dismiss();
                    Toast.makeText(RemoveBike.this, "Failed to read bike data", Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                runOnUiThread(loadingDialog::dismiss); // Dismiss the dialog

                if (response.isSuccessful()) {
                    String responseData = response.body().string();
                    try {
                        // Parse the response if it's JSON
                        JSONObject jsonResponse = new JSONObject(responseData);
                        final String bikeName = jsonResponse.getString("namebike");
                        final String helmetName = jsonResponse.getString("code");

                        if(!bikeName.isEmpty())
                            runOnUiThread(() -> nfcTextView.setText("Item code: " + bikeName));
                        else if(!helmetName.isEmpty())
                            runOnUiThread(() -> nfcTextView.setText("Item code: " + helmetName));
                        else
                            runOnUiThread(() -> nfcTextView.setText("Item code: None"));

                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                } else {
                    runOnUiThread(() -> {
                        Toast.makeText(RemoveBike.this, "Item not found", Toast.LENGTH_SHORT).show();
                    });
                }
            }
        });
    }

    private void sendDataToServer(String nfcContent) {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RemoveBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("bikeRemoveId", nfcContent);
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));

            RequestBody body = RequestBody.create(JSON, jsonData.toString());
            Request request = new Request.Builder()
                    .url("https://bunker.bg/bicycles/removeBike")
                    .post(body)
                    .build();

            // Use enqueue for the asynchronous call
            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    e.printStackTrace();
                    runOnUiThread(() -> {
                        loadingDialog.dismiss();
                        Toast.makeText(RemoveBike.this, "Failed to remove bike", Toast.LENGTH_SHORT).show();
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    runOnUiThread(loadingDialog::dismiss); // Dismiss the dialog

                    if (response.isSuccessful()) {
                        String responseData = response.body().string();
                        try {
                            // Parse the response if it's JSON
                            JSONObject jsonResponse = new JSONObject(responseData);
                            String message = jsonResponse.optString("message", "Bike removed successfully.");

                            runOnUiThread(() -> {
                                Toast.makeText(RemoveBike.this, message, Toast.LENGTH_SHORT).show();
                                Intent intent = new Intent(RemoveBike.this, MainActivity.class);
                                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                finish();
                            });
                        } catch (JSONException e) {
                            e.printStackTrace();
                            runOnUiThread(() -> {
                                Toast.makeText(RemoveBike.this, "Error parsing response", Toast.LENGTH_SHORT).show();
                            });
                        }
                    } else {
                        runOnUiThread(() -> {
                            Toast.makeText(RemoveBike.this, "Error: " + response.message(), Toast.LENGTH_SHORT).show();
                        });
                    }
                }
            });

        } catch (JSONException e) {
            e.printStackTrace();
            runOnUiThread(() -> {
                Toast.makeText(RemoveBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            });
            loadingDialog.dismiss();
        }
    }

    private void sendHelmetDataToServer(String nfcContent) {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RemoveBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("code", nfcContent);
            jsonData.put("isValidCode", GlobalVariable.getVariable(this));

            RequestBody body = RequestBody.create(JSON, jsonData.toString());
            Request request = new Request.Builder()
                    .url("https://bunker.bg/bicycles/removeHelmet")
                    .post(body)
                    .build();

            // Use enqueue for the asynchronous call
            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    e.printStackTrace();
                    runOnUiThread(() -> {
                        loadingDialog.dismiss();
                        Toast.makeText(RemoveBike.this, "Failed to remove helmet", Toast.LENGTH_SHORT).show();
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    runOnUiThread(loadingDialog::dismiss); // Dismiss the dialog

                    if (response.isSuccessful()) {
                        String responseData = response.body().string();
                        try {
                            // Parse the response if it's JSON
                            JSONObject jsonResponse = new JSONObject(responseData);
                            String message = jsonResponse.optString("message", "Helmet removed successfully.");

                            runOnUiThread(() -> {
                                Toast.makeText(RemoveBike.this, message, Toast.LENGTH_SHORT).show();
                                Intent intent = new Intent(RemoveBike.this, MainActivity.class);
                                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                finish();
                            });
                        } catch (JSONException e) {
                            e.printStackTrace();
                            runOnUiThread(() -> {
                                Toast.makeText(RemoveBike.this, "Error parsing response", Toast.LENGTH_SHORT).show();
                            });
                        }
                    } else {
                        runOnUiThread(() -> {
                            Toast.makeText(RemoveBike.this, "Error: " + response.message(), Toast.LENGTH_SHORT).show();
                        });
                    }
                }
            });

        } catch (JSONException e) {
            e.printStackTrace();
            runOnUiThread(() -> {
                Toast.makeText(RemoveBike.this, "Unexpected error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            });
            loadingDialog.dismiss();
        }
    }
}