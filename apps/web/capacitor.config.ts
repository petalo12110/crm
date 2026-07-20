import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.crmplatform.app',
  appName: 'CRM Platform',
  webDir: 'dist',
  server: {
    // Allows plain http:// traffic to your LAN API server (Android 9+
    // blocks cleartext HTTP by default). Fine for local testing; a real
    // release build should point VITE_API_URL at an https:// server
    // instead and this can come back out.
    cleartext: true,
  },
}

export default config
