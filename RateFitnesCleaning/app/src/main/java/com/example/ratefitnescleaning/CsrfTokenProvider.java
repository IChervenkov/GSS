package com.example.ratefitnescleaning;

public interface CsrfTokenProvider {
    String getCsrfToken();
    void refreshCsrfTokenSync() throws Exception;
}

