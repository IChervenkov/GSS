package com.example.rfidlaundryasset;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;

public class Assets extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_assets);

        findViewById(R.id.buttonAddAsset).setOnClickListener(v -> {
            Intent intent = new Intent(Assets.this, AddAsset.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonEditAsset).setOnClickListener(v -> {
            Intent intent = new Intent(Assets.this, EditAsset.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonDeleteAsset).setOnClickListener(v -> {
            Intent intent = new Intent(Assets.this, DeleteAsset.class);
            startActivity(intent);
        });
    }
}