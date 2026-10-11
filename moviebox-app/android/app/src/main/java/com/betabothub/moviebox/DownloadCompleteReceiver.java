package com.betabothub.moviebox;

import android.app.DownloadManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;

import androidx.core.app.NotificationCompat;

public class DownloadCompleteReceiver extends BroadcastReceiver {
    static final String PREFS = "moviebox_downloads";
    static final String ID_PREFIX = "download_";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
        long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
        if (id == -1) return;
        boolean ours = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean(ID_PREFIX + id, false);
        if (!ours) return;
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(ID_PREFIX + id)
                .apply();

        DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) return;

        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor == null || !cursor.moveToFirst()) return;
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status != DownloadManager.STATUS_SUCCESSFUL) return;

            String title = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE));
            String mime = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_MEDIA_TYPE));
            Uri uri = manager.getUriForDownloadedFile(id);
            if (uri == null || mime == null || !mime.startsWith("video/")) return;

            Intent play = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(uri, "video/*")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent playPending = PendingIntent.getActivity(
                    context,
                    (int) (id & 0x7fffffff),
                    Intent.createChooser(play, "Play with"),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationHelper.createChannels(context);
            NotificationCompat.Builder notification = new NotificationCompat.Builder(context, NotificationHelper.DOWNLOAD_CHANNEL)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle(title == null ? "Download complete" : title)
                    .setContentText("Saved to Downloads/MovieBox · Tap to play")
                    .setContentIntent(playPending)
                    .addAction(android.R.drawable.ic_media_play, "Play", playPending)
                    .setAutoCancel(true)
                    .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setColor(0xFFE50914);

            NotificationManager notificationManager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) notificationManager.notify((int) (id & 0x7fffffff), notification.build());
        } catch (Exception ignored) {
            // Android's own DownloadManager completion notification remains available.
        }
    }
}
