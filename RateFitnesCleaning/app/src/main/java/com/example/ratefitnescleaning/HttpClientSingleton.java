package com.example.ratefitnescleaning;

import java.util.ArrayList;
import java.util.List;

import okhttp3.Cookie;
import okhttp3.CookieJar;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;

public class HttpClientSingleton {
    private static OkHttpClient instance;

    public static OkHttpClient getInstance() {
        if (instance == null) {
            instance = new OkHttpClient.Builder()
                    .cookieJar(new CookieJar() {
                        private final List<Cookie> cookieStore = new ArrayList<>();

                        @Override
                        public void saveFromResponse(HttpUrl url, List<Cookie> cookies) {
                            cookieStore.addAll(cookies);
                            for (Cookie cookie : cookies) {
                                System.out.println("Saved Cookie: " + cookie.toString());
                            }
                        }

                        @Override
                        public List<Cookie> loadForRequest(HttpUrl url) {
                            System.out.println("Loading cookies for request: " + url);
                            return cookieStore;
                        }
                    })
                    .build();
        }
        return instance;
    }
}
