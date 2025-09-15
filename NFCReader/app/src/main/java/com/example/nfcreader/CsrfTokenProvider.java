package com.example.rfidlaundryreader;

public interface CsrfTokenProvider {
    String getCsrfToken();
    void refreshCsrfTokenSync() throws Exception;
}

