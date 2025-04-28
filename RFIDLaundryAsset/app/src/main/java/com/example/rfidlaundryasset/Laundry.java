package com.example.rfidlaundryasset;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;

public class Laundry extends AppCompatActivity {

    @SuppressLint("MissingInflatedId")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_laundry);

        findViewById(R.id.buttonAddBag).setOnClickListener(v -> {
            Intent intent = new Intent(Laundry.this, AddBag.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonEditBag).setOnClickListener(v -> {
            Intent intent = new Intent(Laundry.this, EditBag.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonDeleteBag).setOnClickListener(v -> {
            Intent intent = new Intent(Laundry.this, DeleteBag.class);
            startActivity(intent);
        });
    }
}