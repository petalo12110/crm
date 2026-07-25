import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@crm/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // Deliberately NOT binding to all interfaces by default — that
    // requires Vite to call os.networkInterfaces() to print the
    // "Network:" banner, which crashes outright on some setups (Kali,
    // NetHunter's phone-hosted chroot in particular — see
    // README-ANDROID.md). Plain `pnpm dev` stays on the safe default
    // (localhost only, no enumeration, works everywhere). Set
    // VITE_DEV_HOST explicitly when you actually need LAN access from a
    // separate device — `pnpm dev:lan` does this for you.
    host: process.env.VITE_DEV_HOST || undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
