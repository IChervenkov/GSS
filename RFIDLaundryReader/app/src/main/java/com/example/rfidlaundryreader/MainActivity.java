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

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity implements CsrfTokenProvider {

    private RFIDWithUHFUART rfidReader;
    private boolean isInventory = false;
    private boolean shouldStopScanning;
    private String destination;
    private String prev_destination;
    private String campId;
    private TextView title;
    private Boolean isSuccesful;
    private final HashSet<String> uniqueEpcSet = new HashSet<>();
    private TableLayout tableLayout;
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .addInterceptor(new CsrfInterceptor(this))
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;
    private String globalUsername;
    private boolean isValidCode;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

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

    @Override
    public synchronized String getCsrfToken() {
        return csrfToken;
    }

    @Override
    public synchronized void refreshCsrfTokenSync() {
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/csrf-token")
                .build();

        try (Response response = client.newCall(request).execute()) {
            JSONObject jsonObject = new JSONObject(Objects.requireNonNull(response.body()).string());
            csrfToken = jsonObject.getString("csrfToken");
        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Error","Token error. Please restart the app and try again."));
        }
    }

    private void fetchCsrfToken(Runnable onSuccess) {

        if(isNetworkAvailable())
            return;

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/csrf-token")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error", "Token error. Please connect to the support."));
                runOnUiThread(loadingDialog::dismiss);
            }

            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseBody = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonObject = new JSONObject(responseBody);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonObject.optString("message", "Error when fetch token. Please connect to the support.");
                        runOnUiThread(() -> showPopupWindow("Error", serverMessage));
                        return;
                    }

                    csrfToken = jsonObject.getString("csrfToken");
                    if(onSuccess != null)
                        runOnUiThread(onSuccess);

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error", "Token error. Please connect to the support."));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void checkForUpdate() {

        if(isNetworkAvailable())
            return;

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/apk-laundry-version?isValidCode=" + isValidCode)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error", "There is a problem with app update. Please connect to the support."));
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
                        runOnUiThread(() -> showPopupWindow("Error", serverMessage));
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
                    runOnUiThread(() -> showPopupWindow("Error", "There is a problem with the app update process. Please connect to the support."));
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

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        fetchCsrfToken(null);

        isValidCode = GlobalVariable.getValidationData(this);

        if (!isValidCode) {
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

        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Error", "Error initializing RFID Reader"));
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchCsrfToken(null);
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
            if (!isValidCode) {
                finish(); // Close the app if login fails or is canceled
            }
        });

        dialog.show();
    }

    private void checkLoginToServer(EditText usernameInput, EditText passwordInput, String username, String password) {

        if(isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("Error", "You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if(csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performLogin(usernameInput, passwordInput, username, password));
        } else {
            performLogin(usernameInput, passwordInput, username, password);
        }
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
            runOnUiThread(() -> showPopupWindow("Error", "Error when parse data. Please connect to the support."));
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/checkLogInApp")
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        client.newCall(request).enqueue(new Callback() {

            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error", "Error when login. Please connect to the support."));
                runOnUiThread(loadingDialog::dismiss);
            }

            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonResponse.optString("message", "Error when login. Please connect to the support.");
                        runOnUiThread(() -> showPopupWindow("Error", serverMessage));
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
                    runOnUiThread(() -> showPopupWindow("Error", "Error when login. Please connect to the support."));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void fetchQRCodeFor2FA() {

        if(isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("Error", "You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        Request request = new Request.Builder()
                .url(getString(R.string.base_url) + "/2fa-verificated-device")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {

            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error", "Failed to load QR code, Please connect to support!"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    String json = Objects.requireNonNull(response.body()).string();
                    JSONObject obj = new JSONObject(json);

                    if (!response.isSuccessful()) {
                        String serverMessage = obj.optString("message", "Failed to load QR code, Please connect to support!");
                        runOnUiThread(() -> showPopupWindow("Error", serverMessage));
                        return;
                    }

                    String qrBase64 = obj.getString("qrCodeDataURL").split(",")[1]; // remove data:image/png;base64,

                    byte[] decodedBytes = Base64.decode(qrBase64, Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

                    runOnUiThread(() -> showQRCodeDialog(bitmap));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error", "Failed to load QR code, Please connect to support!"));
                }
            }
        });
    }

    private void showQRCodeDialog(Bitmap qrBitmap) {
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
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {}
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
                    verifyTOTPCode(code.toString());
                    dialog.dismiss(); // now dialog is accessible
                }
            });

            pinLayout.addView(digits[i]);
        }

        layout.addView(pinLayout);
        dialog.show();
    }

    private void verifyTOTPCode(String code) {

        if(isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("Error", "You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if(csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performTOTPVerify(code));
        } else {
            performTOTPVerify(code);
        }
    }

    private void performTOTPVerify(String code) {
        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        JSONObject payload = new JSONObject();

        try {
            payload.put("code", code);

        } catch (JSONException e) {
            runOnUiThread(() -> showPopupWindow("Error", "Error when parsed. Please connect to support!"));
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(getString(R.string.base_url) + "/verify-device")
                .addHeader("X-CSRF-Token", csrfToken)
                .post(body)
                .build();

        client.newCall(request).enqueue(new Callback() {

            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error", "Error verifying 2FA. Please connect to support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonResponse.optString("message", "Error verifying 2FA. Please connect to support!");
                        runOnUiThread(() -> showPopupWindow("Error", serverMessage));
                        return;
                    }

                    GlobalVariable.saveValidationData(MainActivity.this, true);
                    GlobalVariable.saveUsername(MainActivity.this, globalUsername);

                    Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "No set camp. Set a camp to start scanning.", Toast.LENGTH_SHORT).show());

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error", "Error verifying 2FA. Please connect to support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
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
                runOnUiThread(() -> showPopupWindow("Error", "First you need to select a destination in the upper right corner"));
            } else {
                startInventoryThread();
            }
            return true;

        } else if (keyCode == 139 && !isInventory) {
            runOnUiThread(this::showPopupWindowService);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // Method to start inventory (scanning)
    private void startInventoryThread() {
        title.setText(destination.equals("None") ? "Picked up" : destination);
        resetData(); // Clear data before starting a new scan

        if(isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("Error", "You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if(csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(this::performStartScanning);
        } else {
            performStartScanning();
        }
    }

    private void performStartScanning() {
        if (!rfidReader.startInventoryTag()) {
            runOnUiThread(() -> showPopupWindow("Error", "Failed to start scanning. Check if device supports RFID reader"));
            return;
        }

        shouldStopScanning = false;
        runOnUiThread(() -> Toast.makeText(this, "Start scanning", Toast.LENGTH_SHORT).show());

        isInventory = true;

        final Set<String> processingEpcSet = Collections.synchronizedSet(new HashSet<>());

        executorService.execute(() -> {
            while (isInventory && !shouldStopScanning && !Thread.currentThread().isInterrupted()) {
                UHFTAGInfo uhftagInfo = rfidReader.readTagFromBuffer();

                if (uhftagInfo == null) {
                    try {
                        Thread.sleep(50); // reduce CPU usage
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                    continue;
                }

                String epc = uhftagInfo.getEPC();
                if (epc == null || epc.isEmpty()) {
                    continue;
                }

                // Skip already invalid EPCs
                if (processingEpcSet.contains(epc)) {
                    continue;
                }

                processingEpcSet.add(epc);

                // Send to server asynchronously
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject jsonPayload = new JSONObject();

                try {
                    int perm_count = 1;
                    jsonPayload.put("code", epc);
                    jsonPayload.put("prev_destination", prev_destination);
                    jsonPayload.put("destination", destination);
                    jsonPayload.put("permCount", perm_count);
                    jsonPayload.put("isValidCode", isValidCode);

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error", "Error preparing request. Please connect to support!"));
                    stopInventoryThread();
                    return;
                }

                String jsonData = jsonPayload.toString();
                RequestBody body = RequestBody.create(jsonData, JSON);

                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/checkScaningCode")
                        .addHeader("X-CSRF-Token", csrfToken)
                        .post(body)
                        .build();

                // Use enqueue (async) instead of execute (blocking)
                client.newCall(request).enqueue(new Callback() {
                    @Override
                    public void onFailure(@NonNull Call call, @NonNull IOException e) {
                        runOnUiThread(() -> showPopupWindow("Error", "Network error. Please connect to support!"));
                        stopInventoryThread();
                    }

                    @Override
                    public void onResponse(@NonNull Call call, @NonNull Response response) {
                        try {

                            String responseBody = response.body().string();

                            if (!response.isSuccessful()) {
                                // Handle server error
                                String errorMessage = "Internal server error";

                                JSONObject errorJson = new JSONObject(responseBody);
                                errorMessage = errorJson.optString("message", errorMessage);

                                String globalErrorHeader = response.header("X-Global-Error");
                                if ("true".equalsIgnoreCase(globalErrorHeader)) {
                                    shouldStopScanning = true;
                                }

                                String finalErrorMessage = errorMessage;
                                runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));

                                if (shouldStopScanning) {
                                    stopInventoryThread();
                                }

                                return;
                            }

                            JSONObject jsonResponse = new JSONObject(responseBody);
                            String code = jsonResponse.getString("code");
                            String soldierId = jsonResponse.getString("soldierId");

                            boolean isNewEpc;
                            synchronized (uniqueEpcSet) {
                                isNewEpc = uniqueEpcSet.add(epc);
                            }

                            if (isNewEpc) {
                                runOnUiThread(() -> addRowToTable(code, soldierId));
                            }

                        } catch (Exception e) {
                            runOnUiThread(() -> showPopupWindow("Error", "Error processing server response."));
                            stopInventoryThread();
                        }
                    }
                });
            }
        });
    }

    // Method to stop the background thread for reading tags
    private void stopInventoryThread() {
        if (isInventory) {
            runOnUiThread(() -> Toast.makeText(this, "Stop scanning", Toast.LENGTH_SHORT).show());
            isInventory = false;

            if (rfidReader != null) {
                rfidReader.stopInventory();
            }

            if (isSuccesful) {
                sendAllEpcsToServer(uniqueEpcSet, () -> {
                    runOnUiThread(() -> showPopupWindow("Scan Summary", "Total bags codes found: " + uniqueEpcSet.size()));
                    isSuccesful = false;
                });
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
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(title);
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Reset the flag once the error dialog is clos
        });
        builder.show();
    }

    private void fetchBag(Spinner bagSpinner) {

        if(isNetworkAvailable()) {
            return;
        }

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/bags?isValidCode=" + isValidCode + "&campId=" + campId)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error", "Error to get bags. Please connect to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject responseJson = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = responseJson.optString("message", "Error to get bags. Please connect to the support!");
                        runOnUiThread(() -> showPopupWindow("Error", serverMessage));
                        return;
                    }

                    JSONArray bags = responseJson.getJSONArray("allBags");
                    runOnUiThread(() -> populateBagSpinner(bags, bagSpinner));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error", "Error to get bags. Please connect to the support!"));
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
                            sendAllEpcsToServer(uniqueEpcSet, () -> {
                                destination = previousDestination;
                                runOnUiThread(() -> showPopupWindow("Information", "Operation completed successfully"));
                            });
                            dialog.dismiss();
                        }
                    } else {
                        runOnUiThread(() -> showPopupWindow("Error", "Unexpected tag type. Connect to the support!"));
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
            runOnUiThread(() -> showPopupWindow("Error", "Invalid bag data from server!"));
        }
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

    // Method to send EPC to the server using the persistent OkHttpClient connection
    private void sendAllEpcsToServer(HashSet<String> epcs, Runnable onComplete) {

        if(isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("Error", "You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if(csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performSendEpc(epcs, onComplete));
        } else {
            performSendEpc(epcs, onComplete);
        }
    }

    private void performSendEpc(HashSet<String> epcs, Runnable onComplete) {
        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");

        // Create a JSON array for the EPCs
        JSONArray epcArray = new JSONArray();
        for (String epc : epcs) {
            epcArray.put(epc);
        }

        JSONObject payload = new JSONObject();

        try {
            payload.put("codes", epcArray); // Send the EPC array to the server
            payload.put("destination", destination);
            payload.put("prev_destination", prev_destination);
            payload.put("campId", campId);
            payload.put("isValidCode", isValidCode);

        } catch (Exception e) {
            runOnUiThread(() -> showPopupWindow("Error", "Error to parsed data. Please connect to the support!"));
            runOnUiThread(loadingDialog::dismiss);
            if (onComplete != null) onComplete.run();
            return;
        }

        String url;
        String baseUrl = getString(R.string.base_url);

        if ("Linen Exchange service".equals(destination)) {
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

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error", "Error when send data. Please connect to the support!"));
                runOnUiThread(loadingDialog::dismiss);
                if (onComplete != null) onComplete.run();
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    if (!response.isSuccessful()) {
                        String errorMessage;
                        String responseBody = response.body().string();
                        JSONObject errorJson = new JSONObject(responseBody);
                        errorMessage = errorJson.optString("message", "Internal server error");

                        String finalErrorMessage = errorMessage;
                        runOnUiThread(() -> showPopupWindow("Error", finalErrorMessage));
                        return;
                    }

                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "All bags have been moved successfully.", Toast.LENGTH_SHORT).show());

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error", "Error when send data. Please connect to the support!"));
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