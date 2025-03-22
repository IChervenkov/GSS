package com.example.ratefitnescleaning;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.FormBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class Rated extends AppCompatActivity {

    private final OkHttpClient client = HttpClientSingleton.getInstance();
    private String selectedEmoji = null;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeoutRunnable = this::onTimeout;
    private ExecutorService executorService = Executors.newFixedThreadPool(3);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_rated);

        // Set emoji button click listeners
        findViewById(R.id.btnAngry).setOnClickListener(v -> onEmojiSelected("😡"));
        findViewById(R.id.btnNeutral).setOnClickListener(v -> onEmojiSelected("😐"));
        findViewById(R.id.btnVeryHappy).setOnClickListener(v -> onEmojiSelected("😄"));

        // Start the timeout timer (5 minutes)
        startTimeout();
    }

    private void onEmojiSelected(String emoji) {
        // Cancel the timeout if user selects an emoji
        cancelTimeout();

        // User ID and emoji are ready, now send to server
        selectedEmoji = emoji;
        sendEmojiData(selectedEmoji);
    }

    // Modify the sendEmojiData method to include modal and clear old data
    private void sendEmojiData(String emoji) {
        executorService.execute(() -> {
            try {
                // Prepare the request body
                RequestBody body = new FormBody.Builder()
                        .add("emoji", emoji)
                        .build();

                // Make the request to the server
                Request request = new Request.Builder()
                        .url("https://bunker.bg/sendEmojiData") // Replace with your endpoint
                        .post(body)
                        .build();

                Response response = client.newCall(request).execute();
                if (response.isSuccessful()) {
                    // Handle success
                    runOnUiThread(() -> {
                        showSuccessDialog("Thank you for your time, your response is important to us");
                        clearOldData();
                    });
                } else {
                    // Handle failure
                    runOnUiThread(() -> {
                        showErrorDialog("Failed to send your reaction. Try again");
                    });
                }
            } catch (IOException e) {
                e.printStackTrace();
                runOnUiThread(() -> {
                    showErrorDialog("Error: " + e.getMessage());
                });
            }
        });
    }

    // Method to show success dialog
    private void showSuccessDialog(String message) {
        new AlertDialog.Builder(Rated.this)
                .setTitle("Success")
                .setMessage(message)
                .setPositiveButton("OK", (dialog, which) -> {
                    // Do something when OK is clicked (if needed)
                    Intent intent = new Intent(Rated.this, MainActivity.class);
                    finish(); // Close MainActivity
                    startActivity(intent);
                })
                .setCancelable(false)
                .show();
    }

    // Method to show error dialog
    private void showErrorDialog(String message) {
        new AlertDialog.Builder(Rated.this)
                .setTitle("Error")
                .setMessage(message)
                .setPositiveButton("OK", (dialog, which) -> {
                    // Do something when OK is clicked (if needed)
                })
                .setCancelable(false)
                .show();
    }

    // Clear old data (clientId and selectedEmoji)
    private void clearOldData() {
        selectedEmoji = null;
    }

    // Start a timeout timer for 5 minutes (300000 milliseconds)
    private void startTimeout() {
        handler.postDelayed(timeoutRunnable, 60000);
    }

    // Cancel the timeout
    private void cancelTimeout() {
        handler.removeCallbacks(timeoutRunnable);
    }

    // Action to take when timeout occurs
    private void onTimeout() {
        Intent intent = new Intent(Rated.this, MainActivity.class);
        startActivity(intent);
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown();
        // Ensure the timeout is canceled when the activity is destroyed
        cancelTimeout();
    }
}