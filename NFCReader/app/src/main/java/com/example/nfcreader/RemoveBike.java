package com.example.nfcreader;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.JavaNetCookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class RemoveBike extends AppCompatActivity implements CsrfTokenProvider {

    private boolean isValidCode;
    private String campId;
    private String username;
    private NfcAdapter nfcAdapter;
    private AutoCompleteTextView codeTextList;
    private String nfcContent = "";
    private final Map<String, String> codeInfoMap = new HashMap<>();
    private final ArrayList<String> codeList = new ArrayList<>();
    private final CookieManager cookieManager = new CookieManager();
    private final OkHttpClient client = new OkHttpClient.Builder()
            .addInterceptor(new CsrfInterceptor(this))
            .cookieJar(new JavaNetCookieJar(cookieManager))
            .build();
    private String csrfToken = null;

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
            runOnUiThread(() -> showPopupWindow("Token error. Please restart the app and try again."));
        }
    }

    private void fetchCsrfToken(Runnable onSuccess) {

        if (isNetworkAvailable()) {
            return;
        }

        Dialog loadingDialog = new Dialog(RemoveBike.this);
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
                runOnUiThread(loadingDialog::dismiss);
                runOnUiThread(() -> showPopupWindow("Token error. Please connect to the support."));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    String responseBody = response.body().string();
                    JSONObject jsonObject = new JSONObject(responseBody);

                    csrfToken = jsonObject.getString("csrfToken");
                    if (onSuccess != null)
                        runOnUiThread(onSuccess);

                } catch (JSONException e) {
                    runOnUiThread(() -> showPopupWindow("Token error. Please connect to the support."));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_remove_bike);

        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        isValidCode = GlobalVariable.getVariable(this);
        campId = GlobalVariable.getCamp(this);
        username = GlobalVariable.getUsername(this);

        codeTextList = findViewById(R.id.codeTextList);
        Button submitButton = findViewById(R.id.removeButton);
        Button submitHelmetButton = findViewById(R.id.removeHelmetButton);
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        if (nfcAdapter == null) {
            showPopupWindow("NFC is not available on this device.");
            finish();
            return;
        }

        fetchCsrfToken(null);

        fetchAllBicycles();

        fetchAllHelmets();

        // Handle NFC intents
        handleIntent(getIntent());

        // Handle the submit button click
        submitButton.setOnClickListener(v -> {

            if (nfcContent.isEmpty()) {
                showPopupWindow("Bike code not detected. Please scans the code first!");
                return;
            }

            // Show a confirmation dialog
            new AlertDialog.Builder(RemoveBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to remove this bike?")
                    .setPositiveButton("Yes", (dialog, which) -> {
                        sendDataToServer(nfcContent);  // Proceed with submission
                    })
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });

        submitHelmetButton.setOnClickListener(v -> {

            if (nfcContent.isEmpty()) {
                showPopupWindow("Helmet code not detected. Please scans the code first!");
                return;
            }
            // Show a confirmation dialog
            new AlertDialog.Builder(RemoveBike.this)
                    .setTitle("Attention")
                    .setMessage("Are you sure you want to remove this helmet?")
                    .setPositiveButton("Yes", (dialog, which) -> {
                        sendHelmetDataToServer(nfcContent);  // Proceed with submission
                    })
                    .setNegativeButton("No", (dialog, which) -> {
                        // Do nothing, just dismiss the dialog
                        dialog.dismiss();
                    })
                    .show();
        });

    }

    @Override
    protected void onResume() {
        super.onResume();

        fetchCsrfToken(null);

        Intent intent = new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_MUTABLE);
        IntentFilter[] intentFilters = new IntentFilter[]{};
        nfcAdapter.enableForegroundDispatch(this, pendingIntent, intentFilters, null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        nfcAdapter.disableForegroundDispatch(this);
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    @RequiresApi(api = Build.VERSION_CODES.TIRAMISU)
    private void handleIntent(Intent intent) {
        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag.class);
        if (tag != null) {
            // Get the NFC ID (UID)
            byte[] tagId = tag.getId();
            String nfcId = bytesToHex(tagId);
            nfcContent = nfcId;

            // Call the server with the NFC data
            readBikeDataFromServer(nfcId);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    private void fetchAllBicycles() {

        if (isNetworkAvailable()) {
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RemoveBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/bikes?isValidCode=" + isValidCode + "&campId=" + campId)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when fetch bike data. Please connect to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    final String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject responseJson = new JSONObject(responseData);
                        String errorMessage = responseJson.optString("message", "Error when fetch bike data.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    JSONArray bicycles = new JSONArray(responseData);
                    runOnUiThread(() -> populateBikeAutoComplete(bicycles));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when fetch bike data. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void fetchAllHelmets() {

        if (isNetworkAvailable()) {
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RemoveBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        String baseUrl = getString(R.string.base_url);

        Request request = new Request.Builder()
                .url(baseUrl + "/helmets?isValidCode=" + isValidCode + "&campId=" + campId)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(() -> showPopupWindow("Error when fetch helmets data. Please connect to the support!"));
                runOnUiThread(loadingDialog::dismiss);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {

                    final String responseData = response.body().string();

                    if (!response.isSuccessful()) {
                        JSONObject responseJson = new JSONObject(responseData);
                        String errorMessage = responseJson.optString("message", "Error when fetch helmets data.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    JSONArray helmets = new JSONArray(responseData);
                    runOnUiThread(() -> populateHelmetAutoComplete(helmets));

                } catch (Exception e) {
                    runOnUiThread(() -> showPopupWindow("Error when fetch helmets data. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void populateBikeAutoComplete(JSONArray bicycles) {

        try {

            for (int i = 0; i < bicycles.length(); i++) {
                JSONObject bike = bicycles.getJSONObject(i);
                String bikeId = bike.getString("id");
                String bikeCode = bike.getString("name");
                String bikeStatus = bike.getString("status");

                if(!bikeStatus.equals("Available"))
                    continue;

                codeList.add(bikeCode);
                codeInfoMap.put(bikeCode, bikeId);
            }

            ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, codeList);
            codeTextList.setAdapter(adapter);

            codeTextList.setOnItemClickListener((parent, view, position, id) -> {
                String selectedBikeCode = (String) parent.getItemAtPosition(position);
                nfcContent = codeInfoMap.get(selectedBikeCode);
                codeTextList.setText(selectedBikeCode);
            });
        } catch (JSONException e) {
            runOnUiThread(() -> showPopupWindow("Invalid bike data from server!"));
        }
    }

    private void populateHelmetAutoComplete(JSONArray helmets) {

        try {

            for (int i = 0; i < helmets.length(); i++) {
                JSONObject helmet = helmets.getJSONObject(i);
                String helmetId = helmet.getString("id");
                String helmetCode = helmet.getString("name");
                String helmetStatus = helmet.getString("code");

                if(!helmetStatus.toLowerCase().contains("available"))
                    continue;

                codeList.add(helmetCode);
                codeInfoMap.put(helmetCode, helmetId);
            }

            ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, codeList);
            codeTextList.setAdapter(adapter);

            codeTextList.setOnItemClickListener((parent, view, position, id) -> {
                String selectedBikeCode = (String) parent.getItemAtPosition(position);
                nfcContent = codeInfoMap.get(selectedBikeCode);
                codeTextList.setText(selectedBikeCode);
            });
        } catch (JSONException e) {
            runOnUiThread(() -> showPopupWindow("Invalid bike data from server!"));
        }
    }

    private void readBikeDataFromServer(String nfcData) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RemoveBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        // Define the request
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/readBikeNfc?nfcData=" + nfcData + "&isValidCode=" + isValidCode)  // Replace with your server URL
                .build();

        // Make the network call asynchronously
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                runOnUiThread(() -> showPopupWindow("Failed to read bike data. Please connect to the support!"));
            }

            @SuppressLint("SetTextI18n")
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    // Parse the response if it's JSON
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    final String bikeName = jsonResponse.getString("fullBikeName");
                    final String helmetName = jsonResponse.getString("fullHelmetName");

                    if (!bikeName.isEmpty())
                        runOnUiThread(() -> codeTextList.setText(bikeName));
                    else if (!helmetName.isEmpty())
                        runOnUiThread(() -> codeTextList.setText(helmetName));
                    else
                        runOnUiThread(() -> codeTextList.setText(""));

                } catch (JSONException e) {
                    runOnUiThread(() -> showPopupWindow("Failed to read bike data. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss); // Dismiss the dialog
                }
            }
        });
    }

    private void sendDataToServer(String nfcContent) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performSendData(nfcContent));
        } else {
            performSendData(nfcContent);
        }
    }

    private void performSendData(String nfcContent) {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RemoveBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();

        try {
            jsonData.put("bikeRemoveId", nfcContent);
            jsonData.put("username", username);
            jsonData.put("isValidCode", isValidCode);
        } catch (JSONException e) {
            runOnUiThread(loadingDialog::dismiss);
            runOnUiThread(() -> showPopupWindow("Error creating request data. Please contact support!"));
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/bicycles/removeBike")
                .addHeader("X-CSRF-Token", csrfToken)
                .delete(body)
                .build();

        // Use enqueue for the asynchronous call
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                runOnUiThread(() -> showPopupWindow("Failed to remove bike. Please contact with the support!"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    // Parse the response if it's JSON
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    String message = jsonResponse.optString("message", "Bike removed successfully.");

                    runOnUiThread(() -> {
                        Toast.makeText(RemoveBike.this, message, Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(RemoveBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });

                } catch (JSONException e) {
                    runOnUiThread(() -> showPopupWindow("Error parsing response. Please contact with the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss);
                }
            }
        });
    }

    private void sendHelmetDataToServer(String nfcContent) {

        if (isNetworkAvailable()) {
            runOnUiThread(() -> showPopupWindow("You are offline and cannot continue with this process. Please check your internet connection."));
            return;
        }

        if (csrfToken == null || csrfToken.isEmpty()) {
            fetchCsrfToken(() -> performSendHelmetData(nfcContent));
        } else {
            performSendHelmetData(nfcContent);
        }
    }

    private void performSendHelmetData(String nfcContent) {
        // Create and show the loading dialog
        Dialog loadingDialog = new Dialog(RemoveBike.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false); // Prevent dismissal
        Objects.requireNonNull(loadingDialog.getWindow()).setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        JSONObject jsonData = new JSONObject();
        try {
            jsonData.put("code", nfcContent);
            jsonData.put("username", username);
            jsonData.put("isValidCode", isValidCode);
        } catch (JSONException e) {
            runOnUiThread(loadingDialog::dismiss);
            runOnUiThread(() -> showPopupWindow("Error creating request data. Please contact support!"));
            return;
        }

        RequestBody body = RequestBody.create(jsonData.toString(), JSON);
        String baseUrl = getString(R.string.base_url);
        Request request = new Request.Builder()
                .url(baseUrl + "/bicycles/removeHelmet")
                .addHeader("X-CSRF-Token", csrfToken)
                .delete(body)
                .build();

        // Use enqueue for the asynchronous call
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                runOnUiThread(loadingDialog::dismiss);
                runOnUiThread(() -> showPopupWindow("Failed to remove helmet. Please connect to the support!"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {

                try {
                    // Parse the response if it's JSON
                    String responseData = Objects.requireNonNull(response.body()).string();
                    JSONObject jsonResponse = new JSONObject(responseData);

                    if (!response.isSuccessful()) {
                        String errorMessage = jsonResponse.optString("message", "Server error occurred.");
                        runOnUiThread(() -> showPopupWindow(errorMessage));
                        return;
                    }

                    String message = jsonResponse.optString("message", "Helmet removed successfully.");

                    runOnUiThread(() -> {
                        Toast.makeText(RemoveBike.this, message, Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(RemoveBike.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        finish();
                    });

                } catch (JSONException e) {
                    runOnUiThread(() -> showPopupWindow("Error parsing response. Please connect to the support!"));
                } finally {
                    runOnUiThread(loadingDialog::dismiss); // Dismiss the dialog
                }
            }
        });
    }

    private void showPopupWindow(String message) {
        android.app.AlertDialog.Builder builder = new android.app.AlertDialog.Builder(this);
        builder.setTitle("Error");
        builder.setMessage(message);
        builder.setPositiveButton("OK", (dialog, which) -> {
            // Reset the flag once the error dialog is clos
        });
        builder.show();
    }
}