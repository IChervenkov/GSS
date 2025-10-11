package com.example.rfidlaundryasset;

import android.app.Dialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;

import com.rscja.deviceapi.RFIDWithUHFUART;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class SettingsActivity extends AppCompatActivity {

    private Call currentCall;
    private String username;
    private String campId;
    private Spinner campSpinner;
    private SeekBar powerSeekBar;
    private TextView powerValueText;
    private RFIDWithUHFUART rfidReader;
    private OkHttpClient client;
    private final Map<String, String> campMap = new HashMap<>();
    private String selectedCampId;
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

    private void fetchCamp() {

        if(isNetworkAvailable())
            return;

        Dialog loadingDialog = new Dialog(SettingsActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/getAllCamp")
                .build();

        currentCall = client.newCall(request);
        currentCall.enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                messageHelper.showError("Error when fetch camp data. Please connect to the support!");
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    final String responseData = Objects.requireNonNull(response.body()).string();

                    if (!response.isSuccessful()) {
                        JSONObject jsonResponse = new JSONObject(responseData);
                        String serverMessage = jsonResponse.optString("message", "Error when fetch camps. Please connect to the support.");
                        messageHelper.showError(serverMessage);
                        return;
                    }

                    JSONArray allCamp = new JSONArray(responseData);
                    runOnUiThread(() -> populateCamp(allCamp));

                } catch (Exception e) {
                    messageHelper.showError("Error when fetch camp data. Please connect to the support!");
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateCamp(JSONArray allCamp) {
        try {
            List<String> campList = new ArrayList<>();
            String currentCampId = campId;
            int defaultIndex = 0; // Default selection index

            for (int i = 0; i < allCamp.length(); i++) {
                JSONObject campObject = allCamp.getJSONObject(i);
                String id = campObject.getString("id");
                String campName = campObject.getString("campname");

                campList.add(campName);
                campMap.put(campName, id);

                if (id.equals(currentCampId)) {
                    defaultIndex = i; // Set index of saved camp
                }
            }

            // Create Adapter and set to Spinner
            ArrayAdapter<String> adapter = new ArrayAdapter<>(SettingsActivity.this, android.R.layout.simple_spinner_dropdown_item, campList);
            campSpinner.setAdapter(adapter);
            campSpinner.setSelection(defaultIndex);

            // Handle item selection
            campSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                @Override
                public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                    String selectedCamp = (String) parent.getItemAtPosition(position);
                    selectedCampId = campMap.get(selectedCamp); // Get the id using camp name
                }

                @Override
                public void onNothingSelected(AdapterView<?> parent) {
                    // Do nothing
                }
            });

        } catch (JSONException e) {
            messageHelper.showError("Parsing camps error!");
        }
    }

    private void checkForUpdate() {

        if(isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        Dialog loadingDialog = new Dialog(SettingsActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/api/apk-asset-version")
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
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                String resBody = Objects.requireNonNull(response.body()).string();
                try {
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
                        runOnUiThread(() -> promptUpdate(apkUrl));
                    } else {
                        runOnUiThread(() -> Toast.makeText(SettingsActivity.this, "App is up to date", Toast.LENGTH_SHORT).show());
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
    private void promptUpdate(String apkUrl) {
        new AlertDialog.Builder(this)
                .setTitle("Update Available")
                .setMessage("A new version is available. Do you want to update now?")
                .setPositiveButton("Yes", (dialog, which) -> downloadAndInstall(apkUrl))
                .setNegativeButton("No", null)
                .show();
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    private void downloadAndInstall(String apkUrl) {

        if(isNetworkAvailable()) {
            messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
            return;
        }

        String fileName = "update.apk";
        File file = new File(getExternalFilesDir(null), fileName);

        // Delete previous download if exists
        if (file.exists()) file.delete();

        String baseUrl = getString(R.string.base_url);
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(baseUrl + apkUrl + "?username=" + username));
        request.setTitle("Downloading update...");
        request.setDescription("Please wait");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationUri(Uri.fromFile(file));

        DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        long downloadId = manager.enqueue(request);

        BroadcastReceiver onComplete = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                // Only proceed if this is our download
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != downloadId) return;

                if (!getPackageManager().canRequestPackageInstalls()) {
                    Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                            .setData(Uri.parse("package:" + getPackageName()));
                    startActivity(settingsIntent);
                    return;
                }

                Uri apkUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".provider",
                        file
                );

                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(apkUri, "application/vnd.android.package-archive");
                install.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(install);
                unregisterReceiver(this);
            }
        };
        registerReceiver(onComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        client = new OkHttpClient.Builder()
                .addInterceptor(new JwtInterceptor(this))
                .build();

        username = GlobalVariable.getUsername(this);
        campId = GlobalVariable.getCamp(this);

        if (getIntent().hasExtra("apkUrl")) {
            String apkUrl = getIntent().getStringExtra("apkUrl");
            promptUpdate(apkUrl);
        }

        // Initialize RFID reader
        try {
            rfidReader = RFIDWithUHFUART.getInstance();
            rfidReader.free();
            rfidReader.init();

        } catch (Exception e) {
            messageHelper.showError("Error initializing RFID Reader");
        }

        campSpinner = findViewById(R.id.campSpinner);
        powerSeekBar = findViewById(R.id.powerSeekBar);
        powerValueText = findViewById(R.id.powerValueText);
        Button saveButton = findViewById(R.id.saveButton);
        Button btnUpdate = findViewById(R.id.btnUpdate);
        Button logOut = findViewById(R.id.btnLogOut);

        logOut.setOnClickListener(v -> {
            String refreshToken = GlobalVariable.getRefreshToken(this);
            if (refreshToken != null && !refreshToken.isEmpty()) {
                OkHttpClient client = new OkHttpClient();
                MediaType JSON = MediaType.parse("application/json; charset=utf-8");

                JSONObject payload = new JSONObject();
                try {
                    payload.put("refreshToken", refreshToken);
                } catch (JSONException e) {
                    messageHelper.showError("Error when logout. Please connect to the support.");
                    return;
                }

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/logout")
                        .post(body)
                        .build();

                // Fire and forget (async)
                currentCall = client.newCall(request);
                currentCall.enqueue(new Callback() {
                    @Override
                    public void onFailure(@NonNull Call call, @NonNull IOException e) {
                        messageHelper.showError("Error when logout. Please connect to the support.");
                    }

                    @Override
                    public void onResponse(@NonNull Call call, @NonNull Response response) {
                        response.close();
                    }
                });
            }

            // Now clear local storage
            GlobalVariable.saveAuthenticateToken(this, "");
            GlobalVariable.saveUsername(this, "");
            GlobalVariable.saveRefreshToken(this, "");

            // Redirect
            Intent intent = new Intent(SettingsActivity.this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
        });

        btnUpdate.setOnClickListener(v -> checkForUpdate());

        fetchCamp();

        // Load saved preferences
        int savedPower = rfidReader.getPower();
        powerSeekBar.setProgress(savedPower);
        powerValueText.setText(String.valueOf(savedPower));

        powerSeekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                powerValueText.setText(String.valueOf(progress));
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
            }
        });

        saveButton.setOnClickListener(v -> {

            if(isNetworkAvailable()) {
                messageHelper.showError("You are offline and cannot continue with this process. Please check your internet connection.");
                return;
            }

            if (selectedCampId.isEmpty()) {
                messageHelper.showError("You not set camp. Please select an camp");
                return;
            }

            int selectedPower = powerSeekBar.getProgress();
            rfidReader.setPower(selectedPower);

            GlobalVariable.saveCamp(this, selectedCampId);

            // Show confirmation message
            runOnUiThread(() -> Toast.makeText(SettingsActivity.this, "The setting are save successful", Toast.LENGTH_SHORT).show());

            Intent intent = new Intent(SettingsActivity.this, MainActivity.class);
            startActivity(intent);
        });
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
    protected void onPause() {
        super.onPause();
        cancelAllCalls();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelAllCalls();
        if (rfidReader != null) {
            rfidReader.free();
        }
    }
}