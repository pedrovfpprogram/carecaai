import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pedro.carecaai',
  appName: 'CarecaAI',
  webDir: 'public',
  server: {
    // Aponta o aplicativo para o seu servidor online
    url: 'https://carecaai.vercel.app', 
    cleartext: true
  }
};

export default config;