package com.example.myapplication;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Button;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import java.util.HashSet;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity {

    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private ThreadInventory threadInventory;
    private HashSet<String> uniqueEpcSet = new HashSet<>();
    private TableLayout tableLayout;
    private Button scanButton;
    private OkHttpClient client; // Reuse a single OkHttpClient instance

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        tableLayout = findViewById(R.id.tableLayout);
        scanButton = findViewById(R.id.btnSubmit);

        // Initialize OkHttpClient (single instance)
        client = new OkHttpClient();

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.init();
            Toast.makeText(MainActivity.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(MainActivity.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }

        // Button click listener for scanning RFID tags
        scanButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                new Thread(new Runnable() {  // Run server check in a background thread to avoid blocking the UI
                    @Override
                    public void run() {
                        final boolean serverActive = isServerActive();
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (serverActive) {
                                    if (isInventory) {
                                        stopInventoryThread();  // Stop scanning
                                    } else {
                                        startInventoryThread(); // Start scanning
                                    }
                                } else {
                                    // Show error message if server is inactive
                                    Toast.makeText(MainActivity.this, "Server is not active. Cannot start scan.", Toast.LENGTH_SHORT).show();
                                }
                            }
                        });
                    }
                }).start();
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 139 || keyCode == 280 || keyCode == 293) { // KeyCode may vary based on your Chainway device configuration
            if (isInventory) {
                stopInventoryThread();
            } else {
                new Thread(() -> {
                    final boolean serverActive = isServerActive();
                    runOnUiThread(() -> {
                        if (serverActive) {
                            startInventoryThread();
                        } else {
                            Toast.makeText(MainActivity.this, "Server is not active. Cannot start scan.", Toast.LENGTH_SHORT).show();
                        }
                    });
                }).start();
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // Method to check if the server is active
    private boolean isServerActive() {
        Request request = new Request.Builder()
                .url("https://bunker.bg")
                .get()
                .build();

        try {
            Response response = client.newCall(request).execute(); // Reuse the OkHttpClient instance
            return response.isSuccessful();
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    // Method to start inventory (scanning)
    private void startInventoryThread() {
        resetData(); // Clear data before starting a new scan

        // Start inventory tag reading
        if (rfidReader.startInventoryTag()) {
            isInventory = true;
            scanButton.setText("Stop"); // Change button text to "Stop"
            threadInventory = new ThreadInventory();
            threadInventory.start(); // Start the background thread for reading tags
        } else {
            Toast.makeText(MainActivity.this, "Failed to start scanning", Toast.LENGTH_SHORT).show();
        }
    }

    // Method to stop the background thread for reading tags
    private void stopInventoryThread() {
        if (isInventory) {
            isInventory = false; // Set flag to false to stop the loop in the thread
            scanButton.setText("Scan"); // Change button text back to "Scan"
            if (rfidReader != null) {
                rfidReader.stopInventory(); // Stop the RFID inventory
            }
            if (threadInventory != null) {
                try {
                    threadInventory.interrupt(); // Interrupt the thread to stop it
                    threadInventory = null; // Clean up thread reference
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            showPopupWindow(); // Show popup window with total found codes
        }
    }

    // Method to reset the table and EPC set before starting a new scan
    private void resetData() {
        uniqueEpcSet.clear(); // Clear unique EPC codes
        tableLayout.removeAllViews(); // Remove all rows, including the header
    }

    // Method to show popup window with total found EPC codes
    private void showPopupWindow() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Scan Summary");
        builder.setMessage("Total unique EPC codes found: " + uniqueEpcSet.size());
        builder.setPositiveButton("OK", null);
        builder.show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // Stop inventory and free resources when activity is destroyed
        stopInventoryThread();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }

    // Background thread for scanning RFID tags
    private class ThreadInventory extends Thread {
        @Override
        public void run() {
            while (isInventory) {
                UHFTAGInfo uhftagInfo = rfidReader.readTagFromBuffer();
                if (uhftagInfo == null) {
                    try {
                        Thread.sleep(20); // Wait for 20 milliseconds before reading the next tag
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        break; // Exit the loop if the thread is interrupted
                    }
                    continue;
                }

                String epc = uhftagInfo.getEPC();

                // If this EPC is unique, add it to the set and send to server
                if (uniqueEpcSet.add(epc)) { // Only add unique EPC codes
                    runOnUiThread(() -> addRowToTable(epc)); // Add unique EPC to the table

                    // Send EPC to the server
                    sendEpcToServer(epc); // Call the method to send EPC to server
                }
            }
        }
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendEpcToServer(String epc) {
        new Thread(() -> { // Run network operation in a separate thread
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                String jsonData = "{\"code\":\"" + epc + "\"}";
                RequestBody body = RequestBody.create(JSON, jsonData);

                Request request = new Request.Builder()
                        .url("https://bunker.bg/rfid")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute(); // Use the same OkHttpClient instance

                if (response.isSuccessful()) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Server response: " + responseData, Toast.LENGTH_SHORT).show();
                    });
                } else {
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Server error: " + response.code(), Toast.LENGTH_SHORT).show();
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    // Method to add a new row to the table with only the last five characters of the EPC code
    private void addRowToTable(String epc) {
        TableRow tableRow = new TableRow(this);
        TextView codeTextView = new TextView(this);

        codeTextView.setText(epc.substring(epc.length() - 5)); // Set only the last five characters
        tableRow.addView(codeTextView);
        tableLayout.addView(tableRow);
    }
}
