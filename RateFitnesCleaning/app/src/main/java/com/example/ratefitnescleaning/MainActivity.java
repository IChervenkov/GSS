package com.example.ratefitnescleaning;

import android.Manifest;
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

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;

import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Toast;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class MainActivity extends AppCompatActivity {

    private String jwtToken;
    private Call currentCall;
    private String clientId = null;
    private String globalUsername;
    private String campId;
    private OkHttpClient client;
    private final ArrayList<String> ownerList = new ArrayList<>();
    private final Map<String, String> clientIdMap = new HashMap<>();
    private AutoCompleteTextView clientAutoCompleteTextView;
    private final DebounceMessageHelper messageHelper = new DebounceMessageHelper(this);

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
                .url(baseUrl + "/api/apk-fitness-version")
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
                    messageHelper.showError("There is a problem with app update. Please connect to the support.");
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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        clientAutoCompleteTextView = findViewById(R.id.clientAutoCompleteTextView);

        jwtToken = GlobalVariable.getAuthenticateToken(this);
        campId = GlobalVariable.getCamp(this);

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

        if (campId.isEmpty()) {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            startActivity(intent);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "No set camp. Set a camp to continue.", Toast.LENGTH_SHORT).show());
            finish();
        }

        ImageButton settingsButton = findViewById(R.id.settingsButton);

        settingsButton.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, SettingsActivity.class);
            startActivity(intent);
        });

        // Fetch client from the server
        fetchAvailableBikes();

        clientAutoCompleteTextView.setOnItemClickListener((parent, view, position, id) -> {
            String selectedClientName = (String) parent.getItemAtPosition(position);
            clientId = clientIdMap.get(selectedClientName);
            onClientSelected();
        });
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

        } catch (Exception e) {
            messageHelper.showError("Error verifying 2FA. Please connect to support!");
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/verify-device")
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
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "No set camp. Set a camp to continue.", Toast.LENGTH_SHORT).show());

                } catch (Exception e) {
                    messageHelper.showError("Error verifying 2FA. Please connect to support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void onClientSelected() {

        if (clientId == null || clientId.isEmpty()) {
            // User ID is not entered
            messageHelper.showError("Please enter your ID first");
            return;
        }

        // User ID and emoji are ready, now send to serve
        sendClientData(clientId);
    }

    private void sendClientData(String userId) {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        performSendClient(userId);
    }

    // Modify the sendEmojiData method to include modal and clear old data
    private void performSendClient(String userId) {

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        JSONObject payload = new JSONObject();

        try {
            // Prepare the request body
            payload.put("userId", userId);

        } catch (Exception e) {
            messageHelper.showError("Error when send your data. Please contact with support!");
            runOnUiThread(loadingDialog::dismiss);
            return;
        }

        RequestBody body = RequestBody.create(payload.toString(), MediaType.parse("application/json; charset=utf-8"));

        // Make the request to the server
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/sendClientData") // Replace with your endpoint
                .post(body)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error when send your data. Please contact with support!");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String serverMessage = jsonResponse.optString("message", "Error when send your data. Please connect to the support.");
                        messageHelper.showError(serverMessage);
                        return;
                    }

                    String rowId = jsonResponse.optString("rowId", "");
                    GlobalVariable.saveSoldier(MainActivity.this, rowId);

                    // Handle success
                    runOnUiThread(() -> {
                        Intent intent = new Intent(MainActivity.this, Rated.class);
                        startActivity(intent);
                        finish();
                        clearOldData();
                    });

                } catch (Exception e) {
                    messageHelper.showError("Error when send your data. Please contact with support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void fetchAvailableBikes() {

        if (isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        Dialog loadingDialog = new Dialog(MainActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/getClient?campId=" + campId)
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error when fetch data. Please connect to the support.");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    final String responseData = Objects.requireNonNull(response.body()).string();

                    if (!response.isSuccessful()) {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        String serverMessage = jsonResponse.optString("message", "Error when fetch data. Please connect to the support.");
                        messageHelper.showError(serverMessage);
                        return;
                    }

                    JSONArray data = new JSONArray(responseData);

                    runOnUiThread(() -> populateBikeAutoComplete(data));

                } catch (Exception e) {
                    messageHelper.showError("Error when fetch data. Please connect to the support.");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateBikeAutoComplete(JSONArray bikes) {

        try {

            ownerList.clear();
            clientIdMap.clear();

            for (int i = 0; i < bikes.length(); i++) {
                JSONObject bike = bikes.getJSONObject(i);
                String bikeId = bike.getString("id");
                String bikeName = bike.getString("namesoldier");

                ownerList.add(bikeName);
                clientIdMap.put(bikeName, bikeId);
            }

            ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, ownerList);
            clientAutoCompleteTextView.setAdapter(adapter);
        } catch (Exception e) {
            messageHelper.showError("Error when parsing data. Please connect to the support.");
        }
    }

    private void cancelAllCalls() {
        // Cancel refresh call if active
        Call refreshCall = GlobalVariable.getRefreshCall();
        if (refreshCall != null && !refreshCall.isExecuted()) {
            refreshCall.cancel();
        }

        // Cancel logout call if active
        Call logoutCall = GlobalVariable.getLogoutCall();
        if (logoutCall != null && !logoutCall.isExecuted()) {
            logoutCall.cancel();
        }

        // Cancel current API call if active
        if (currentCall != null && !currentCall.isExecuted()) {
            currentCall.cancel();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelAllCalls();
    }

    @Override
    protected void onPause() {
        super.onPause();
        cancelAllCalls();
    }

    // Clear old data (clientId and selectedEmoji)
    private void clearOldData() {
        clientId = null;
    }
}