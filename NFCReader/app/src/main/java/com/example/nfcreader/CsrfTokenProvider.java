package com.example.nfcreader;

public interface CsrfTokenProvider {
    String getCsrfToken();
    void refreshCsrfTokenSync() throws Exception;
}

