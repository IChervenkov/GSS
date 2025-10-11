package com.example.rfidlaundryreader;

import android.app.Activity;
import android.app.AlertDialog;

public class DebounceMessageHelper {

    private final Activity activity;

    public DebounceMessageHelper(Activity activity) {
        this.activity = activity;
    }

    public void showError(String message) {
        showMessage("Error", message);
    }

    public void showMessage(String title, String message) {
        activity.runOnUiThread(() -> showPopupWindow(title, message));
    }

    private void showPopupWindow(String title, String message) {
        new AlertDialog.Builder(activity)
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton("OK", null)
                .show();
    }

}