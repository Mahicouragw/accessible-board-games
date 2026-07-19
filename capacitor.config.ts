import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.accessibleboardgames.app',
  appName: 'Accessible Board Games',
  webDir: 'out',
  server: {
    // For production APK that loads live Vercel site (always up-to-date):
    // Comment out url and androidScheme to use local static files (offline mode)
    // Uncomment below to make APK load live site (requires internet):
    url: 'https://accessible-board-games.vercel.app',
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#020617",
    },
    StatusBar: {
      backgroundColor: "#020617",
      style: "Dark",
    },
  },
  android: {
    backgroundColor: "#020617",
    allowMixedContent: true,
  },
};

export default config;
