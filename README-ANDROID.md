# Running this on Android — testing only

Two options, depending on how fast you need it and what's installed on your machine.

## NetHunter users — read this first

If you're running this inside Kali NetHunter, your "server" and your
"test phone" are the same physical device — NetHunter's chroot shares
the Android host's network stack rather than being a separate machine on
the Wi-Fi. That changes the advice below:

- **You almost certainly don't need LAN binding at all.** Just run
  `pnpm dev` (plain, no `dev:lan`) inside the NetHunter chroot, then open
  the phone's **regular Android Chrome app** (not a browser inside the
  chroot) and go to `http://localhost:5173`. Since the chroot shares the
  host's network namespace, this normally just works — no IP address,
  no `VITE_DEV_HOST`, nothing to configure.
- **Don't use `pnpm dev:lan`** or set `VITE_DEV_HOST=0.0.0.0` — that's
  still a wildcard bind, which still makes Vite enumerate every network
  interface, which is exactly what crashes with `EACCES` on NetHunter
  (wireless-injection/monitor-mode interfaces and similar are common
  culprits). `0.0.0.0` doesn't avoid the bug, only binding to one
  specific real IP does.
- **The Capacitor/APK path is a stretch here.** Android Studio and a full
  Gradle build are heavy for a phone-hosted ARM64 chroot and aren't
  really what NetHunter is set up for. If you have a separate laptop/
  desktop, build the APK there instead — you can still transfer the
  finished `.apk` to your NetHunter phone afterward and install it; only
  the *build* step benefits from a real machine, not the install.
- If you genuinely need a **second, separate** device to reach the dev
  server (not the NetHunter phone itself), you'll need
  `VITE_DEV_HOST=<the-actual-LAN-IP>` — a specific address, never the
  wildcard — since that's what avoids the broken enumeration.

---

## Troubleshooting

**`uv_interface_addresses returned Unknown system error 13` when running `pnpm dev`**

Known issue on Kali (and some VM/WSL setups) — Vite crashes trying to
enumerate network interfaces to print its "Network:" URL banner, and a
libuv syscall fails on certain virtual/tunnel interfaces (VPN, monitor
mode, Docker bridges — common on a pentesting distro). Fix: tell Vite to
bind to one specific IP instead of the wildcard, which skips that
enumeration entirely.

```bash
ip addr show      # find your LAN IP, e.g. 192.168.1.42
VITE_DEV_HOST=192.168.1.42 pnpm dev
```

If you'd rather not type that every time, add it to a `.env` file in
`apps/web` (not committed) or export it in your shell profile.

---

## Option A — PWA install (5 minutes, no Android Studio needed)

Works today, right now, with nothing new installed.

1. Find your computer's LAN IP (not `localhost`):
   - Mac/Linux: `ifconfig | grep "inet "`
   - Windows: `ipconfig`
   - Look for something like `192.168.1.x` or `10.0.0.x`

2. Make sure your phone is on the **same Wi-Fi network** as your computer.

3. Start everything as usual: `pnpm dev` (api), `pnpm worker`, `pnpm dev` (web).

4. On your phone's Chrome, go to `http://<your-computer-LAN-IP>:5173`
   (e.g. `http://192.168.1.42:5173`). Log in and confirm it works normally first.

5. Tap Chrome's menu (⋮) → **"Add to Home Screen"** (or Chrome will
   prompt you automatically after a bit of use). It installs as a real
   app icon, opens full-screen with no browser chrome, and behaves like
   a native app for everything except push notifications/offline mode.

**Why this works:** the app now has a web manifest, icons, and a service
worker (`public/manifest.webmanifest`, `public/sw.js`) — Chrome only
offers "Add to Home Screen" as a real install prompt when those exist.

**Limitation:** your computer needs to stay on and reachable on the LAN
the whole time you're testing — this isn't a standalone build, it's your
dev server with a shortcut icon.

---

## Option B — Real installable APK via Capacitor

Takes longer to set up the first time, but produces an actual `.apk` file
you can install and share, independent of your dev server staying up
(though it still needs to reach your API server over the network — see
below).

