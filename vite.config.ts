import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {defineConfig} from 'vite';

// Automatically load .env, with .env.example fallback so all 478 variables are loaded without manual steps
if (fs.existsSync(path.resolve(__dirname, '.env'))) {
  dotenv.config({ path: path.resolve(__dirname, '.env') });
}
if (fs.existsSync(path.resolve(__dirname, '.env.example'))) {
  dotenv.config({ path: path.resolve(__dirname, '.env.example') });
}

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCAQ6UdqNC3_spKkjH79Rf7s9SwBMN98Fw'),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCAQ6UdqNC3_spKkjH79Rf7s9SwBMN98Fw'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || 'legal-norm2.firebaseapp.com'),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'legal-norm2.firebaseapp.com'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || 'https://legal-norm2-default-rtdb.firebaseio.com'),
      'import.meta.env.VITE_FIREBASE_DATABASE_URL': JSON.stringify(process.env.VITE_FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://legal-norm2-default-rtdb.firebaseio.com'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'legal-norm2'),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'legal-norm2'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || 'legal-norm2.firebasestorage.app'),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'legal-norm2.firebasestorage.app'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '878021514659'),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '878021514659'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '1:878021514659:web:966a382c6c7ffeb6a9f616'),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:878021514659:web:966a382c6c7ffeb6a9f616'),
      // Mirror keys:
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_API_KEY': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_API_KEY || process.env.VITE_FIREBASE_2_API_KEY || 'AIzaSyBgpGn4rTTZET8DaT9wJL0zmwcYv_9x6gs'),
      'import.meta.env.VITE_FIREBASE_2_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_2_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_2_API_KEY || 'AIzaSyBgpGn4rTTZET8DaT9wJL0zmwcYv_9x6gs'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN || process.env.VITE_FIREBASE_2_AUTH_DOMAIN || 'legal-norm3.firebaseapp.com'),
      'import.meta.env.VITE_FIREBASE_2_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_2_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_2_AUTH_DOMAIN || 'legal-norm3.firebaseapp.com'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL || process.env.VITE_FIREBASE_2_DATABASE_URL || 'https://legal-norm3-default-rtdb.firebaseio.com'),
      'import.meta.env.VITE_FIREBASE_2_DATABASE_URL': JSON.stringify(process.env.VITE_FIREBASE_2_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_2_DATABASE_URL || 'https://legal-norm3-default-rtdb.firebaseio.com'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_PROJECT_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_PROJECT_ID || process.env.VITE_FIREBASE_2_PROJECT_ID || 'legal-norm3'),
      'import.meta.env.VITE_FIREBASE_2_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_2_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_2_PROJECT_ID || 'legal-norm3'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET || process.env.VITE_FIREBASE_2_STORAGE_BUCKET || 'legal-norm3.firebasestorage.app'),
      'import.meta.env.VITE_FIREBASE_2_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_2_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_2_STORAGE_BUCKET || 'legal-norm3.firebasestorage.app'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_2_MESSAGING_SENDER_ID || '907491581027'),
      'import.meta.env.VITE_FIREBASE_2_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_2_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_2_MESSAGING_SENDER_ID || '907491581027'),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_2_APP_ID': JSON.stringify(process.env.NEXT_PUBLIC_FIREBASE_2_APP_ID || process.env.VITE_FIREBASE_2_APP_ID || '1:907491581027:web:e45c8faad065d6b8fe6c56'),
      'import.meta.env.VITE_FIREBASE_2_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_2_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_2_APP_ID || '1:907491581027:web:e45c8faad065d6b8fe6c56'),
      // Admin & Domain Environment Variables
      'import.meta.env.ADMINISTRADORES': JSON.stringify(process.env.ADMINISTRADORES || process.env.ADMINITRADORES || process.env.VITE_ADMINISTRADORES || 'mirandinhacontabilidade@gmail.com,acrmrochamiranda@gmail.com,legislativemunicipal@gmail.com'),
      'import.meta.env.VITE_ADMINISTRADORES': JSON.stringify(process.env.VITE_ADMINISTRADORES || process.env.ADMINISTRADORES || process.env.ADMINITRADORES || 'mirandinhacontabilidade@gmail.com,acrmrochamiranda@gmail.com,legislativemunicipal@gmail.com'),
      'import.meta.env.NEXT_PUBLIC_ADMINISTRADORES': JSON.stringify(process.env.NEXT_PUBLIC_ADMINISTRADORES || process.env.ADMINISTRADORES || process.env.ADMINITRADORES || 'mirandinhacontabilidade@gmail.com,acrmrochamiranda@gmail.com,legislativemunicipal@gmail.com'),
      'import.meta.env.ADMIN_PASSWORD': JSON.stringify(process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'Br@s!Iweb2027'),
      'import.meta.env.VITE_ADMIN_PASSWORD': JSON.stringify(process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Br@s!Iweb2027'),
      'import.meta.env.NEXT_PUBLIC_DOMAIN': JSON.stringify(process.env.NEXT_PUBLIC_DOMAIN || process.env.VITE_SITE_URL || 'https://normajuridica.com.br'),
      'import.meta.env.VITE_SITE_URL': JSON.stringify(process.env.VITE_SITE_URL || process.env.NEXT_PUBLIC_DOMAIN || 'https://normajuridica.com.br'),
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
