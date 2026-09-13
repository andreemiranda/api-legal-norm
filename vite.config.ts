import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || ''),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || ''),
      'import.meta.env.VITE_FIREBASE_DATABASE_URL': JSON.stringify(process.env.VITE_FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || ''),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || ''),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''),
      // Mirror keys:
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_API_KEY': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_API_KEY || process.env.VITE_FIREBASE_2_API_KEY || ''),
      'import.meta.env.VITE_FIREBASE_2_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_2_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_2_API_KEY || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN || process.env.VITE_FIREBASE_2_AUTH_DOMAIN || ''),
      'import.meta.env.VITE_FIREBASE_2_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_2_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL || process.env.VITE_FIREBASE_2_DATABASE_URL || ''),
      'import.meta.env.VITE_FIREBASE_2_DATABASE_URL': JSON.stringify(process.env.VITE_FIREBASE_2_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_PROJECT_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_PROJECT_ID || process.env.VITE_FIREBASE_2_PROJECT_ID || ''),
      'import.meta.env.VITE_FIREBASE_2_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_2_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_2_PROJECT_ID || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET || process.env.VITE_FIREBASE_2_STORAGE_BUCKET || ''),
      'import.meta.env.VITE_FIREBASE_2_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_2_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_2_MESSAGING_SENDER_ID || ''),
      'import.meta.env.VITE_FIREBASE_2_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_2_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID || ''),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_APP_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_APP_ID || process.env.VITE_FIREBASE_2_APP_ID || ''),
      'import.meta.env.VITE_FIREBASE_2_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_2_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_2_APP_ID || ''),
      // Admin & Domain Environment Variables
      'import.meta.env.ADMINISTRADORES': JSON.stringify(process.env.ADMINISTRADORES || process.env.ADMINITRADORES || process.env.VITE_ADMINISTRADORES || process.env.ADMIN_EMAILS || 'legislativemunicipal@gmail.com'),
      'import.meta.env.VITE_ADMINISTRADORES': JSON.stringify(process.env.VITE_ADMINISTRADORES || process.env.ADMINISTRADORES || process.env.ADMINITRADORES || process.env.ADMIN_EMAILS || 'legislativemunicipal@gmail.com'),
      'import.meta.env.NEXT_PUBLIC_ADMINISTRADORES': JSON.stringify(process.env.NEXT_PUBLIC_ADMINISTRADORES || process.env.ADMINISTRADORES || process.env.ADMINITRADORES || process.env.ADMIN_EMAILS || 'legislativemunicipal@gmail.com'),
      'import.meta.env.NEXT_PUBLIC_DOMAIN': JSON.stringify(process.env.NEXT_PUBLIC_DOMAIN || process.env.VITE_SITE_URL || ''),
      'import.meta.env.VITE_SITE_URL': JSON.stringify(process.env.VITE_SITE_URL || process.env.NEXT_PUBLIC_DOMAIN || ''),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: ['api-legal-norm.onrender.com'],
    },
  };
});
