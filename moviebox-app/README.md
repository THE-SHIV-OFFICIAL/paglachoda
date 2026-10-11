# MOVIE BOX — Android App (APK)

Ye Capacitor project MOVIE BOX ka Android app chalata hai. App ka charcoal-and-gold cinema
Cinema Red theme, horizontal movie shelves aur app navigation website ke design se alag hain. Online
hone par catalog website se aata hai. Offline launcher aur video player APK me bundled rehte
hain, isliye app bina internet ke bhi khulta hai aur phone par pehle se saved videos chalata hai.

- App name: **MOVIE BOX**
- Package id: `com.betabothub.moviebox`

---

## 1. Ek baar ki taiyari (computer par)

Install karo:

1. **Node.js 20+** — https://nodejs.org
2. **Java JDK 17** — https://adoptium.net
3. **Android Studio** — https://developer.android.com/studio
   (install ke waqt "Android SDK" + "Android SDK Platform-Tools" ko tick rakho)

---

## 2. Website ka address daalo

`www/index.html` kholo aur `SITE_URL` ko apni live MOVIE BOX website se set karo:

```js
var SITE_URL = "https://moviebox.com";
```

Internet available ho to launcher isi address par bhejta hai. Internet na ho ya site
unreachable ho to bundled offline player khul jata hai.

> Catalog browse karne aur naye movies download karne ke liye website/internet chahiye.
> Pehle se downloaded files chalane ke liye internet nahin chahiye.

---

## 3. App banao

Terminal me is folder me aao aur chalao:

```bash
npm install
npx cap sync android
```

Ab APK banao:

```bash
cd android
./gradlew assembleDebug        # Windows par: gradlew.bat assembleDebug
```

APK yahan milegi:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Yahi file phone me bhej kar install kar sakte ho (phone me "Unknown sources" allow karna hoga).

---

## 4. Play Store wali signed APK / AAB

```bash
keytool -genkey -v -keystore moviebox.keystore -alias moviebox -keyalg RSA -keysize 2048 -validity 10000
```

`android/key.properties` file banao:

```
storeFile=../../moviebox.keystore
storePassword=YOUR_PASSWORD
keyAlias=moviebox
keyPassword=YOUR_PASSWORD
```

Phir:

```bash
cd android
./gradlew assembleRelease      # signed APK
./gradlew bundleRelease        # Play Store ke liye .aab
```

---

## 5. Icon aur splash

1. `android/app/src/main/res/` me apna logo daalo, ya
2. Aasan tarika:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --android
```

Isse pehle `assets/icon.png` (1024x1024) aur `assets/splash.png` (2732x2732) rakh do.

---

## 6. Video, downloads aur audio preference

- Streaming source preference: **Hindi → English → Original → Backup**. App pehle Hindi source
  kholta hai aur manually chuna hua source yaad rakhta hai. Source providers alag-alag audio
  tracks dete hain; final track ki availability source par depend karti hai.
- Offline file: Downloads screen me **Play from device** dabao aur `Download/MovieBox` ya kisi
  aur folder se video chuno. Common video formats app ke andar chalenge; unsupported codec ko
  Android ya alag player ki zarurat ho sakti hai.
- Bina internet ke app kholne par offline player dikhai deta hai. **Choose a video** se
  `Downloads/MovieBox` folder ki pehle se downloaded movie chuno; video phone par hi rehta hai.
- Android app mein alag Cinema Red styling, horizontal category shelves, aur Home / Movies /
  Series / Shorts bottom navigation hai. Website ka styling web users ke liye unchanged hai.
- Downloaded file Android ke `Download/MovieBox` folder me rehti hai, isliye MX Player/VLC se
  bhi khol sakte ho. Android picker permission sirf chuni hui file ke liye maangta hai.

## 7. Kuch cheezein yaad rakhna

- **Download**: movie download Android ke notification bar me progress dikhata hai aur phone ke
  `Download/MovieBox` folder me save hota hai.
- **Completion alert**: download complete notification par tap karke video MX Player, VLC,
  ya kisi bhi installed player me offline khol sakte ho.
- **Upcoming alerts**: app roz ek battery-friendly background check karta hai aur TMDB ke popular
  upcoming titles me naya title milne par notification deta hai; pehli sync silent hoti hai.
- **Fullscreen player**: pehle se on hai, phone ghumate hi video full screen ho jayega.
- **Back button**: Android ka back button website ke andar peeche jata hai; fullscreen se pehle
  fullscreen player band hota hai.
- Hosted website ka change deploy hone ke baad online app me dikhega. Offline launcher/player
  ya native Android code badalne par `npx cap sync android` karke APK dobara build karo.

---

Made for **MOVIE BOX** — by Beta Bot Hub · https://t.me/betabot_hub

## Human verification (number addition)

- App ke start screen (`www/index.html`) par ek chhota sa addition sawaal hai
  (jaise `4 + 7 = ?`). Sahi jawab dene par hi "Continue to MOVIE BOX" button
  chalu hota hai. `SITE_URL` ko apne domain se badal dena (`www/index.html` me).
- Website par bhi same verification hai: Gmail login code bhejne se pehle aur
  Fast download shuru karne se pehle. Website wala check server par verify hota
  hai, isliye use bypass nahi kiya ja sakta.

---

## App playback aur Downloads screen

### 1) Download feature (app ke andar)
Website ke har "Fast download" link ab app ke andar hi download hote hain — Android ka
DownloadManager use hota hai, notification me progress dikhta hai, aur file
`Downloads/MovieBox/` folder me save hoti hai.

Setup:
1. Android project aur updated `MainActivity.java` ZIP me pehle se maujood hain.
2. Agar native plugin badla ho to `npx cap sync android` chalao.
3. `npm run build:apk` chala kar nayi debug APK banao.

### 2) App me local video chalana
Downloads screen ka **Play from device** button Android file picker kholta hai. `MainActivity.java`
WebView chooser ko handle karta hai. Internet na ho tab bhi local offline player open hota hai;
`Download/MovieBox` se file chuno aur app ke andar play karo.

### 3) History On/Off
App ki start screen par "Watch history on" switch hai. Off karne par site ko
`?history=off` ke saath khola jata hai aur kuch bhi save nahi hota.
Website par bhi yeh switch **Account** page me milta hai (history clear ka button bhi).

### 4) Fullscreen
- Start screen par "Open in fullscreen" option.
- Player ke niche "Fullscreen" button (website + app dono me).
- Android me fullscreen par video apne aap landscape aur immersive ho jata hai.

