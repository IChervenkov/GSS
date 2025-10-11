package com.example.rfidlaundryasset;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

import org.json.JSONObject;

import java.io.IOException;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class JwtInterceptor implements Interceptor {

    private final Context context;

    // Lock and state for refresh handling
    private static final Object refreshLock = new Object();
    private static boolean isRefreshing = false;

    public JwtInterceptor(Context context) {
        this.context = context.getApplicationContext();
    }

    @NonNull
    @Override
    public Response intercept(@NonNull Chain chain) throws IOException {
        String jwtToken = GlobalVariable.getAuthenticateToken(context);

        Request originalRequest = chain.request();
        Request newRequest = originalRequest.newBuilder()
                .header("Authorization", "Bearer " + jwtToken)
                .build();

        Response response = chain.proceed(newRequest);

        if (response.code() == 401 || response.code() == 403) {
            response.close();

            synchronized (refreshLock) {
                if (!isRefreshing) {
                    isRefreshing = true;
                    try {
                        if (!performTokenRefresh()) {
                            forceLogout();
                            throw new IOException("Unauthorized - forced logout");
                        }
                    } finally {
                        isRefreshing = false;
                        refreshLock.notifyAll();
                    }
                } else {
                    try {
                        refreshLock.wait();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new IOException("Refresh interrupted", e);
                    }
                }
            }

            // Retry with new token
            String newAccessToken = GlobalVariable.getAuthenticateToken(context);
            Request retryRequest = originalRequest.newBuilder()
                    .header("Authorization", "Bearer " + newAccessToken)
                    .build();
            return chain.proceed(retryRequest);
        }

        return response;
    }

    private boolean performTokenRefresh() {
        String refreshToken = GlobalVariable.getRefreshToken(context);
        if (refreshToken == null || refreshToken.isEmpty()) {
            return false;
        }

        Response refreshResponse = null;
        try {
            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
            JSONObject payload = new JSONObject();
            payload.put("refreshToken", refreshToken);

            RequestBody body = RequestBody.create(payload.toString(), JSON);
            String baseUrl = context.getString(R.string.base_url);

            Request refreshRequest = new Request.Builder()
                    .url(baseUrl + "/token")
                    .post(body)
                    .tag("REFRESH_CALL")
                    .build();

            OkHttpClient client = new OkHttpClient.Builder()
                    .callTimeout(5, TimeUnit.SECONDS)
                    .connectTimeout(5, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build();

            Call refreshCall = client.newCall(refreshRequest);
            GlobalVariable.setRefreshCall(refreshCall);

            refreshResponse = refreshCall.execute();

            if (refreshResponse.isSuccessful()) {
                String responseData = Objects.requireNonNull(refreshResponse.body()).string();

                JSONObject jsonResponse = new JSONObject(responseData);
                String newAccessToken = jsonResponse.optString("accessToken", "");
                String newRefreshToken = jsonResponse.optString("refreshToken", "");

                if (!newAccessToken.isEmpty() && !newRefreshToken.isEmpty()) {
                    GlobalVariable.saveAuthenticateToken(context, newAccessToken);
                    GlobalVariable.saveRefreshToken(context, newRefreshToken);
                    return true;
                }
            }
        } catch (Exception e) {
            return false;
        } finally {
            if (refreshResponse != null) {
                refreshResponse.close();
            }
        }
        return false;
    }

    private void forceLogout() {
        Response logoutResponse = null;
        try {
            String refreshToken = GlobalVariable.getRefreshToken(context);
            MediaType JSON = MediaType.parse("application/json; charset=utf-8");
            JSONObject payload = new JSONObject();
            payload.put("refreshToken", refreshToken);

            RequestBody body = RequestBody.create(payload.toString(), JSON);
            String baseUrl = context.getString(R.string.base_url);

            Request logoutRequest = new Request.Builder()
                    .url(baseUrl + "/logout")
                    .post(body)
                    .tag("LOGOUT_CALL")
                    .build();

            OkHttpClient client = new OkHttpClient.Builder()
                    .callTimeout(5, TimeUnit.SECONDS)
                    .connectTimeout(5, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build();

            Call logoutCall = client.newCall(logoutRequest);
            GlobalVariable.setLogoutCall(logoutCall);

            logoutResponse = logoutCall.execute();
        } catch (Exception ignored) {
        } finally {
            if (logoutResponse != null) {
                logoutResponse.close();
            }
        }

        GlobalVariable.saveAuthenticateToken(context, "");
        GlobalVariable.saveUsername(context, "");
        GlobalVariable.saveRefreshToken(context, "");

        new Handler(Looper.getMainLooper()).post(() -> {
            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            context.startActivity(intent);
        });
    }
}