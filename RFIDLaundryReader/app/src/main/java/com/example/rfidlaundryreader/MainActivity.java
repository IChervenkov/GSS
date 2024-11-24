package com.example.rfidlaundryreader;


import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.PopupMenu;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONObject;

import java.io.InterruptedIOException;
import java.util.HashSet;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity {

    private RFIDWithUHFUART rfidReader;
    private boolean isErrorMessageDisplayed = false;

    private boolean isInventory = false;
    private String destination;
    private String prev_destination;
    private TextView title;
    private ThreadInventory threadInventory;
    private HashSet<String> uniqueEpcSet = new HashSet<>();
    private TableLayout tableLayout;
    private OkHttpClient client; // Reuse a single OkHttpClient instance

    @SuppressLint("WrongViewCast")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        title = findViewById(R.id.title);

        destination = GlobalVariable.getVariable(this);
        prev_destination = GlobalVariable.getPrevDestination(this);  // Retrieving the previous destination

        title.setText(destination);

        // Find the menu button
        ImageButton menuButton = findViewById(R.id.menuButton);

        // Set an OnClickListener to show the PopupMenu
        menuButton.setOnClickListener(view -> showPopupMenu(view));
        tableLayout = findViewById(R.id.tableLayout);

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
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 139 || keyCode == 280 || keyCode == 293) { // KeyCode may vary based on your Chainway device configuration
            if (isInventory) {
                stopInventoryThread();
            } else if(destination.equals("No set mode")) {
                showPopupWindow("Error", "First you need to select a destination in the upper right corner");
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
            threadInventory = new ThreadInventory();
            threadInventory.start(); // Start the background thread for reading tags
        } else {
            Toast.makeText(MainActivity.this, "Failed to start scanning", Toast.LENGTH_SHORT).show();
        }
    }

    // Method to stop the background thread for reading tags
    // Method to stop the background thread for reading tags
    private void stopInventoryThread() {
        if (isInventory) {
            isInventory = false; // Set flag to false to stop the loop in the thread
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

            // Only show the scan summary if no error message is currently being displayed
            if (!isErrorMessageDisplayed) {
                showPopupWindow("Scan Summary", "Total unique EPC codes found: " + uniqueEpcSet.size());
            }
        }
    }

    // Method to reset the table and EPC set before starting a new scan
    private void resetData() {
        uniqueEpcSet.clear(); // Clear unique EPC codes
        tableLayout.removeAllViews(); // Remove all rows, including the header
    }

    // Method to show popup window with total found EPC codes
    private void showPopupWindow(String title, String message) {
        if (title.equalsIgnoreCase("Error")) {
            isErrorMessageDisplayed = true; // Set the flag if it's an error message
        }
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(title);
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Reset the flag once the error dialog is closed
            if (title.equalsIgnoreCase("Error")) {
                isErrorMessageDisplayed = false;
            }
        });
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
                        if (Thread.interrupted()) {
                            return; // Exit the thread if it's interrupted
                        }
                    }
                    continue;
                }

                String epc = uhftagInfo.getEPC();

                if (checkBagCode(epc)) {
                    if (epc != null && !epc.isEmpty() && uniqueEpcSet.add(epc)) { // Only add unique EPC codes
                        boolean success = sendEpcToServer(epc); // Call the method to send EPC to the server
                        if (!success) {
                            // Stop scanning on error
                            runOnUiThread(() -> stopInventoryThread());
                            return; // Exit the thread
                        }
                    }
                }
            }
        }
    }

    private boolean checkBagCode(String epc) {
        try {
            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
            String jsonData = "{\"code\":\"" + epc + "\"}";
            RequestBody body = RequestBody.create(JSON, jsonData);

            Request request = new Request.Builder()
                    .url("https://bunker.bg/check-bag") // Use the new endpoint
                    .post(body)
                    .build();

            Response response = client.newCall(request).execute();

            if (response.isSuccessful()) {
                String responseData = response.body().string();
                JSONObject jsonResponse = new JSONObject(responseData);
                return jsonResponse.getBoolean("exists");
            } else {
                // Extract the error message from the server response
                String errorMessage = "Unknown error";
                try {
                    if (response.body() != null) {
                        String responseBody = response.body().string();
                        JSONObject errorJson = new JSONObject(responseBody);
                        errorMessage = errorJson.optString("message", "Internal server error");
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }

                String finalErrorMessage = errorMessage; // Pass the extracted message to UI thread
                runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
            }

        } catch (InterruptedIOException e) {
            // Log the error or handle it as needed
            e.printStackTrace();
            return false;

        } catch (Exception e) {
            e.printStackTrace();
            runOnUiThread(() -> showPopupWindow("Error", "Error checking bag code: " + e.getMessage()));
        }

        return false; // Default to false if there's an error
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private boolean sendEpcToServer(String epc) {
        final boolean[] success = {true}; // Use an array to modify the value inside the thread

        Thread thread = new Thread(() -> { // Run network operation in a separate thread
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                String jsonData = "{\"code\":\"" + epc + "\", \"destination\":\"" + destination + "\", \"prev_destination\":\"" + prev_destination + "\"}";
                RequestBody body = RequestBody.create(JSON, jsonData);

                Request request = new Request.Builder()
                        .url("https://bunker.bg/changeStatus")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();

                if (response.isSuccessful()) {
                    String responseData = response.body().string();
                    JSONObject jsonResponse = new JSONObject(responseData);
                    String code = jsonResponse.getString("code");
                    String soldierId = jsonResponse.getString("soldierId");

                    runOnUiThread(() -> addRowToTable(code, soldierId));
                } else {
                    String errorMessage = "Unknown error";
                    if (response.body() != null) {
                        String responseBody = response.body().string();
                        JSONObject errorJson = new JSONObject(responseBody);
                        errorMessage = errorJson.optString("message", "Internal server error");
                    }

                    String finalErrorMessage = errorMessage;
                    runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
                    success[0] = false; // Mark failure
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPC to server: " + e.getMessage()));
                success[0] = false; // Mark failure
            }
        });

        thread.start();

        try {
            thread.join(); // Wait for the thread to finish
        } catch (InterruptedException e) {
            e.printStackTrace();
            success[0] = false;
        }

        return success[0];
    }

    // Method to add a new row to the table with only the last five characters of the EPC code
    private void addRowToTable(String code, String id) {

        TableRow tableRow = new TableRow(this);

        TextView codeTextView = new TextView(this);
        codeTextView.setText(code);
        codeTextView.setLayoutParams(new TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1f));

        TextView idTextView = new TextView(this);
        idTextView.setText(id);
        idTextView.setLayoutParams(new TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1f));

        tableRow.addView(codeTextView);
        tableRow.addView(idTextView);
        tableLayout.addView(tableRow); // Add the row to the TableLayout
    }

    // Method to show the PopupMenu
    private void showPopupMenu(View view) {
        // Create a PopupMenu
        PopupMenu popupMenu = new PopupMenu(this, view);

        // Inflate the menu from XML resource
        popupMenu.getMenuInflater().inflate(R.menu.menu_main, popupMenu.getMenu());

        // Set a click listener for menu items
        popupMenu.setOnMenuItemClickListener(item -> {
            int itemId = item.getItemId();

            if (itemId == R.id.menu_drop_off) {
                updateMode("Drop off", "None");
                return true;
            } else if (itemId == R.id.menu_transportation_to_laundry) {
                updateMode("Transportation to laundry facility", "Drop off");
                return true;
            } else if (itemId == R.id.menu_laundry) {
                updateMode("Laundry facility", "Transportation to laundry facility");
                return true;
            } else if (itemId == R.id.menu_transportation_to_drop_off) {
                updateMode("Transportation to drop off", "Laundry facility");
                return true;
            } else if (itemId == R.id.menu_ready_to_pick_up) {
                updateMode("Ready to pick up", "Transportation to drop off");
                return true;
            }
            return false;
        });

        // Show the PopupMenu
        popupMenu.show();
    }

    private void updateMode(String destination, String prevDestination) {
        Toast.makeText(this, "Change mode to " + destination, Toast.LENGTH_SHORT).show();
        this.destination = destination;
        if (prevDestination != null) {
            this.prev_destination = prevDestination;
            GlobalVariable.savePrevDestination(this, prevDestination);
        }
        title.setText(destination);
        GlobalVariable.saveVariable(this, destination);
    }

}