package com.example.rfidlaundryasset;

import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AddAsset extends AppCompatActivity {

    private OkHttpClient client; // Reuse a single OkHttpClient instance
//    private ThreadInventory threadInventory;
    private String epc;
    private Button submitButton;
    private EditText assetCodeText;
    private EditText assetNameText;
    private ArrayList<String> typeList = new ArrayList<>();
    private Map<String, String> typeIdMap = new HashMap<>();
    private String typeAssetId = "";
    private AutoCompleteTextView assetTypeTextList;
    private AutoCompleteTextView assetLocationText;
    private AutoCompleteTextView assetSubLocationText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_asset);

        // Initialize OkHttpClient (single instance)
        client = new OkHttpClient();
        submitButton = findViewById(R.id.addButton);
        assetCodeText = findViewById(R.id.assetCodeText);
        assetNameText = findViewById(R.id.assetNameText);
        assetTypeTextList = findViewById(R.id.assetTypeAutoCompleteTextView);
        assetLocationText = findViewById(R.id.assetLocationAutoCompleteTextView);
        assetSubLocationText = findViewById(R.id.assetSubLocationAutoCompleteTextView);

        // Fetch asset type from the server
        fetchAssetType();

        assetTypeTextList.setOnItemClickListener((parent, view, position, id) -> {
            String selectedTypeCode = (String) parent.getItemAtPosition(position);
            String selectedBag = typeIdMap.get(selectedTypeCode);

            if (selectedBag != null) {
                typeAssetId = selectedBag;
                assetTypeTextList.setText(selectedTypeCode);
            }
        });
    }

    private void fetchAssetType() {
        new Thread(() -> {
            try {

                MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                JSONObject payload = new JSONObject();

                payload.put("isValidCode", GlobalVariable.getVariable(this));

                RequestBody body = RequestBody.create(JSON, payload.toString());
                Request request = new Request.Builder()
                        .url("https://bunker.bg/assets/getAllType")
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful() && response.body() != null) {
                    final String responseData = response.body().string();
                    runOnUiThread(() -> {
                        try {
                            JSONArray responseJson = new JSONArray(responseData);
                            populateAssetTypeAutoComplete(responseJson);
                        } catch (JSONException e) {
                            Toast.makeText(AddAsset.this, "JSON parsing error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                } else {
                    runOnUiThread(() -> Toast.makeText(AddAsset.this, "Error fetching data", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(AddAsset.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }).start();
    }

    private void populateAssetTypeAutoComplete(JSONArray types) throws JSONException {

        typeList.clear();
        typeIdMap.clear();

        for (int i = 0; i < types.length(); i++) {
            JSONObject type = types.getJSONObject(i);
            String typeId = type.getString("id");
            String typeName = type.getString("name");

            typeList.add(typeName);
            typeIdMap.put(typeName, typeId);
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, typeList);
        assetTypeTextList.setAdapter(adapter);
    }
}