package com.example.ratefitnescleaning;

import androidx.annotation.NonNull;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class CsrfInterceptor implements Interceptor {

    private final CsrfTokenProvider tokenProvider;

    public CsrfInterceptor(CsrfTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @NonNull
    @Override
    public Response intercept(Chain chain) throws IOException {
        Request originalRequest = chain.request();
        Response response = chain.proceed(originalRequest);

        if ("true".equalsIgnoreCase(response.header("X-Global-Error"))) {
            String responseBody = response.body() != null ? response.body().string() : "";

            try {
                JSONObject json = new JSONObject(responseBody);
                int statusCode = json.optInt("statusCode", -1);
                String message = json.optString("message", "");

                if (statusCode == 400 && message.toLowerCase().contains("security verification failed")) {
                    try {
                        tokenProvider.refreshCsrfTokenSync();
                    } catch (Exception e) {
                        throw new IOException("Failed to refresh CSRF token", e);
                    }

                    Request retriedRequest = originalRequest.newBuilder()
                            .header("X-CSRF-Token", tokenProvider.getCsrfToken())
                            .build();

                    response.close();
                    return chain.proceed(retriedRequest);
                } else {
                    return response.newBuilder()
                            .body(ResponseBody.create(responseBody, response.body() != null ? response.body().contentType() : null))
                            .build();
                }
            } catch (JSONException e) {
                return response;
            }
        }

        return response;
    }
}