**If you're building on WSL to test on a NetHunter phone**, skip down to
"Building on WSL" below — it's a more direct path than the generic
Android Studio steps immediately following this.

### Prerequisites (one-time)
- Android Studio installed
- JDK 17 (Android Studio can install this for you)

### Steps

```bash
cd apps/web

# 1. Install the Capacitor packages (already added to package.json)
pnpm install

# 2. Point the build at your API server's LAN IP
cp .env.android.example .env.android
# edit .env.android — set VITE_API_URL to http://<your-LAN-IP>:3000

# 3. Build the web app for Android
pnpm build:android

# 4. Add the Android platform (first time only)
pnpm cap:add:android

# 5. Sync the built web app into the native project
pnpm cap:sync

# 6. Open it in Android Studio
pnpm cap:open:android
```

In Android Studio: let Gradle sync finish, then either:
- Click Run with your phone connected via USB (enable Developer Options
  -> USB Debugging first), or
- **Build -> Build Bundle(s) / APK(s) -> Build APK(s)** to get a `.apk` file
  you can copy to your phone directly and install (you'll need to allow
  "install from unknown sources" once).

### Why this needs the LAN IP step

The compiled app has no dev server — it's a bundled native shell. Every
API request it makes needs an absolute URL to somewhere real, which is
why `VITE_API_URL` exists (see `apps/web/src/lib/axios.ts`). Your phone
and computer need to be on the same Wi-Fi network for the LAN IP to work.

### Already handled for you
- **CORS**: the API now explicitly allows `capacitor://localhost` /
  `https://localhost` (the app's origin from inside the WebView), not
  just your browser's dev URL — this would otherwise silently block
  every request with no obvious error.
- **Cleartext HTTP**: `capacitor.config.ts` has `cleartext: true` so
  plain `http://` to your LAN API server isn't blocked by Android (only
  needed because this is a testing setup without HTTPS — a real release
  build should use a real HTTPS API URL and this can come back out).

### This is explicitly a testing build
- `appId: com.crmplatform.app` is a placeholder — change it before any
  real release (Play Store requires a unique, permanent one you can never
  change later).
- No app signing / release keystore set up — Android Studio's default
  debug signing is fine for installing on your own phone, not for
  distributing to anyone else.
- No app icon customization beyond the generated placeholder in
  `public/icons/` — swap those for real branding before this goes
  anywhere near a store listing.

---

## Building on WSL (Windows) — recommended for your setup

Since your build machine (WSL) and test device (NetHunter phone) are
separate, and the phone self-hosts its own API/worker, the APK can just
talk to `localhost` — no LAN IP needed, because once installed, the app
and the API server it's calling are both running on the same phone.

### One-time WSL setup

```bash
# JDK 17
sudo apt update && sudo apt install -y openjdk-17-jdk

# Android SDK command-line tools (no Android Studio GUI needed at all —
# this is a pure CLI build, which sidesteps any WSL/GUI complications)
mkdir -p ~/android-sdk/cmdline-tools && cd ~/android-sdk/cmdline-tools
curl -o cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip cmdline-tools.zip && mv cmdline-tools latest && rm cmdline-tools.zip

export ANDROID_HOME=~/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
# add those two export lines to ~/.bashrc so you don't retype them every session

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### Build the APK

```bash
cd apps/web
pnpm install

cp .env.android.example .env.android
# edit .env.android:
#   VITE_API_URL=http://localhost:3000
# (this works because the finished app and its API both end up running
# on the same NetHunter phone — not because WSL can reach localhost:3000,
# it can't, and doesn't need to)

pnpm build:android
pnpm cap:add:android
pnpm cap:sync

cd android
./gradlew assembleDebug
```

Output: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`

### Get it onto the phone

