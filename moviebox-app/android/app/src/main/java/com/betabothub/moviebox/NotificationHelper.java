package com.betabothub.moviebox;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

final class NotificationHelper {
    static final String RELEASE_CHANNEL = "movie_releases";
    static final String DOWNLOAD_CHANNEL = "movie_downloads";

    private NotificationHelper() { }

    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel releases = new NotificationChannel(
                RELEASE_CHANNEL,
                "Upcoming movies",
                NotificationManager.IMPORTANCE_DEFAULT);
        releases.setDescription("New and popular upcoming movie alerts");
        manager.createNotificationChannel(releases);

        NotificationChannel downloads = new NotificationChannel(
                DOWNLOAD_CHANNEL,
                "Downloads",
                NotificationManager.IMPORTANCE_DEFAULT);
        downloads.setDescription("Completed MOVIE BOX video downloads");
        manager.createNotificationChannel(downloads);
    }

    static void showRelease(Context context, int movieId, String title, String releaseDate) {
        Intent open = new Intent(context, MainActivity.class)
                .putExtra(MainActivity.EXTRA_OPEN_URL, MainActivity.MOVIES_URL)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context,
                movieId,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String detail = releaseDate == null || releaseDate.isEmpty()
                ? "A new popular movie is coming soon"
                : "Coming " + releaseDate;
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, RELEASE_CHANNEL)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title)
                .setContentText(detail)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(detail + " · Tap to explore Movies"))
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setColor(0xFFE50914);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(20_000 + movieId, notification.build());
    }
}
