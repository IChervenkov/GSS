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
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity {

    private RFIDWithUHFUART rfidReader;
    private Call currentCall;
    private final AtomicBoolean isInventory = new AtomicBoolean(false);
    private final AtomicBoolean shouldStopScanning = new AtomicBoolean(false);
    private final AtomicBoolean isSuccesful = new AtomicBoolean(false);
    private final List<String> errorMessages = new CopyOnWriteArrayList<>();
    private final AtomicInteger pendingRequests = new AtomicInteger(0);
    private String destination;
    private String prev_destination;
    private String campId;
    private TextView title;
    private final Set<String> uniqueEpcSet = ConcurrentHashMap.newKeySet();
    private TableLayout tableLayout;
    private String globalUsername;
    private String jwtToken;
    private final DebounceMessageHelper messageHelper = new DebounceMessageHelper(this);
    private final Set<String> processingEpcSet = ConcurrentHashMap.newKeySet(); // prevent duplicates while processing
    private final Set<Call> activeCalls = Collections.synchronizedSet(new HashSet<>());
    private final LinkedBlockingQueue<String> epcQueue = new LinkedBlockingQueue<>(5000); // capacity to avoid unlimited memory growth
    private final int CONSUMER_COUNT = 5;   // number of concurrent network workers (tune as needed)
    private OkHttpClient client;
    private final ExecutorService executorService = Executors.newFixedThreadPool(CONSUMER_COUNT + 2);

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

    private void checkForUpdate() {

        if (isNetworkAvailable())
            return;

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/apk-laundry-version")
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("There is a problem with app update. Please connect to the support.");
                runOnUiThread(loadingDialog::dismiss);
            }

            @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {

                try {

                    String resBody = Objects.requireNonNull(response.body()).string();
                    JSONObject json = new JSONObject(resBody);

                    if (!response.isSuccessful()) {
                        String serverMessage = json.optString("message", "There is a problem with app update. Please connect to the support.");
                        messageHelper.showError(serverMessage);
                        return;
                    }

                    String latestVersion = json.getString("version");
                    String apkUrl = json.getString("apkUrl");

                    PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                    String currentVersion = pInfo.versionName;

                    if (!Objects.equals(currentVersion, latestVersion)) {
                        runOnUiThread(() -> sendUpdateNotification(apkUrl));
                    }

                } catch (Exception e) {
                    messageHelper.showError("There is a problem with the app update process. Please connect to the support.");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
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

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        jwtToken = GlobalVariable.getAuthenticateToken(this);

        if (jwtToken == null || jwtToken.isEmpty()) {
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

        if (campId.isEmpty()) {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            startActivity(intent);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show());
            finish();
        }

        title.setText(destination.equals("None") ? "Picked up" : destination);

        // Load persisted EPCs so we don't re-send already processed codes after crash/restart
        Set<String> persisted = GlobalVariable.getStringSet(this);
        if (persisted != null) {
            uniqueEpcSet.addAll(persisted);
            processingEpcSet.addAll(persisted); // treat persisted as already processed
        }

        // Find the menu button
        ImageButton menuButton = findViewById(R.id.menuButton);

        // Set an OnClickListener to show the PopupMenu
        menuButton.setOnClickListener(this::showPopupMenu);
        tableLayout = findViewById(R.id.tableLayout);
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
            if (jwtToken == null || jwtToken.isEmpty()) {
                finish(); // Close the app if login fails or is canceled
            }
        });

        dialog.show();
    }

    private void checkLoginToServer(EditText usernameInput, EditText passwordInput, String username, String password) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performLogin(usernameInput, passwordInput, username, password);
    }

    private void performLogin(EditText usernameInput, EditText passwordInput, String username, String password) {

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject payload = new JSONObject();

        try {
            payload.put("username", username);
            payload.put("password", password);

        } catch (Exception e) {
            messageHelper.showError("Error when parse data. Please connect to the support.");
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/checkLogInApp")
                .post(body)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {

            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error when login. Please connect to the support.");
                runOnUiThread(loadingDialog::dismiss);
            }

            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonResponse.optString("message", "Error when login. Please connect to the support.");
                        messageHelper.showError(serverMessage);
                        return;
                    }

                    boolean isValidLogin = jsonResponse.optBoolean("success", false);
                    boolean isValidUsername = jsonResponse.optBoolean("validUsername", false);

                    if (!isValidUsername) {
                        runOnUiThread(() -> usernameInput.setError("Invalid username"));
                    } else if (!isValidLogin) {
                        runOnUiThread(() -> passwordInput.setError("Invalid password"));
                    } else {
                        globalUsername = username;
                        fetchQRCodeFor2FA();
                    }

                } catch (Exception e) {
                    messageHelper.showError("Error when login. Please connect to the support.");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void fetchQRCodeFor2FA() {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/2fa-verificated-device?username=" + globalUsername)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {

            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Failed to load QR code, Please connect to support!");
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    String json = Objects.requireNonNull(response.body()).string();
                    JSONObject obj = new JSONObject(json);

                    if (!response.isSuccessful()) {
                        String serverMessage = obj.optString("message", "Failed to load QR code, Please connect to support!");
                        messageHelper.showError(serverMessage);
                        return;
                    }

                    String qrBase64 = obj.getString("qrCodeDataURL").split(",")[1];
                    JSONObject secret = obj.getJSONObject("secret");

                    byte[] decodedBytes = Base64.decode(qrBase64, Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

                    runOnUiThread(() -> showQRCodeDialog(bitmap, secret));

                } catch (Exception e) {
                    messageHelper.showError("Failed to load QR code, Please connect to support!");
                }
            }
        });
    }

    private void showQRCodeDialog(Bitmap qrBitmap, JSONObject secret) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Scan QR Code with Authenticator");

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 40, 50, 10);
        layout.setGravity(Gravity.CENTER_HORIZONTAL);

        // QR Image
        ImageView imageView = new ImageView(this);
        int size = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 250, getResources().getDisplayMetrics());
        LinearLayout.LayoutParams imageParams = new LinearLayout.LayoutParams(size, size);
        imageParams.gravity = Gravity.CENTER;
        imageParams.setMargins(0, 0, 0, 30);
        imageView.setLayoutParams(imageParams);
        imageView.setImageBitmap(qrBitmap);
        layout.addView(imageView);

        // Container for 6-digit input
        LinearLayout pinLayout = new LinearLayout(this);
        pinLayout.setOrientation(LinearLayout.HORIZONTAL);
        pinLayout.setGravity(Gravity.CENTER);
        int digitWidth = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 40, getResources().getDisplayMetrics());
        int digitMargin = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, 8, getResources().getDisplayMetrics());

        EditText[] digits = new EditText[6];

        // Create the dialog first
        AlertDialog dialog = builder.setView(layout)
                .setNegativeButton("Cancel", null)
                .create();

        for (int i = 0; i < 6; i++) {
            final int index = i;
            digits[i] = new EditText(this);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(digitWidth, LinearLayout.LayoutParams.WRAP_CONTENT);
            params.setMargins(digitMargin, 0, digitMargin, 0);
            digits[i].setLayoutParams(params);
            digits[i].setGravity(Gravity.CENTER);
            digits[i].setInputType(InputType.TYPE_CLASS_NUMBER);
            digits[i].setMaxLines(1);
            digits[i].setFilters(new InputFilter[]{new InputFilter.LengthFilter(1)});
            digits[i].setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
            digits[i].setEms(1);

            // Move focus to next digit and auto-verify
            digits[i].addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {
                }

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {
                }

                @Override
                public void afterTextChanged(Editable s) {
                    if (s.length() == 1 && index < 5) {
                        digits[index + 1].requestFocus();
                    }
                    // If all digits entered, auto-verify
                    StringBuilder code = new StringBuilder();
                    for (EditText d : digits) {
                        if (d.getText().toString().isEmpty()) return;
                        code.append(d.getText().toString());
                    }
                    verifyTOTPCode(code.toString(), secret);
                    dialog.dismiss(); // now dialog is accessible
                }
            });

            pinLayout.addView(digits[i]);
        }

        layout.addView(pinLayout);
        dialog.show();
    }

    private void verifyTOTPCode(String code, JSONObject secret) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performTOTPVerify(code, secret);
    }

    private void performTOTPVerify(String code, JSONObject secret) {
        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String deviceId = GlobalVariable.getOrCreateDeviceId(this);
        JSONObject payload = new JSONObject();

        try {
            payload.put("code", code);
            payload.put("userSecret", secret);
            payload.put("username", globalUsername);
            payload.put("deviceId", deviceId);
            payload.put("deviceName", Build.MANUFACTURER + " " + Build.MODEL);

        } catch (JSONException e) {
            messageHelper.showError("Error when parsed. Please connect to support!");
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(getString(R.string.base_url) + "/verify-device")
                .post(body)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {

            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error verifying 2FA. Please connect to support!");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonResponse.optString("message", "Error verifying 2FA. Please connect to support!");
                        messageHelper.showError(serverMessage);
                        return;
                    }

                    String accessToken = jsonResponse.optString("accessToken", "");
                    String refreshToken = jsonResponse.optString("refreshToken", "");

                    GlobalVariable.saveAuthenticateToken(MainActivity.this, accessToken);
                    GlobalVariable.saveRefreshToken(MainActivity.this, refreshToken);
                    GlobalVariable.saveUsername(MainActivity.this, globalUsername);

                    Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show());

                } catch (Exception e) {
                    messageHelper.showError("Error verifying 2FA. Please connect to support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == 293) {
            if (isInventory.get()) {
                isSuccesful.set(true);
                stopInventoryThread();
            } else if (destination.equals("No set mode")) {
                messageHelper.showError("First you need to select a destination in the upper right corner");
            } else {
                isSuccesful.set(false);
                startInventoryThread();
            }
            return true;

        } else if (keyCode == 139 && !isInventory.get()) {
            runOnUiThread(this::showPopupWindowService);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // Method to start inventory (scanning)
    private void startInventoryThread() {
        // Check network correctly
        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        title.setText(destination.equals("None") ? "Picked up" : destination);
        resetData(); // clear in-memory UI/state

        if (rfidReader == null) {
            try {
                rfidReader = RFIDWithUHFUART.getInstance();
                rfidReader.init();
            } catch (Exception e) {
                messageHelper.showError("Error initializing RFID Reader");
                return;
            }
        }

        if (!rfidReader.startInventoryTag()) {
            messageHelper.showError("Failed to start scanning. Check if device supports RFID reader");
            return;
        }

        shouldStopScanning.set(false);
        isInventory.set(true);
        runOnUiThread(() -> Toast.makeText(this, "Start scanning", Toast.LENGTH_SHORT).show());

        // Producer thread: reads RFID tags and pushes to queue
        executorService.execute(() -> {
            try {
                while (isInventory.get() && !shouldStopScanning.get() && !Thread.currentThread().isInterrupted()) {
                    UHFTAGInfo uhftagInfo = rfidReader.readTagFromBuffer();
                    if (uhftagInfo == null) {
                        try {
                            Thread.sleep(50); // reduce CPU usage
                        } catch (InterruptedException ex) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                        continue;
                    }

                    String epc = uhftagInfo.getEPC();
                    if (epc == null || epc.isEmpty()) continue;

                    // Avoid re-processing duplicates in memory
                    if (!processingEpcSet.add(epc)) continue;

                    // Offer to queue with a short timeout to avoid blocking forever
                    boolean offered = epcQueue.offer(epc, 200, TimeUnit.MILLISECONDS);
                    if (!offered) {
                        // Queue full: drop epc and remove from processing set so it may be rescan later
                        processingEpcSet.remove(epc);
                    }
                }
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        });

        // Start consumer workers that send to server (bounded concurrency)
        for (int i = 0; i < CONSUMER_COUNT; i++) {
            executorService.execute(this::processEpcQueue);
        }
    }

    private void processEpcQueue() {
        while (isInventory.get() && !shouldStopScanning.get() && !Thread.currentThread().isInterrupted()) {
            try {
                String epc = epcQueue.poll(200, TimeUnit.MILLISECONDS);
                if (epc == null) continue;

                sendCheckEpc(epc);

                // small throttle between network requests to avoid overwhelming the server
                try {
                    Thread.sleep(20); // tune this as needed
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            } catch (Exception ignored) {
            }
        }
    }

    private void sendCheckEpc(String epc) {
        // Build JSON
        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonPayload = new JSONObject();
        try {
            JSONArray codesArray = new JSONArray();
            codesArray.put(epc);

            jsonPayload.put("codes", codesArray);
            jsonPayload.put("prev_destination", prev_destination);
            jsonPayload.put("destination", destination);
            jsonPayload.put("permCount", 1);
        } catch (Exception e) {
            return;
        }

        String jsonData = jsonPayload.toString();
        RequestBody body = RequestBody.create(jsonData, JSON);

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/checkScaningCode")
                .post(body)
                .build();

        Call call = client.newCall(request);
        activeCalls.add(call); // track active calls so we can cancel them later
        pendingRequests.incrementAndGet();

        call.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                activeCalls.remove(call);
                pendingRequests.decrementAndGet();
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                activeCalls.remove(call);
                try {
                    String responseBody = response.body().string();

                    if (!response.isSuccessful()) {
                        // parse server message if possible
                        JSONObject errorJson = new JSONObject(responseBody);
                        String errorMessage = errorJson.optString("message", "Internal server error");

                        String globalErrorHeader = response.header("X-Global-Error");
                        if ("true".equalsIgnoreCase(globalErrorHeader)) {
                            runOnUiThread(() -> messageHelper.showError(errorMessage));
                            stopInventoryThread();
                            return;
                        }

                        errorMessages.add(errorMessage);
                    }

                    JSONObject jsonResponse = new JSONObject(responseBody);
                    String responseCodes = jsonResponse.optString("validCodes", epc);
                    JSONArray codes = new JSONArray(responseCodes);

                    // Mark as successfully processed and add to UI only once
                    if (uniqueEpcSet.add(epc)) {
                        persistEpcs();
                        for (int i = 0; i < codes.length(); i++) {
                            JSONObject row = codes.getJSONObject(i);

                            String code = row.optString("code", "");
                            String soldierId = row.optString("soldierId", "");

                            runOnUiThread(() -> addRowToTable(code, soldierId));
                        }
                    }

                } catch (Exception e) {
                    processingEpcSet.remove(epc);
                } finally {
                    pendingRequests.decrementAndGet();
                }
            }
        });
    }

    private synchronized void persistEpcs() {
        try {
            // SharedPreferences.putStringSet is fine for small sets; convert to new HashSet to avoid mutability issues
            Set<String> toPersist = new HashSet<>(uniqueEpcSet);
            GlobalVariable.setStringSet(this, toPersist);
        } catch (Exception ignored) {
        }
    }

    // Method to stop the background thread for reading tags
    private void stopInventoryThread() {
        if (!isInventory.get()) return;

        runOnUiThread(() -> Toast.makeText(this, "Stop scanning", Toast.LENGTH_SHORT).show());

        shouldStopScanning.set(true);
        isInventory.set(false);

        // Stop RFID reader
        if (rfidReader != null) {
            try {
                rfidReader.stopInventory();
            } catch (Exception ignored) {
            }
            rfidReader = null;
        }

        // Cancel active network calls
        synchronized (activeCalls) {
            for (Call c : activeCalls) {
                try {
                    if (!c.isCanceled()) c.cancel();
                } catch (Exception ignored) {
                }
            }
            activeCalls.clear();
        }

        // Clear queue and processing set *if* you want to discard items — otherwise keep them to retry
        epcQueue.clear();
        processingEpcSet.clear();

        // Save final persisted set (already updated during successful responses)
        persistEpcs();

        if(!isSuccesful.get())
            return;

        // After finishing scanning, if you want to do a final server verification/batch send:
        executorService.execute(() -> {
            long waitStart = System.currentTimeMillis();
            long timeoutMs = 3000; // wait up to 3s for pending calls to finish
            while (pendingRequests.get() > 0 && System.currentTimeMillis() - waitStart < timeoutMs) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }

            // After waiting, perform final send of session EPCs (if any) — use a copy
            Set<String> toSend = new HashSet<>(uniqueEpcSet);
            if (!toSend.isEmpty()) {
                runOnUiThread(() -> sendAllEpcsToServer(toSend, () -> runOnUiThread(this::showScrollableErrorDialog)));
            } else {
                // No EPCs to send, just show summary immediately
                runOnUiThread(this::showScrollableErrorDialog);
            }
        });
    }

    // Method to reset the table and EPC set before starting a new scan
    private void resetData() {
        uniqueEpcSet.clear();
        tableLayout.removeAllViews(); // Remove all rows, including the header
    }

    private void fetchBag(Spinner bagSpinner) {

        if (isNetworkAvailable()) {
            return;
        }

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/bags?campId=" + campId)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error to get bags. Please connect to the support!");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject responseJson = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = responseJson.optString("message", "Error to get bags. Please connect to the support!");
                        messageHelper.showError(serverMessage);
                        return;
                    }

                    JSONArray bags = responseJson.getJSONArray("allBags");
                    runOnUiThread(() -> populateBagSpinner(bags, bagSpinner));

                } catch (Exception e) {
                    messageHelper.showError("Error to get bags. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void showPopupWindowService() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        String previousDestination = destination; // save current value

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
                            runOnUiThread(() -> sendAllEpcsToServer(uniqueEpcSet, () -> {
                                destination = previousDestination;
                                messageHelper.showMessage("Information", "Operation completed successfully");
                            }));
                            dialog.dismiss();
                        }
                    } else {
                        messageHelper.showError("Unexpected tag type. Connect to the support!");
                        destination = previousDestination;
                    }
                })
                .setNegativeButton("Cancel", (dialog, which) -> dialog.dismiss());

        // Show the dialog before fetching data
        AlertDialog dialog = builder.create();
        dialog.show();

        // Fetch bags and populate the spinner
        fetchBag(bagSpinner);
    }

    private void populateBagSpinner(JSONArray bags, Spinner bagSpinner) {
        try {
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

        } catch (JSONException e) {
            messageHelper.showError("Invalid bag data from server!");
        }
    }

    private void cancelAllCalls() {

        Call refreshCall = GlobalVariable.getRefreshCall();
        if (refreshCall != null && !refreshCall.isCanceled()) {
            refreshCall.cancel();
        }

        Call logoutCall = GlobalVariable.getLogoutCall();
        if (logoutCall != null && !logoutCall.isCanceled()) {
            logoutCall.cancel();
        }

        if (currentCall != null && !currentCall.isCanceled()) {
            currentCall.cancel();
        }

        // Cancel tracked active calls
        synchronized (activeCalls) {
            for (Call c : activeCalls) {
                try {
                    if (!c.isCanceled()) c.cancel();
                } catch (Exception ignored) {
                }
            }
            activeCalls.clear();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Stop scanning when pausing to avoid background scanning and UI race conditions
        stopInventoryThread();
        cancelAllCalls();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopInventoryThread();
        cancelAllCalls();

        if (executorService != null && !executorService.isShutdown()) {
            executorService.shutdownNow();
        }

        if (rfidReader != null) {
            try {
                rfidReader.free();
            } catch (Exception ignored) {
            }
            rfidReader = null;
        }
    }

    @SuppressLint("SetTextI18n")
    private void showScrollableErrorDialog() {
        if (errorMessages == null || errorMessages.isEmpty()) {
            messageHelper.showMessage("Scan Summary", "No errors detected. All bags processed successfully.");
            return;
        }

        // Inflate your custom dialog layout
        LayoutInflater inflater = LayoutInflater.from(this);
        View dialogView = inflater.inflate(R.layout.dialog_error_list, null);

        dialogView.findViewById(R.id.errorTitle);
        LinearLayout errorListContainer = dialogView.findViewById(R.id.errorListContainer);
        Button btnClose = dialogView.findViewById(R.id.btnCloseErrorDialog);

        // Make errors unique and show a limited number if too many
        Set<String> uniqueErrors = new LinkedHashSet<>(errorMessages);
        int maxToShow = 100; // to prevent UI lag on huge lists
        int shown = 0;

        for (String err : uniqueErrors) {
            if (shown++ >= maxToShow) {
                TextView extra = new TextView(this);
                extra.setText("... and " + (uniqueErrors.size() - maxToShow) + " more");
                extra.setTextColor(Color.GRAY);
                extra.setTextSize(14);
                extra.setPadding(10, 5, 10, 5);
                errorListContainer.addView(extra);
                break;
            }

            TextView tv = new TextView(this);
            tv.setText("- " + err);
            tv.setTextColor(Color.BLACK);
            tv.setTextSize(15);
            tv.setPadding(10, 5, 10, 5);
            errorListContainer.addView(tv);
        }

        // Build the dialog
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setView(dialogView);

        AlertDialog dialog = builder.create();
        dialog.setCancelable(false);
        dialog.show();

        // Optional: size dialog dynamically
        if (dialog.getWindow() != null) {
            int width = (int) (getResources().getDisplayMetrics().widthPixels * 0.9);
            dialog.getWindow().setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        // Close button action
        btnClose.setOnClickListener(v -> {
            dialog.dismiss();
            errorMessages.clear(); // reset for next scan
        });
    }

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendAllEpcsToServer(Set<String> epcs, Runnable onComplete) {
        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            if (onComplete != null) onComplete.run();
            return;
        }

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow())
                .setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");

        JSONArray epcArray = new JSONArray();
        for (String epc : epcs) {
            epcArray.put(epc);
        }

        JSONObject payload = new JSONObject();
        try {
            payload.put("codes", epcArray);
            payload.put("destination", destination);
            payload.put("prev_destination", prev_destination);
            payload.put("campId", campId);
        } catch (Exception e) {
            runOnUiThread(loadingDialog::dismiss);
            messageHelper.showError("Error preparing data. Please contact support.");
            if (onComplete != null) onComplete.run();
            return;
        }

        String baseUrl = getString(R.string.base_url);
        String url = "Linen Exchange service".equals(destination)
                ? baseUrl + "/api/changeEndToEndStatus"
                : baseUrl + "/api/changeStatusBags";

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        Request request = new Request.Builder().url(url).post(body).build();

        Call call = client.newCall(request);
        activeCalls.add(call);

        call.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                activeCalls.remove(call);
                runOnUiThread(loadingDialog::dismiss);
                messageHelper.showError("Error sending data. Please contact support!");
                if (onComplete != null) onComplete.run();
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                activeCalls.remove(call);
                try {
                    if (!response.isSuccessful()) {
                        String errorMessage = "Internal server error";
                        String responseBody = response.body().string();
                        JSONObject errorJson = new JSONObject(responseBody);
                        errorMessage = errorJson.optString("message", errorMessage);
                        messageHelper.showError(errorMessage);
                    } else {
                        runOnUiThread(() -> Toast.makeText(MainActivity.this, "All bags have been moved successfully.", Toast.LENGTH_SHORT).show());
                    }
                } catch (Exception e) {
                    messageHelper.showError("Error processing response. Please contact support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                    if (onComplete != null) onComplete.run();
                }
            }
        });
    }

    private int getRowCount() {
        return tableLayout.getChildCount();
    }

    @SuppressLint("SetTextI18n")
    private void updateTitleWithRowCount() {
        int rowCount = getRowCount();
        title.setText((destination.equals("None") ? "Picked up" : destination) + "\n" + rowCount + " scanned bags");
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

            if (isInventory.get())
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

            } else if (itemId == R.id.menu_transportation_to_pick_up) {
                updateMode("Transportation to pick up", "Laundry facility");
                resetData();
                return true;

            } else if (itemId == R.id.menu_ready_to_pick_up) {
                updateMode("Ready to pick up", "Transportation to pick up");
                resetData();
                return true;

            } else if (itemId == R.id.menu_picked_up) {
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
        Toast.makeText(this, "Change mode to " + (destination.equals("None") ? "Picked up" : destination), Toast.LENGTH_SHORT).show();
        this.destination = destination;
        if (prevDestination != null) {
            this.prev_destination = prevDestination;
            GlobalVariable.savePrevDestination(this, prevDestination);
        }
        title.setText(destination.equals("None") ? "Picked up" : destination);

        GlobalVariable.saveVariable(this, destination);
    }
}