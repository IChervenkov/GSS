package com.example.ratefitnescleaning;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

import org.json.JSONObject;

import java.io.IOException;
import java.util.Objects;

import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class JwtInterceptor implements Interceptor {

    private final Context context;

    public JwtInterceptor(Context context) {
        this.context = context.getApplicationContext();
    }

    @NonNull
    @Override
    public Response intercept(@NonNull Chain chain) throws IOException {
        String jwtToken = GlobalVariable.getVariable(context);

        Request originalRequest = chain.request();
        Request newRequest = originalRequest.newBuilder()
                .header("Authorization", "Bearer " + jwtToken)
                .build();

        Response response = chain.proceed(newRequest);

        if (response.code() == 401 || response.code() == 403) {
            response.close();

            String refreshToken = GlobalVariable.getRefreshToken(context);
            if (refreshToken != null && !refreshToken.isEmpty()) {
                try {
                    // Build refresh request
                    MediaType JSON = MediaType.parse("application/json; charset=utf-8");
                    JSONObject payload = new JSONObject();
                    payload.put("refreshToken", refreshToken);

                    RequestBody body = RequestBody.create(payload.toString(), JSON);
                    String baseUrl = context.getString(R.string.base_url);
                    Request refreshRequest = new Request.Builder()
                            .url(baseUrl + "/token")
                            .post(body)
                            .build();

                    // ⚡ New client without interceptor to avoid infinite loop
                    OkHttpClient client = new OkHttpClient.Builder().build();
                    Response refreshResponse = client.newCall(refreshRequest).execute();

                    if (refreshResponse.isSuccessful()) {
                        String responseData = Objects.requireNonNull(refreshResponse.body()).string();
                        refreshResponse.close();

                        JSONObject jsonResponse = new JSONObject(responseData);
                        String newAccessToken = jsonResponse.optString("accessToken", "");

                        if (!newAccessToken.isEmpty()) {
                            GlobalVariable.saveVariable(context, newAccessToken);

                            // Retry original request with new token
                            Request retryRequest = originalRequest.newBuilder()
                                    .header("Authorization", "Bearer " + newAccessToken)
                                    .build();
                            return chain.proceed(retryRequest);
                        }
                    }
                    refreshResponse.close();

                    Request logoutRequest = new Request.Builder()
                            .url(baseUrl + "/logout")
                            .post(body)
                            .build();

                    OkHttpClient clientLogout = new OkHttpClient.Builder().build();
                    Response logoutResponse = clientLogout.newCall(logoutRequest).execute();
                    logoutResponse.close();

                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }

            GlobalVariable.saveVariable(context, "");
            GlobalVariable.saveUsername(context, "");
            GlobalVariable.saveRefreshToken(context, "");

            new Handler(Looper.getMainLooper()).post(() -> {
                Intent intent = new Intent(context, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                context.startActivity(intent);
            });
        }

        return response;
    }
}
