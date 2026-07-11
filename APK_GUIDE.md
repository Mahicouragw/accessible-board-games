# 📱 APK Guide — Convert Accessible Board Games to Android APK

Your PWA is now ready to be packaged as a real APK you can install on Android, share, and publish to Play Store.

## What You Have Now

- **PWA**: Works offline via `public/sw.js` service worker, installable via browser
- **Manifest**: `src/app/manifest.ts` with icons, theme, display standalone
- **Capacitor Config**: `capacitor.config.ts` ready for Android

## Option 1: Quick APK via GitHub Actions (Recommended — No Android Studio needed)

I added `.github/workflows/apk.yml` that builds APK automatically in cloud.

1. Go to https://github.com/Mahicouragw/accessible-board-games → Actions tab
2. You will see workflow **Build APK** → Click **Run workflow** → Run
3. Wait 5-10 minutes → Build finishes
4. Download artifact **app-debug.apk** (click on run → Artifacts → app-debug.apk)
5. Install on Android: Transfer APK to phone → Tap → Allow unknown sources → Install

APK will load your live Vercel site or offline static files (configurable in `capacitor.config.ts`).

## Option 2: Build APK Locally (Requires Android Studio)

On your PC (Windows/Mac/Linux):

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Generate icons (creates PNGs from SVG for APK)
npm run icons:generate

# 3. Build Next.js static output
npm run build

# 4. Init Capacitor (first time only)
npm run cap:init
npm run cap:add

# 5. Copy web files to Android
npm run cap:copy
npm run cap:sync

# 6. Open Android Studio
npm run cap:open
# In Android Studio: Build → Build APK → Debug → APK at android/app/build/outputs/apk/debug/app-debug.apk

# OR build via command line (requires Android SDK + Gradle):
npm run apk:build
```

## Option 3: PWABuilder (Easiest, No Code)

1. Go to https://www.pwabuilder.com
2. Enter URL: `https://accessible-board-games.vercel.app`
3. Click Start → It scores PWA → Click Build My PWA
4. Select Android → Options → Package ID: `com.accessibleboardgames.app`
5. Download APK → Install

PWABuilder uses Bubblewrap to wrap your PWA.

## APK Features

- **Offline**: Works offline if `capacitor.config.ts` has no `server.url` (uses `out/` folder)
- **Online**: If you set `server.url: 'https://accessible-board-games.vercel.app'` in capacitor.config.ts, APK always loads live site (needs internet, always up-to-date)
- **Accessibility**: High contrast, font size, screen reader still work in APK (WebView)
- **Future Features**: You can add native features via Capacitor plugins:
  - Push notifications: `@capacitor/push-notifications`
  - Haptics: `@capacitor/haptics` (already added)
  - Status bar: `@capacitor/status-bar`
  - Filesystem for local saves

## How to Add More Features in Future (You asked)

1. **Add new game**: Create component in `src/components/games/NewGame.tsx` → Add to `src/lib/games.ts` → Add route in `src/app/play/[game]/page.tsx`
2. **Database**: Already added — just set `DATABASE_URL` in Vercel
3. **Cloud saves**: Already in `useSaveScore` hook — saves to `/api/scores` when DB configured
4. **APK Update**: After adding features, push to GitHub → Vercel auto-deploys web → For APK, re-run GitHub Action Build APK → Download new APK

## Icons

APK needs PNG icons. Run:

```bash
npm install --legacy-peer-deps
npm run icons:generate
```

This creates:
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-512.png`
- `public/icons/apple-touch-icon.png`
- `public/favicon.png`

These are used by PWA and APK.

## Publishing to Play Store

1. Build release APK (not debug): In Android Studio → Build → Generate Signed Bundle/APK → Android App Bundle
2. Create keystore (one time)
3. Upload AAB to https://play.google.com/console

For testing, debug APK from GitHub Actions is enough.

---

Your accessible board games now work as **Website + PWA + APK**!
