# Roadmap

- [x] Keep the website layout unchanged while creating an Android-only visual system.
- [x] Replace the app Movies screen with Bollywood-first horizontal cinema shelves.
- [x] Remove K-Drama and KukuTV from app navigation; use Home, Movies, Series, and Shorts.
- [x] Apply the Cinema Red palette, Space Grotesk/DM Sans typography, and restrained glow effects.
- [x] Add Android DownloadManager progress/completion notifications and external-player playback.
- [x] Add daily TMDB upcoming alerts for popular movies with first-run deduplication.
- [x] Validate the Android project and package the updated clean source ZIP.
- [x] Replace all third-party iframe players with the built-in ad-free MOVIE BOX player (ads only if NEXT_PUBLIC_ENABLE_PLAYER_ADS=true).
- [x] Serve the APK directly with Android install headers (no browser-memory download).
- [x] Library lookup uses a database query instead of loading every record; playback streams redirect to the file host.
- [x] Remove the math question from the Android app launcher and the ad-blocker popup from the website.
- [x] Remove the Telegram (FtmPlyr) player; every title plays in the built-in player.
- [x] Library auto-detects any MongoDB movie collection/field layout (direct links or Telegram file_id).
- [x] Admin check: /api/admin/library-check shows which collection and fields are used.
- [x] Real database check: movies found in learningbots → Telegram_files (6,072 Telegram files); player plays them via TG_STREAM_URL.
- [x] Search several MongoDB clusters together (MONGODB_URI, MONGODB_URI_2 ...); skip audio files; detect series S01E01.
- [x] Download window lists the real files (quality + language + real size).
- [x] Prefer browser-friendly x264 files over HEVC/10-bit when both exist.
