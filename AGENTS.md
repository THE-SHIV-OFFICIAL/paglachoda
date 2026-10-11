# Project Decisions

- Keep the Android package in `moviebox-app` as a Capacitor shell for the hosted Movie Box website, because the Next.js site requires server APIs.
- Ship the generated APK from `filmora/public/downloads/moviebox.apk`, so `/api/apk` always provides a direct same-site download without Telegram fallback.
- Schedule release alerts natively with Android WorkManager against a narrow same-site TMDB feed, so checks remain battery-aware and API keys stay server-side.
- The live site is hosted on Railway at `https://betamovie.up.railway.app`; the APK launcher, native code and `siteConfig.url` default all point there, and `/api/apk` redirects with a relative Location because Railway's proxy hides the public origin.
- The "Download Movie" button uses a built-in file library (`src/lib/library.ts`, managed at `/admin/library`, stored in MongoDB); setting `INTERNAL_API_URL` switches `/api/movies/find` and `/api/stream/[id]` to an external API server instead.
