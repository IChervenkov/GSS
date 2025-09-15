package com.example.rfidlaundryasset;

public interface CsrfTokenProvider {
    String getCsrfToken();
    void refreshCsrfTokenSync() throws Exception;
}

