package com.example.rfidlaundryreader;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Dialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.util.Base64;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.Spinner;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;

import com.rscja.deviceapi.RFIDWithUHFUART;
import com.rscja.deviceapi.entity.UHFTAGInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.JavaNetCookieJar;
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
    private String campId;
    private final int perm_count = 1;
    private TextView title;
    private Boolean isSuccesful;
    private final HashSet<String> uniqueEpcSet = new HashSet<>();
    private TableLayout tableLayout;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private boolean isValidCode;
    private final ExecutorService executorService = Executors.newFixedThreadPool(3);

    private void fetchCsrfToken() {
        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            try {
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/csrf-token")
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    String responseBody = response.body().string();
                    JSONObject jsonObject = new JSONObject(responseBody);
                    csrfToken = jsonObject.getString("csrfToken");

                } else {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Failed to get CSRF token", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Token error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private void checkForUpdate() {
        executorService.execute(() -> {
            try {
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/apk-laundry-version")
                        .build();

                client.newCall(request).enqueue(new Callback() {
                    @Override
                    public void onFailure(@NonNull Call call, @NonNull IOException e) {
                        Log.e("UpdateCheck", "Error: " + e.getMessage());
                    }

                    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
                    @Override
                    public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                        if (response.isSuccessful()) {
                            String resBody = Objects.requireNonNull(response.body()).string();
                            try {
                                JSONObject json = new JSONObject(resBody);
                                String latestVersion = json.getString("version");
                                String apkUrl = json.getString("apkUrl");

                                PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                                String currentVersion = pInfo.versionName;

                                if (!currentVersion.equals(latestVersion)) {
                                    runOnUiThread(() -> sendUpdateNotification(apkUrl));
                                }
                            } catch (Exception e) {
                                Log.e("UpdateCheck", "JSON error: " + e.getMessage());
                            }
                        }
                    }
                });
            } catch (Exception e) {
                Log.e("UpdateCheck", "Exception: " + e.getMessage());
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    private void sendUpdateNotification(String apkUrl) {
        String channelId = "update_channel";
        String channelName = "App Updates";

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        NotificationChannel channel = new NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH);
        notificationManager.createNotificationChannel(channel);

        Intent intent = new Intent(this, SettingsActivity.class);
        intent.putExtra("apkUrl", apkUrl);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_update) // use your icon
                .setContentTitle("New Version Available")
                .setContentText("Tap to update the app.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        notificationManager.notify(1001, builder.build());
    }

    @SuppressLint("WrongViewCast")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        fetchCsrfToken();

        isValidCode = GlobalVariable.getValidatationData(this);

        if(!isValidCode) {
            showLoginDialog();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
            }
        }

        checkForUpdate();

        ImageButton settingsButton = findViewById(R.id.settingsButton);

        settingsButton.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            startActivity(intent);
        });

        title = findViewById(R.id.title);

        destination = GlobalVariable.getVariable(this);
        prev_destination = GlobalVariable.getPrevDestination(this);  // Retrieving the previous destination
        campId = GlobalVariable.getCamp(this);

        if(campId.isEmpty()) {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show();
            return;
        }

        title.setText(destination);

        isSuccesful = false;

        // Find the menu button
        ImageButton menuButton = findViewById(R.id.menuButton);

        // Set an OnClickListener to show the PopupMenu
        menuButton.setOnClickListener(this::showPopupMenu);
        tableLayout = findViewById(R.id.tableLayout);

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.free();
            rfidReader.init();

            Toast.makeText(MainActivity.this, "RFID Reader initialized", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e("MainActivity", "Error: " + e.getMessage());
            Toast.makeText(MainActivity.this, "Error initializing RFID Reader", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchCsrfToken();
    }

    private void showLoginDialog() {
        // Create an AlertDialog builder
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("\uD83D\uDD12 Login");

        // Create a LinearLayout to hold the username and password fields
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 40, 50, 10);

        // Username input
        final EditText usernameInput = new EditText(this);
        usernameInput.setHint("Username");
        usernameInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT);
        layout.addView(usernameInput);

        // Password input
        final EditText passwordInput = new EditText(this);
        passwordInput.setHint("Password");
        passwordInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        layout.addView(passwordInput);

        builder.setView(layout);

        // "Login" button
        builder.setPositiveButton("Login", null); // We'll override the click listener later

        // "Cancel" button
        builder.setNegativeButton("Cancel", (dialog, which) -> {
            finish(); // Close the app
        });

        AlertDialog dialog = builder.create();

        // Override "Login" button behavior
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String username = usernameInput.getText().toString().trim();
            String password = passwordInput.getText().toString().trim();

            boolean valid = true;

            if (username.isEmpty()) {
                usernameInput.setError("Username cannot be empty");
                valid = false;
            }

            if (password.isEmpty()) {
                passwordInput.setError("Password cannot be empty");
                valid = false;
            }

            if (valid) {
                checkLoginToServer(usernameInput, passwordInput, username, password);
            }
        }));

        dialog.setOnDismissListener(dialogInterface -> {
            if (!GlobalVariable.getValidatationData(this)) {
                finish(); // Close the app if login fails or is canceled
            }
        });

        dialog.show();
    }

    private void checkLoginToServer(EditText usernameInput, EditText passwordInput, String username, String password) {
        executorService.execute(()-> {
            try {

                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();
                payload.put("username", username);
                payload.put("password", password);

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/checkLogInApp")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);
                    boolean isValidLogin = jsonResponse.optBoolean("success", false);
                    boolean isValidUsername = jsonResponse.optBoolean("validUsername", false);

                    runOnUiThread(() -> {
                        if (!isValidUsername) {
                            usernameInput.setError("Invalid username");
                        } else if (!isValidLogin) {
                            passwordInput.setError("Invalid password");
                        } else {
                            fetchQRCodeFor2FA();
                        }
                    });
                }
            } catch (Exception e) {
                Log.e("MainActivity", "Error: " + e.getMessage());
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPCs to server: " + e.getMessage()));
            }
        });
    }

    private void fetchQRCodeFor2FA() {
        executorService.execute(() -> {
            Request request = new Request.Builder()
                    .url(getString(R.string.base_url) + "/2fa-verificated-device")
                    .get()
                    .build();

            try (Response response = client.newCall(request).execute()) {
                String json = Objects.requireNonNull(response.body()).string();
                JSONObject obj = new JSONObject(json);
                String qrBase64 = obj.getString("qrCodeDataURL").split(",")[1]; // remove data:image/png;base64,

                byte[] decodedBytes = Base64.decode(qrBase64, Base64.DEFAULT);
                Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

                runOnUiThread(() -> showQRCodeDialog(bitmap));
            } catch (Exception e) {
                runOnUiThread(() -> showPopupWindow("Error","Failed to load QR code: " + e.getMessage()));
            }
        });
    }

    private void showQRCodeDialog(Bitmap qrBitmap) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Scan QR Code with Authenticator");

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 40, 50, 10);

        ImageView imageView = new ImageView(this);

        int size = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 250, getResources().getDisplayMetrics()); // 250dp

        LinearLayout.LayoutParams imageParams = new LinearLayout.LayoutParams(size, size);
        imageParams.gravity = Gravity.CENTER;
        imageParams.setMargins(0, 0, 0, 30); // bottom margin for spacing
        imageView.setLayoutParams(imageParams);

        imageView.setImageBitmap(qrBitmap);
        layout.addView(imageView);

        final EditText input = new EditText(this);
        input.setHint("Enter 6-digit code");
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        layout.addView(input);

        builder.setView(layout);

        builder.setPositiveButton("Verify", (dialog, which) -> {
            String code = input.getText().toString().trim();
            if (!code.isEmpty()) {
                verifyTOTPCode(code);
            } else {
                input.setError("Please enter the code");
            }
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void verifyTOTPCode(String code) {
        executorService.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("code", code);

                RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

                Request request = new Request.Builder()
                        .url(getString(R.string.base_url) + "/verify-device")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);
                    boolean success = jsonResponse.optBoolean("success", false);

                    runOnUiThread(() -> {
                        if (success) {
                            GlobalVariable.saveValidatationData(this, true);
                            finish();
                        } else {
                            showPopupWindow("Error", "Invalid 2FA code.");
                        }
                    });
                }
            } catch (Exception e) {
                runOnUiThread(() -> showPopupWindow("Error", "Error verifying 2FA: " + e.getMessage()));
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 293) {
            if (isInventory) {
                isSuccesful = true;
                stopInventoryThread();
            } else if (destination.equals("No set mode")) {
                showPopupWindow("Error", "First you need to select a destination in the upper right corner");
            } else {
                executorService.execute(() -> {
                    final boolean serverActive = isServerActive();
                    runOnUiThread(() -> {
                        if (serverActive) {
                            startInventoryThread();
                        } else {
                            Toast.makeText(MainActivity.this, "Server is not active. Cannot start scan.", Toast.LENGTH_SHORT).show();
                        }
                    });
                });
            }
            return true;

        } else if (keyCode == 139) {
            runOnUiThread(this::showPopupWindowService);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // Method to check if the server is active
    private boolean isServerActive() {
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl)
                .get()
                .build();

        try {
            Response response = client.newCall(request).execute(); // Reuse the OkHttpClient instance
            return response.isSuccessful();
        } catch (Exception e) {
            Log.e("MainActivity", "Error: " + e.getMessage());
            return false;
        }
    }

    // Method to start inventory (scanning)
    private void startInventoryThread() {
        title.setText(destination.equals("None") ? "Taking from soldier" : destination);
        resetData(); // Clear data before starting a new scan

        if (rfidReader.startInventoryTag()) {
            isInventory = true;

            // Submit the RFID scanning task to the executor
            executorService.execute(() -> {

                final Set<String> invalidEpcSet = Collections.synchronizedSet(new HashSet<>()); // To store invalid EPCs

                    while (isInventory && !Thread.currentThread().isInterrupted()) {
                        UHFTAGInfo uhftagInfo = rfidReader.readTagFromBuffer();
                        if (uhftagInfo == null) {
                            try {
                                Thread.sleep(0); // Wait for 0 milliseconds before reading the next tag
                            } catch (InterruptedException e) {
                                Log.e("MainActivity", "Error: " + e.getMessage());
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
                                        jsonPayload.put("isValidCode", isValidCode);
                                    } catch (JSONException e) {
                                        Log.e("MainActivity", "Error: " + e.getMessage());
                                    }

                                    String jsonData = jsonPayload.toString();
                                    RequestBody body = RequestBody.create(jsonData, JSON);

                                    String baseUrl = getString(R.string.base_url);
                                    Request request = new Request.Builder()
                                            .url(baseUrl + "/checkScaningCode")
                                            .addHeader("X-CSRF-Token", csrfToken)
                                            .post(body)
                                            .build();

                                    try (Response response = client.newCall(request).execute()) {

                                        if (response.isSuccessful()) {
                                            String responseData = Objects.requireNonNull(response.body()).string();
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
                                                Log.e("MainActivity", "Error: " + e.getMessage());
                                            }

                                            // Mark the EPC as invalid and skip it in future scans
                                            synchronized (invalidEpcSet) {
                                                invalidEpcSet.add(epc);
                                            }

                                            String finalErrorMessage = errorMessage; // Pass the extracted message to UI thread
                                            runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
                                        }
                                    }

                                } catch (InterruptedIOException e) {
                                    // Log the error or handle it as needed
                                    Log.e("MainActivity", "Error: " + e.getMessage());
                                } catch (Exception e) {
                                    Log.e("MainActivity", "Error: " + e.getMessage());
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
            });
        } else {
            runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "Failed to start scanning", Toast.LENGTH_SHORT).show()
            );
        }
    }

    // Method to stop the background thread for reading tags
    private void stopInventoryThread() {
        if (isInventory) {
            isInventory = false;

            if (rfidReader != null) {
                rfidReader.stopInventory();
            }

            if (isSuccesful) {
                executorService.execute(() -> {
                    boolean success = sendAllEpcsToServer(uniqueEpcSet);
                    runOnUiThread(() -> {
                        if (success) {
                            showPopupWindow("Scan Summary", "Total bags codes found: " + uniqueEpcSet.size());
                        }
                    });
                });
                isSuccesful = false;
            }
        }
    }

    private Future<Boolean> checkCountScanningCodes(Integer countScannedCode) {
        return executorService.submit(() -> {
            boolean success = true;

            Dialog loadingDialog = new Dialog(MainActivity.this);
            runOnUiThread(() -> {
                loadingDialog.setContentView(R.layout.progress_dialog);
                loadingDialog.setCancelable(false);
                Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
                loadingDialog.show();
            });

            try {
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");

                JSONObject payload = new JSONObject();
                payload.put("countScaneCode", countScannedCode);
                payload.put("prev_destination", prev_destination);
                payload.put("campId", campId);
                payload.put("isValidCode", isValidCode);

                RequestBody body = RequestBody.create(payload.toString(), JSON);

                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/checkCountScanningCodes")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {

                    if (!response.isSuccessful()) {
                        String errorMessage = "Unknown error";
                        if (response.body() != null) {
                            String responseBody = response.body().string();
                            JSONObject errorJson = new JSONObject(responseBody);
                            errorMessage = errorJson.optString("message", "Internal server error");
                        }

                        final String finalErrorMessage = errorMessage;
                        runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
                        success = false;
                    }
                }
            } catch (Exception e) {
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPCs to server: " + e.getMessage()));
                success = false;
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }

            return success;
        });
    }

    // Method to reset the table and EPC set before starting a new scan
    private void resetData() {
        uniqueEpcSet.clear(); // Clear unique EPC codes
        tableLayout.removeAllViews(); // Remove all rows, including the header
    }

    // Method to show popup window with total found EPC codes
    private void showPopupWindow(String title, String message) {
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
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {
            try {

                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/bags?isValidCode=" + isValidCode + "&campId=" + campId)
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
        });
    }

    private void showPopupWindowService() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);

        // Inflate the custom view
        View customView = getLayoutInflater().inflate(R.layout.popup_spinner_layout, null);
        Spinner bagSpinner = customView.findViewById(R.id.bagSpinner);

        builder.setTitle("Linen Exchange additional service")
                .setView(customView)
                .setPositiveButton("OK", (dialog, which) -> {
                    String selectedBagCode = (String) bagSpinner.getSelectedItem();
                    Object tag = bagSpinner.getTag();
                    if (tag instanceof Map<?, ?>) {
                        @SuppressWarnings("unchecked")
                        Map<String, String> bagIdMap = (Map<String, String>) tag;

                        destination = "Linen Exchange service";
                        uniqueEpcSet.clear();

                        if (selectedBagCode != null) {
                            String selectedBagId = bagIdMap.get(selectedBagCode);
                            uniqueEpcSet.add(selectedBagId);
                            sendAllEpcsToServer(uniqueEpcSet);
                            dialog.dismiss();
                            showPopupWindow("Information", "Operation completed successfully");
                        }
                    } else {
                        Log.w("MainActivity", "Unexpected tag type: " + tag.getClass().getSimpleName());
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
        executorService.shutdown(); // Ensures proper shutdown of background tasks
        // Stop inventory and free resources when activity is destroyed
        stopInventoryThread();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }

    private boolean checkBagCode(String epc) {
        try {
            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
            JSONObject jsonPayload = new JSONObject();
            try {
                jsonPayload.put("code", epc);
                jsonPayload.put("isValidCode", isValidCode);
            } catch (JSONException e) {
                Log.e("MainActivity", "Error: " + e.getMessage());
            }
            String jsonData = jsonPayload.toString();

            RequestBody body = RequestBody.create(jsonData, JSON);

            String baseUrl = getString(R.string.base_url);
            Request request = new Request.Builder()
                    .url(baseUrl + "/check-bag") // Use the new endpoint
                    .addHeader("X-CSRF-Token", csrfToken)
                    .post(body)
                    .build();

            try (Response response = client.newCall(request).execute()) {

                if (response.isSuccessful()) {
                    String responseData = Objects.requireNonNull(response.body()).string();
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
                        Log.e("MainActivity", "Error: " + e.getMessage());
                    }

                    String finalErrorMessage = errorMessage; // Pass the extracted message to UI thread
                    runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
                }
            }

        } catch (InterruptedIOException e) {
            // Log the error or handle it as needed
            Log.e("MainActivity", "Error: " + e.getMessage());
            return false;

        } catch (Exception e) {
            Log.e("MainActivity", "Error: " + e.getMessage());
            runOnUiThread(() -> showPopupWindow("Error", "Error checking bag code: " + e.getMessage()));
        }

        return false; // Default to false if there's an error
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private boolean sendAllEpcsToServer(HashSet<String> epcs) {
        final boolean[] success = {true};

        executorService.execute(() -> {
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
                payload.put("campId", campId);
                payload.put("isValidCode", isValidCode);

                String url;
                String baseUrl = getString(R.string.base_url);

                if("Linen Exchange service".equals(destination)) {
                    url = baseUrl + "/changeEndToEndStatus";
                } else {
                    url = baseUrl + "/changeStatusBulk";
                }

                RequestBody body = RequestBody.create(payload.toString(), JSON);

                Request request = new Request.Builder()
                        .url(url)
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                try (Response response = client.newCall(request).execute()) {

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
                }
            } catch (Exception e) {
                Log.e("MainActivity", "Error: " + e.getMessage());
                runOnUiThread(() -> showPopupWindow("Error", "Error sending EPCs to server: " + e.getMessage()));
                success[0] = false;
            }
        });

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