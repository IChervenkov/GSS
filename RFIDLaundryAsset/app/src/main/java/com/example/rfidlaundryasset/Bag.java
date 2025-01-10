package com.example.rfidlaundryasset;

public class Bag {
    private String id;
    private String type;
    private String maxWash;

    public Bag(String id, String type, String maxWash) {
        this.id = id;
        this.type = type;
        this.maxWash = maxWash;
    }

    public String getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public String getMaxWash() {
        return maxWash;
    }
}

