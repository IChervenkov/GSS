package com.example.nfcreader;

import android.app.Dialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import android.provider.Settings;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.Toast;
import android.content.pm.PackageInfo;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AlertDialog;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;

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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SettingsActivity extends AppCompatActivity {

    private Spinner campSpinner;
    private final OkHttpClient client = new OkHttpClient();
    private final Map<String, String> campMap = new HashMap<>();
    private String selectedCampId;
    private final ExecutorService executorService = Executors.newFixedThreadPool(3); // Adjust pool size as needed

    private void fetchCamp() {
        Dialog loadingDialog = new Dialog(SettingsActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {

            try {
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/getAllCamp")
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            JSONArray allCamp = new JSONArray(responseData);
                            List<String> campList = new ArrayList<>();
                            String curentCampId = GlobalVariable.getCamp(SettingsActivity.this);
                            int defaultIndex = 0; // Default selection index

                            for (int i = 0; i < allCamp.length(); i++) {
                                JSONObject campObject = allCamp.getJSONObject(i);
                                String id = campObject.getString("id");
                                String campName = campObject.getString("campname");

                                campList.add(campName);
                                campMap.put(campName, id);

                                if (id.equals(curentCampId)) {
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
                            Toast.makeText(SettingsActivity.this, "JSON parsing error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    runOnUiThread(() -> Toast.makeText(SettingsActivity.this, "Error fetching data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(SettingsActivity.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
            }
        });
    }

    private void checkForUpdate() {

        Dialog loadingDialog = new Dialog(SettingsActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {

            try {
                String baseUrl = getString(R.string.base_url);
                Request request = new Request.Builder()
                        .url(baseUrl + "/apk-bike-version")
                        .build();

                client.newCall(request).enqueue(new Callback() {
                    @Override
                    public void onFailure(@NonNull Call call, @NonNull IOException e) {
                        Toast.makeText(SettingsActivity.this, "Error when fetch version: " + e.getMessage(), Toast.LENGTH_SHORT).show();
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
                                    runOnUiThread(() -> promptUpdate(apkUrl));
                                } else {
                                    runOnUiThread(() ->
                                            Toast.makeText(SettingsActivity.this, "App is up to date", Toast.LENGTH_SHORT).show()
                                    );
                                }
                            } catch (Exception e) {
                                Toast.makeText(SettingsActivity.this, "JSON parsing error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                            }
                        }
                    }
                });
            }catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(SettingsActivity.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            } finally {
                runOnUiThread(loadingDialog::dismiss);
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
        String fileName = "update.apk";
        File file = new File(getExternalFilesDir(null), fileName);

        // Delete previous download if exists
        if (file.exists()) file.delete();

        String baseUrl = getString(R.string.base_url);
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(baseUrl + apkUrl));
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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        campSpinner = findViewById(R.id.campSpinner);
        Button saveButton = findViewById(R.id.saveButton);
        Button btnUpdate = findViewById(R.id.btnUpdate);

        btnUpdate.setOnClickListener(v -> checkForUpdate());

        fetchCamp();

        saveButton.setOnClickListener(v -> {

            if(selectedCampId.isEmpty()) {
                Toast.makeText(this, "Please select an camp", Toast.LENGTH_SHORT).show();
                return;
            }

            GlobalVariable.saveCamp(this, selectedCampId);

            // Show confirmation message
            Toast.makeText(SettingsActivity.this, "The setting are save successful", Toast.LENGTH_SHORT).show();

            Intent intent = new Intent(SettingsActivity.this, MainActivity.class);
            startActivity(intent);
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown(); // Shutdown executor properly
    }
}