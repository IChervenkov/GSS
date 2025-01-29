package com.example.nfcreader;

class BikeInfo {
    String bikeName;
    String soldierKey;

    BikeInfo(String bikeName, String soldierKey) {
        this.bikeName = bikeName;
        this.soldierKey = soldierKey;
    }

    @Override
    public String toString() {
        return bikeName + " ( " + soldierKey + " )";
    }
}

