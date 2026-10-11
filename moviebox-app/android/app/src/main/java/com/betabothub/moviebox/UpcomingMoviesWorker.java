package com.betabothub.moviebox;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class UpcomingMoviesWorker extends Worker {
    private static final String FEED_URL = "https://betamovie.up.railway.app/api/app/upcoming";
    private static final String PREFS = "moviebox_release_alerts";
    private static final String SEEN_IDS = "seen_movie_ids";
    private static final int MAX_ALERTS_PER_RUN = 3;

    public UpcomingMoviesWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(FEED_URL).openConnection();
            connection.setConnectTimeout(12_000);
            connection.setReadTimeout(12_000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "MovieBoxApp/2.1");
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return Result.retry();

            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }

            JSONArray movies = new JSONObject(body.toString()).optJSONArray("movies");
            if (movies == null) return Result.success();

            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            Set<String> previous = prefs.getStringSet(SEEN_IDS, null);
            Set<String> current = new HashSet<>();
            int alertCount = 0;

            for (int index = 0; index < movies.length(); index++) {
                JSONObject movie = movies.optJSONObject(index);
                if (movie == null) continue;
                int id = movie.optInt("id", 0);
                if (id == 0) continue;
                String key = String.valueOf(id);
                current.add(key);

                if (previous != null && !previous.contains(key) && alertCount < MAX_ALERTS_PER_RUN && notificationsAllowed()) {
                    NotificationHelper.showRelease(
                            getApplicationContext(),
                            id,
                            movie.optString("title", "Upcoming movie"),
                            movie.optString("releaseDate", ""));
                    alertCount++;
                }
            }

            // Retain old IDs too, preventing a title from notifying twice if it temporarily leaves the feed.
            if (previous != null) current.addAll(previous);
            prefs.edit().putStringSet(SEEN_IDS, current).apply();
            return Result.success();
        } catch (Exception error) {
            return getRunAttemptCount() < 3 ? Result.retry() : Result.failure();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private boolean notificationsAllowed() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || ContextCompat.checkSelfPermission(getApplicationContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }
}