WSL's filesystem is reachable from Windows at `\\wsl$\` (or
`\\wsl.localhost\` on newer WSL) in File Explorer. Navigate to that
`app-debug.apk` path, copy it to a normal Windows folder, then transfer
it to the phone however you'd normally move a file over (cable, cloud
storage, etc.) and install it — you'll need to allow "install from
unknown sources" once.

`adb install` over USB is faster if you've got `usbipd-win` set up for
WSL2 USB passthrough already; if not, the copy-the-file route above is
more reliable than fighting that setup for a one-off test install.

---

## Icon, splash screen, full screen, and a real release build

Covers three things: adding a real app icon, making the status bar match
the app instead of looking like a mismatched black bar, and signing a
proper release APK instead of a debug one.

### 1. App icon + splash screen

Source images are already generated for you at `apps/web/assets/`
(`icon.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`)
matching the app's existing blue "C" mark — adaptive-icon-safe (the
foreground glyph is sized to survive Android's circular/square crop, not
just centered in the raw square).

```bash
cd apps/web
pnpm install                 # pulls in @capacitor/assets and @capacitor/status-bar
pnpm cap:assets               # generates every mipmap density + adaptive icon XML
pnpm build:android
pnpm cap:sync
cd android && ./gradlew assembleDebug   # or assembleRelease, see below
```

`cap:assets` writes directly into `android/app/src/main/res/` — you
don't touch any of those generated files by hand. If you ever want a
different icon, just replace the source PNGs in `assets/` and re-run
`pnpm cap:assets`.

### 2. Status bar / "full screen" look

The plain black status bar with no relationship to the app content
(what you're seeing in your screenshot) was because nothing was styling
it — Android just shows its own default. Fixed: the app now sets the
status bar's background color to match the app's own background
(`#f8fafc` light / `#1e293b` dark) and picks matching icon color, and it
updates live if you toggle dark mode. That's in `ThemeContext.tsx` — no
native file edits needed, it takes effect after `pnpm cap:sync` and a
rebuild.

**One thing I want to flag rather than guess at:** the *large* gap below
the status bar in your screenshot (between it and the "CRM Platform"
logo) is almost certainly the login card being intentionally centered
vertically on the screen (`AuthLayout.tsx` — same as most login pages).
That's normal, not a bug. If you still want that tightened up after
seeing the status bar fix (e.g., logo pinned near the top instead of the
whole card centered), tell me and I'll adjust `AuthLayout.tsx` — I didn't
want to change that blind without knowing if the status bar color was
the actual complaint or not.

If what you actually want is *true* edge-to-edge (app content extending
up underneath the status bar, translucent, rather than the status bar
being a solid bar above the content) — that's a bigger, riskier change
(every layout needs safe-area padding added so headers/buttons don't end
up hidden under the status bar or a camera cutout). Doable, but I'd
rather build and explain that specifically if it's what you want, not
bundle it in blind.

### 3. Release APK (not debug)

A debug build is signed with an auto-generated, insecure debug key —
fine for installing on your own phone, but "not a real release" is
correct. To get a real signed release APK:

```bash
# One-time: generate a real signing key. Keep this file and the
# passwords you set somewhere safe — if you lose it, you can never
# publish an update under the same app identity again.
keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias crm-release
```

It'll ask for a keystore password and some identity info (name, org,
etc. — doesn't matter much for testing, just don't leave it blank).

Move `release-key.jks` into `apps/web/android/app/`, then create
`apps/web/android/keystore.properties` (this file holds your passwords —
**never commit it**, add it to `.gitignore`):

```properties
storeFile=release-key.jks
storePassword=<the password you set>
keyAlias=crm-release
keyPassword=<the password you set>
```

Then open `apps/web/android/app/build.gradle` and add the signing config.
Find the `android { ... }` block and add this near the top of it, plus
wire it into `buildTypes.release`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ...existing content...

    signingConfigs {
        release {
            storeFile file(keystoreProperties['storeFile'] ?: 'release-key.jks')
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

Then build the release APK:

```bash
cd apps/web/android
./gradlew assembleRelease
```

Output: `apps/web/android/app/build/outputs/apk/release/app-release.apk` —
this one's a real signed release build, installable the same way (copy
to phone, allow unknown sources, install).

**Still testing-only**, just properly signed now: `appId:
com.crmplatform.app` in `capacitor.config.ts` is a placeholder — a real
Play Store release needs a permanent unique one you set before first
publish and never change, plus `minifyEnabled true` with proper ProGuard
rules, plus you'd want that keystore backed up somewhere safer than a
project folder.
