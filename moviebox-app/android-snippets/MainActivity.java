package com.betabothub.moviebox;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.webkit.JavascriptInterface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.Toast;

import android.os.Message;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * MOVIE BOX — Android shell.
 *
 * Adds native media support on top of the default Capacitor activity:
 *  1. Real in-app downloads (Android DownloadManager -> Downloads folder + notification).
 *  2. In-app video playback (media plays inside the app, no external player, no autoplay block).
 *  3. Device video picking for the offline player.
 *  4. Native HTML5 fullscreen (landscape, immersive, works for the player).
 *
 * Native activity already used by this Capacitor Android project.
 */
public class MainActivity extends BridgeActivity {

    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout fullscreenContainer;
    private static final int VIDEO_PICKER_REQUEST = 4102;
    private ValueCallback<Uri[]> pendingFilePathCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        // --- in-app playback ---
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Let the website know it is running inside the real app.
        settings.setUserAgentString(settings.getUserAgentString() + " MovieBoxApp/2.0");

        // --- JS bridge: window.MovieBoxNative -----------------------------
        webView.addJavascriptInterface(new MovieBoxBridge(), "MovieBoxNative");

        // Open a finished download automatically (APK installer / video player).
        registerDownloadWatcher();

        // --- Ad blocking (real, native) ---
        // Popups opened by the video players are caught here before Android
        // shows them, so they never open. No iframe sandbox needed.
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        installAdBlockingClient();

