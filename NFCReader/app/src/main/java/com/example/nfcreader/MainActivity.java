package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import android.os.Parcelable;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity {

    private OkHttpClient client; // Reuse a single OkHttpClient instance
    private boolean isValidCode;
    private ImageButton settingsButton;
    private ExecutorService executorService = Executors.newFixedThreadPool(3); // Adjust pool size as needed

    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        client = new OkHttpClient();
        isValidCode = GlobalVariable.getVariable(this);

        if(!isValidCode) {
            showCodeEntryDialog();
            return;
        }

        String campId = GlobalVariable.getCamp(this);

        if(campId.isEmpty()) {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show();
            return;
        }

        findViewById(R.id.buttonPage1).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, RentedBike.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.buttonPage2).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, ReturnBike.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.buttonSearchBike).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, SearchBike.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.buttonSearchClient).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, SearchClient.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.buttonAddBike).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, AddBike.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.buttonRemoveBike).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, RemoveBike.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.buttonEditBike).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, EditBike.class);
                startActivity(intent);
            }
        });

        settingsButton = findViewById(R.id.buttonSettings);

        settingsButton.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            startActivity(intent);
        });
    }

    private void showCodeEntryDialog() {
        // Create an AlertDialog builder
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Product Code");

        // Create an EditText for user input
        final EditText input = new EditText(this);
        input.setHint("Enter product code");
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT);

        // Add the EditText to the dialog
        builder.setView(input);

        // Set the "OK" button
        builder.setPositiveButton("OK", null); // We'll override the click listener later

        // Set the "Cancel" button
        builder.setNegativeButton("Cancel", (dialog, which) -> {
            finish(); // Close the app
        });

        // Create and show the dialog
        AlertDialog dialog = builder.create();

        // Override "OK" button behavior
        dialog.setOnShowListener(d -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String code = input.getText().toString();
                if (!code.isEmpty()) {
                    checkDataToServer(code, input, dialog);
                    if(isValidCode)
                        dialog.dismiss(); // Close the dialog
                } else {
                    input.setError("Code cannot be empty");
                }
            });
        });

        // Handle dialog dismissal
        dialog.setOnDismissListener(dialogInterface -> {
            // If no code is entered, close the app
            if (!isValidCode) {
                finish(); // Close the app
            }
        });

        dialog.show();
    }

    private void checkDataToServer(String code, EditText input, AlertDialog dialog) {
        executorService.execute(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("code", code);

                RequestBody body = RequestBody.create(JSON, payload.toString());
                Request request = new Request.Builder()
                        .url("https://bunker.bg/checkCodeProduct")
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (response.isSuccessful()) {
                        String responseData = response.body().string();
                        JSONObject jsonResponse = new JSONObject(responseData);
                        boolean isValidGetCode = jsonResponse.optBoolean("success", false);
                        GlobalVariable.saveVariable(this, isValidGetCode);

                        runOnUiThread(() -> {
                            if (isValidGetCode) {
                                input.setError(null);
                                dialog.dismiss();
                            } else {
                                input.setError("Invalid product code");
                            }
                        });
                    } else {
                        handleError(response, input);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPCs to server: " + e.getMessage()));
            }
        });
    }

    private void handleError(Response response, EditText input) {
        try {
            String errorMessage = "Unknown error occurred";
            if (response.body() != null) {
                String responseBody = response.body().string(); // Read response body
                JSONObject errorJson = new JSONObject(responseBody);
                errorMessage = errorJson.optString("message", "Internal server error");
            }
            String finalErrorMessage = errorMessage;
            runOnUiThread(() -> input.setError(finalErrorMessage));
        } catch (Exception e) {
            e.printStackTrace();
            runOnUiThread(() -> input.setError("Failed to process error response: " + e.getMessage()));
        } finally {
            if (response.body() != null) {
                response.body().close(); // Ensure the response body is closed
            }
        }
    }

    private void showPopupWindow(String title, String message) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(title);
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Optionally, reset or perform other actions after closing the dialog
        });
        builder.show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly
    }
}