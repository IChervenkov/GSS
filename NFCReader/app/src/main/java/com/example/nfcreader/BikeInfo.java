package com.example.nfcreader;

import androidx.annotation.NonNull;

class BikeInfo {
    String bikeName;
    String soldierKey;

    BikeInfo(String bikeName, String soldierKey) {
        this.bikeName = bikeName;
        this.soldierKey = soldierKey;
    }

    @NonNull
    @Override
    public String toString() {
        return bikeName + " ( " + soldierKey + " )";
    }
}