        // --- downloads inside the app ---
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) request.addRequestHeader("Cookie", cookies);
                request.setTitle(fileName);
                request.setDescription("Downloading from MOVIE BOX");
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "MovieBox/" + fileName);

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) dm.enqueue(request);
                Toast.makeText(this, "Download started: " + fileName, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show();
            }
        });

        // --- HTML5 fullscreen ---
        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // Every new window / tab from the page or a player iframe lands here.
                // Load it in a throwaway WebView only to read its URL: trusted links
                // (Telegram, Play Store...) open outside, everything else is an ad.
                WebView probe = new WebView(MainActivity.this);
                probe.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                        Uri u = req.getUrl();
                        if (isTrustedExternal(u)) openExternal(u);
                        v.destroy();
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(probe);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (pendingFilePathCallback != null) {
                    pendingFilePathCallback.onReceiveValue(null);
                }
                pendingFilePathCallback = filePathCallback;

                Intent chooseVideo = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                chooseVideo.addCategory(Intent.CATEGORY_OPENABLE);
                chooseVideo.setType("video/*");
                chooseVideo.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(
                            Intent.createChooser(chooseVideo, "Choose a video"),
                            VIDEO_PICKER_REQUEST);
                    return true;
                } catch (Exception e) {
                    pendingFilePathCallback = null;
                    filePathCallback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "Could not open video picker", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                fullscreenContainer = new FrameLayout(MainActivity.this);
                fullscreenContainer.setBackgroundColor(0xFF000000);
                fullscreenContainer.addView(customView, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                addContentView(fullscreenContainer, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                hideCustomView();
            }
        });
    }

    // =====================================================================
    // Ad blocking
    // =====================================================================
    /** Sites the app itself may show full-screen. Add your own domain here. */
    private static final String[] APP_HOSTS = {
            "localhost", "betamovie.up.railway.app", "up.railway.app", "moviebox.com",
    };
    /** Links allowed to open outside the app (Telegram etc). */
    private static final String[] TRUSTED_EXTERNAL = {
            "t.me", "telegram.me", "telegram.org", "play.google.com", "youtube.com", "youtu.be",
            "chromewebstore.google.com", "adguard.com", "adguard-dns.io",
    };
    /** Requests to these ad networks get an empty response. */
    private static final String[] AD_HOSTS = {
            "popads", "popcash", "propellerads", "adsterra", "onclickads", "clickadu",
            "hilltopads", "exoclick", "exdynsrv", "juicyads", "trafficjunky", "mgid", "adnxs",
            "doubleclick", "googlesyndication", "googleadservices", "revcontent", "bidgear",
            "monetag", "zeropark", "smartadserver", "popunder", "a-ads.com", "adcash",
            "acscdn", "highperformanceformat", "profitablecpmrate", "effectivegatecpm",
            "displayvertising", "realsrv", "tsyndicate",
    };

    private static boolean hostMatches(String host, String[] list) {
        if (host == null) return false;
        host = host.toLowerCase();
        for (String h : list) {
            if (host.equals(h) || host.endsWith("." + h)) return true;
        }
        return false;
    }

    private static boolean isAdHost(String host) {
        if (host == null) return false;
        host = host.toLowerCase();
        for (String h : AD_HOSTS) if (host.contains(h)) return true;
        return false;
    }

    private boolean isTrustedExternal(Uri u) {
        return u != null && hostMatches(u.getHost(), TRUSTED_EXTERNAL);
    }

    private void openExternal(Uri u) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception ignored) { }
    }

    private void installAdBlockingClient() {
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (request.isForMainFrame() && (scheme.equals("http") || scheme.equals("https"))) {
                    if (isTrustedExternal(u)) { openExternal(u); return true; }
                    // A player trying to send the whole app to an ad page: stop it.
                    if (!hostMatches(u.getHost(), APP_HOSTS)) return true;
                }
                if (request.isForMainFrame() && !scheme.equals("http") && !scheme.equals("https")
                        && !scheme.equals("file") && !scheme.equals("about")) {
                    // intent://, market:// style ad jumps.
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (isAdHost(request.getUrl().getHost())) {
                    return new WebResourceResponse("text/plain", "utf-8",
                            new ByteArrayInputStream(new byte[0]));
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }

    private void hideCustomView() {
        if (fullscreenContainer != null && fullscreenContainer.getParent() instanceof ViewGroup) {
            ((ViewGroup) fullscreenContainer.getParent()).removeView(fullscreenContainer);
        }
        fullscreenContainer = null;
        customView = null;
        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_USER);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != VIDEO_PICKER_REQUEST) return;

        if (pendingFilePathCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            }
            pendingFilePathCallback.onReceiveValue(results);
            pendingFilePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            hideCustomView();
            return;
        }
        super.onBackPressed();
    }

    // =====================================================================
    // Native bridge used by the website (lib/native.ts)
    // Saves every file into the phone's own storage: Download/MovieBox
    // =====================================================================
    public class MovieBoxBridge {

        @JavascriptInterface
        public void download(String url, String fileName, String mimeType) {
            enqueueDownload(url, fileName, mimeType);
        }

        @JavascriptInterface
        public void download(String url, String fileName) {
            enqueueDownload(url, fileName, "video/mp4");
        }

        @JavascriptInterface
        public void openFile(String fileName) {
            try {
                java.io.File file = new java.io.File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                        "MovieBox/" + fileName);
                if (!file.exists()) {
                    toast("File not found in Download/MovieBox");
                    return;
                }
                Uri uri = androidx.core.content.FileProvider.getUriForFile(
                        MainActivity.this, getPackageName() + ".fileprovider", file);
                Intent view = new Intent(Intent.ACTION_VIEW);
                view.setDataAndType(uri, fileName.endsWith(".apk")
                        ? "application/vnd.android.package-archive" : "video/*");
                view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(view);
            } catch (Exception e) {
                toast("Could not open the file");
            }
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public String version() {
            return "2.0";
        }
    }

    private void enqueueDownload(String url, String fileName, String mimeType) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestPermissions(new String[]{ android.Manifest.permission.POST_NOTIFICATIONS }, 55);
            }
            String safeName = (fileName == null || fileName.trim().isEmpty())
                    ? URLUtil.guessFileName(url, null, mimeType) : fileName.replaceAll("[\\\\/:*?\"<>|]+", " ").trim();

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimeType);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            request.addRequestHeader("User-Agent", getBridge().getWebView().getSettings().getUserAgentString());
            request.setTitle(safeName);
            request.setDescription("MOVIE BOX download");
            request.allowScanningByMediaScanner();
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            // Phone storage — visible in any file manager and playable in MX Player / VLC.
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "MovieBox/" + safeName);

            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) dm.enqueue(request);
            runOnUiThread(() -> Toast.makeText(this, "Saving to Download/MovieBox", Toast.LENGTH_SHORT).show());
        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show());
        }
    }

    /** When a download finishes, offer to open/install it right away. */
    private void registerDownloadWatcher() {
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id == -1) return;
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm == null) return;
                try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(id))) {
                    if (c == null || !c.moveToFirst()) return;
                    int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    if (status != DownloadManager.STATUS_SUCCESSFUL) return;
                    String local = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
                    String mime = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_MEDIA_TYPE));
                    if (local == null) return;
                    Uri fileUri = Uri.parse(local);
                    if (mime != null && mime.contains("package-archive")) {
                        // APK: open the Android installer.
                        java.io.File apk = new java.io.File(fileUri.getPath());
                        Uri shareUri = androidx.core.content.FileProvider.getUriForFile(
                                MainActivity.this, getPackageName() + ".fileprovider", apk);
                        Intent install = new Intent(Intent.ACTION_VIEW);
                        install.setDataAndType(shareUri, "application/vnd.android.package-archive");
                        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(install);
                    } else {
                        Toast.makeText(MainActivity.this, "Saved in Download/MovieBox", Toast.LENGTH_LONG).show();
                    }
                } catch (Exception ignored) {
                }
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(receiver, filter);
        }
    }
}
