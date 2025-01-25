package com.example.rfidlaundryreader;


import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.ImageButton;
import android.widget.PopupMenu;
import android.widget.Spinner;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.InterruptedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity {

    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private String destination;
    private String prev_destination;
    private int perm_count = 1;
    private TextView title;
    private Boolean isSuccesful;
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

        isSuccesful = false;

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

            // Set the output power to minimum
            rfidReader.setPower(5); // Replace '5' with the actual minimum value defined in the API

            Toast.makeText(MainActivity.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(MainActivity.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 293) { // KeyCode may vary based on your Chainway device configuration
            if (isInventory) {
                isSuccesful = true;
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

        } else if (keyCode == 139) {
            runOnUiThread(() -> showPopupWindowService("Linen Exchange additional service"));
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
        title.setText(destination.equals("None") ? "Taking from soldier" : destination);
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

            if(isSuccesful) {
//                if(checkCountScanningCodes(uniqueEpcSet.size())) {
                    // Send all EPCs to the server
                    boolean success = sendAllEpcsToServer(uniqueEpcSet);
                    if (success) {
                        // Show summary only if sending to the server was successful
                        showPopupWindow("Scan Summary", "Total bags codes found: " + uniqueEpcSet.size());
                    }
//                }
                isSuccesful = false;
            }
        }
    }

    private boolean checkCountScanningCodes(Integer countScannedCode) {
        final boolean[] success = {true};

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        Thread thread = new Thread(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");

                JSONObject payload = new JSONObject();
                payload.put("countScaneCode", countScannedCode); // Send the EPC array to the server
                payload.put("prev_destination", prev_destination);

                RequestBody body = RequestBody.create(JSON, payload.toString());

                Request request = new Request.Builder()
                        .url("https://bunker.bg/checkCountScanningCodes")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();

                if (!response.isSuccessful()) {
                    String errorMessage = "Unknown error";
                    if (response.body() != null) {
                        String responseBody = response.body().string();
                        JSONObject errorJson = new JSONObject(responseBody);
                        errorMessage = errorJson.optString("message", "Internal server error");
                    }

                    String finalErrorMessage = errorMessage;
                    runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
                    success[0] = false;
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPCs to server: " + e.getMessage()));
                success[0] = false;
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });

        thread.start();

        try {
            thread.join();
        } catch (InterruptedException e) {
            e.printStackTrace();
            success[0] = false;
        }

        return success[0];
    }

    // Method to reset the table and EPC set before starting a new scan
    private void resetData() {
        uniqueEpcSet.clear(); // Clear unique EPC codes
        tableLayout.removeAllViews(); // Remove all rows, including the header
    }

    // Method to show popup window with total found EPC codes
    private void showPopupWindow(String title, String message) {
//        if (title.equalsIgnoreCase("Error")) {
//            stopInventoryThread();
//        }
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(title);
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Reset the flag once the error dialog is clos
        });
        builder.show();
    }

    private void fetchBag(Spinner bagSpinner) {
        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        new Thread(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("isValidCode", true);

                RequestBody body = RequestBody.create(JSON, payload.toString());
                Request request = new Request.Builder()
                        .url("https://bunker.bg/bags")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            JSONObject responseJson = new JSONObject(responseData);
                            JSONArray bags = responseJson.getJSONArray("allBags");
                            populateBagSpinner(bags, bagSpinner);

                        } catch (JSONException e) {
                            Toast.makeText(MainActivity.this, "JSON parsing error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error fetching data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        }).start();
    }

    private void showPopupWindowService(String title) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);

        // Inflate the custom view
        View customView = getLayoutInflater().inflate(R.layout.popup_spinner_layout, null);
        Spinner bagSpinner = customView.findViewById(R.id.bagSpinner);

        builder.setTitle(title)
                .setView(customView)
                .setPositiveButton("OK", (dialog, which) -> {
                    String selectedBagCode = (String) bagSpinner.getSelectedItem();
                    Map<String, String> bagIdMap = (Map<String, String>) bagSpinner.getTag();

                    destination = "Linen Exchange service";
                    uniqueEpcSet.clear();

                    if (selectedBagCode != null && bagIdMap != null) {
                        String selectedBagId = bagIdMap.get(selectedBagCode);
                        uniqueEpcSet.add(selectedBagId);
                        sendAllEpcsToServer(uniqueEpcSet);
                        dialog.dismiss();
                        showPopupWindow("Information", "Operation completed successfully");
                    }
                })
                .setNegativeButton("Cancel", (dialog, which) -> dialog.dismiss());

        // Show the dialog before fetching data
        AlertDialog dialog = builder.create();
        dialog.show();

        // Fetch bags and populate the spinner
        fetchBag(bagSpinner);
    }

    private void populateBagSpinner(JSONArray bags, Spinner bagSpinner) throws JSONException {
        List<String> bagCodes = new ArrayList<>();
        Map<String, String> bagIdMap = new HashMap<>(); // Maps code to id

        for (int i = 0; i < bags.length(); i++) {
            JSONObject bag = bags.getJSONObject(i);
            String bagCode = bag.getString("name");
            String bagId = bag.getString("id");
            String bagStatus = bag.getString("status");

            if (!bagStatus.equals("None")) {
                bagCodes.add(bagCode);
                bagIdMap.put(bagCode, bagId); // Store id associated with the code
            }
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, bagCodes);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        bagSpinner.setAdapter(adapter);

        // Store the bagIdMap somewhere accessible if you need the selected bag ID later
        bagSpinner.setTag(bagIdMap);
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
        private final Set<String> invalidEpcSet = Collections.synchronizedSet(new HashSet<>()); // To store invalid EPCs

        @Override
        public void run() {
            while (isInventory) {
                UHFTAGInfo uhftagInfo = rfidReader.readTagFromBuffer();
                if (uhftagInfo == null) {
                    try {
                        Thread.sleep(0); // Wait for 0 milliseconds before reading the next tag
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                        if (Thread.interrupted()) {
                            return; // Exit the thread if it's interrupted
                        }
                    }
                    continue;
                }

                String epc = uhftagInfo.getEPC();

                if (epc != null && !epc.isEmpty()) {
                    // Skip invalid EPCs that have already been marked
                    synchronized (invalidEpcSet) {
                        if (invalidEpcSet.contains(epc)) {
                            continue; // Skip rescanning invalid EPC
                        }
                    }

                    // Check if the EPC is already processed
                    synchronized (uniqueEpcSet) {
                        if (uniqueEpcSet.contains(epc)) {
                            continue; // Skip processing for already handled EPCs
                        }
                    }

                    // Proceed only if EPC passes local validation
                    if (checkBagCode(epc)) {
                        try {
                            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                            JSONObject jsonPayload = new JSONObject();
                            try {
                                jsonPayload.put("code", epc);
                                jsonPayload.put("prev_destination", prev_destination);
                                jsonPayload.put("destination", destination);
                                jsonPayload.put("permCount", perm_count);
                            } catch (JSONException e) {
                                e.printStackTrace();
                            }

                            String jsonData = jsonPayload.toString();
                            RequestBody body = RequestBody.create(JSON, jsonData);

                            Request request = new Request.Builder()
                                    .url("https://bunker.bg/checkScaningCode")
                                    .post(body)
                                    .build();

                            Response response = client.newCall(request).execute();

                            if (response.isSuccessful()) {
                                String responseData = response.body().string();
                                JSONObject jsonResponse = new JSONObject(responseData);
                                String code = jsonResponse.getString("code");
                                String soldierId = jsonResponse.getString("soldierId");

                                boolean isNewEpc;
                                synchronized (uniqueEpcSet) {
                                    // Only add to the set if validation is successful
                                    isNewEpc = uniqueEpcSet.add(epc); // Returns true only if the EPC is newly added
                                }

                                if (isNewEpc) {
                                    // Add row only for new EPCs
                                    runOnUiThread(() -> addRowToTable(code, soldierId));
                                }
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

                                // Mark the EPC as invalid and skip it in future scans
                                synchronized (invalidEpcSet) {
                                    invalidEpcSet.add(epc);
                                }

                                String finalErrorMessage = errorMessage; // Pass the extracted message to UI thread
                                runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
                            }

                        } catch (InterruptedIOException e) {
                            // Log the error or handle it as needed
                            e.printStackTrace();
                        } catch (Exception e) {
                            e.printStackTrace();
                            runOnUiThread(() -> showPopupWindow("Error", "Error checking bag code: " + e.getMessage()));

                            // Mark the EPC as invalid and skip it in future scans
                            synchronized (invalidEpcSet) {
                                invalidEpcSet.add(epc);
                            }
                        }
                    } else {
                        // Mark the EPC as invalid if it fails local validation
                        synchronized (invalidEpcSet) {
                            invalidEpcSet.add(epc);
                        }
                    }
                }
            }
        }
    }

    private boolean checkBagCode(String epc) {
        try {
            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
            JSONObject jsonPayload = new JSONObject();
            try {
                jsonPayload.put("code", epc);
            } catch (JSONException e) {
                e.printStackTrace();
            }
            String jsonData = jsonPayload.toString();

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
    private boolean sendAllEpcsToServer(HashSet<String> epcs) {
        final boolean[] success = {true};

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        Thread thread = new Thread(() -> {
            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");

                // Create a JSON array for the EPCs
                JSONArray epcArray = new JSONArray();
                for (String epc : epcs) {
                    epcArray.put(epc);
                }

                JSONObject payload = new JSONObject();
                payload.put("codes", epcArray); // Send the EPC array to the server
                payload.put("destination", destination);
                payload.put("prev_destination", prev_destination);

                String url;

                if("Linen Exchange service".equals(destination)) {
                    url = "https://bunker.bg/changeEndToEndStatus";
                } else {
                    url = "https://bunker.bg/changeStatusBulk";
                }

                RequestBody body = RequestBody.create(JSON, payload.toString());

                Request request = new Request.Builder()
                        .url(url)
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();

                if (response.isSuccessful()) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "All bags have been moved successfully.", Toast.LENGTH_SHORT).show());
                } else {
                    String errorMessage = "Unknown error";
                    if (response.body() != null) {
                        String responseBody = response.body().string();
                        JSONObject errorJson = new JSONObject(responseBody);
                        errorMessage = errorJson.optString("message", "Internal server error");
                    }

                    String finalErrorMessage = errorMessage;
                    runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
                    success[0] = false;
                }
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPCs to server: " + e.getMessage()));
                success[0] = false;
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });

        thread.start();

        try {
            thread.join();
        } catch (InterruptedException e) {
            e.printStackTrace();
            success[0] = false;
        }

        return success[0];
    }

    private int getRowCount() {
        return tableLayout.getChildCount();
    }

    @SuppressLint("SetTextI18n")
    private void updateTitleWithRowCount() {
        int rowCount = getRowCount();
        title.setText((destination.equals("None") ? "Taking from soldier" : destination) + "\n" + rowCount + " scanned bags");
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

        updateTitleWithRowCount();
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

            if (isInventory)
                stopInventoryThread();

            if (itemId == R.id.menu_drop_off) {
                updateMode("Drop off", "None");
                resetData();
                return true;

            } else if (itemId == R.id.menu_transportation_to_laundry) {
                updateMode("Transportation to laundry facility", "Drop off");
                resetData();
                return true;

            } else if (itemId == R.id.menu_laundry) {
                updateMode("Laundry facility", "Transportation to laundry facility");
                resetData();
                return true;

            } else if (itemId == R.id.menu_transportation_to_drop_off) {
                updateMode("Transportation to drop off", "Laundry facility");
                resetData();
                return true;

            } else if (itemId == R.id.menu_ready_to_pick_up) {
                updateMode("Ready to pick up", "Transportation to drop off");
                resetData();
                return true;

            } else if (itemId == R.id.menu_taking_from_soldier) {
                updateMode("None", "Ready to pick up");
                resetData();
                return true;

            } else if (itemId == R.id.linen_exchange_service) {
                updateMode("Linen Exchange service", "None");
                resetData();
                return true;

            }
            return false;
        });

        // Show the PopupMenu
        popupMenu.show();
    }

    private void updateMode(String destination, String prevDestination) {
        Toast.makeText(this, "Change mode to " + (destination.equals("None") ? "Taking from soldier" : destination), Toast.LENGTH_SHORT).show();
        this.destination = destination;
        if (prevDestination != null) {
            this.prev_destination = prevDestination;
            GlobalVariable.savePrevDestination(this, prevDestination);
        }
        title.setText(destination.equals("None") ? "Taking from soldier" : destination);

        GlobalVariable.saveVariable(this, destination);
    }

}