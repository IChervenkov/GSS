package com.example.nfcreader;

import android.app.Dialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SettingsActivity extends AppCompatActivity {

    private Spinner campSpinner;
    private Button saveButton;
    private OkHttpClient client;
    private Map<String, String> campMap = new HashMap<>();
    private String selectedCampId;
    private ExecutorService executorService = Executors.newFixedThreadPool(3); // Adjust pool size as needed

    private void fetchCamp() {
        Dialog loadingDialog = new Dialog(SettingsActivity.this);
        loadingDialog.setContentView(R.layout.progress_dialog);
        loadingDialog.setCancelable(false);
        loadingDialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        loadingDialog.show();

        executorService.execute(() -> {

            client = new OkHttpClient();

            try {
                Request request = new Request.Builder()
                        .url("https://bunker.bg/getAllCamp")
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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        campSpinner = findViewById(R.id.campSpinner);
        saveButton = findViewById(R.id.saveButton);

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