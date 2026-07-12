import type { CapacitorConfig } from '@capacitor/cli';

const productionUrl = (process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.everittventures.com').replace(
  /\/$/,
  ''
);

const isLocalDev =
  process.env.CAPACITOR_DEV === 'true' &&
  (productionUrl.startsWith('http://localhost') || productionUrl.startsWith('http://127.0.0.1'));

const config: CapacitorConfig = {
  appId: 'com.everittventures.everittos',
  appName: 'EverittOS',
  webDir: 'mobile-shell',
  server: {
    url: productionUrl,
    cleartext: isLocalDev,
    androidScheme: 'https',
    hostname: 'app.everittventures.com',
    allowNavigation: ['app.everittventures.com', '*.everittventures.com', 'checkout.stripe.com', 'billing.stripe.com']
  },
  ios: {
    scheme: 'EverittOS',
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: false,
    captureInput: true
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#24302B',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#24302B'
    }
  }
};

export default config;
