import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.resto.app',
  appName: 'RESTO',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    BarcodeScanner: {
      cameraDirection: 'back'
    }
  }
};

export default config;