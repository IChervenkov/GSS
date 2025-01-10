package com.example.rfidlaundryasset;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class Assets extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_assets);

        findViewById(R.id.buttonAddAsset).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(Assets.this, AddAsset.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.buttonEditAsset).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(Assets.this, EditBag.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.buttonDeleteAsset).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(Assets.this, DeleteBag.class);
                startActivity(intent);
            }
        });
    }
}