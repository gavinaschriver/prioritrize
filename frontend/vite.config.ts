import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', not 'autoUpdate': autoUpdate swaps the service worker
      // mid-session, and a lazily-loaded chunk can then 404 against the new
      // precache manifest, blanking the page. UpdatePrompt.tsx asks first.
      registerType: 'prompt',
      // No includeAssets: the globPatterns below already match every file in
      // public/, and listing them twice precaches each one twice.
      manifest: {
        name: 'PRIORI-TRIZE',
        short_name: 'Prioritrize',
        description: 'Score your day against the priorities you set.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1d4ed8',
        background_color: '#f8fafc',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // png/webmanifest are omitted on purpose: the plugin already
        // precaches the generated manifest and the icons it references, so
        // globbing them too would add every one a second time.
        globPatterns: ['**/*.{js,css,html,ico,svg}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Deliberately NO runtimeCaching. The Fly API and Supabase must never
        // be cached: their responses are per-user data behind a bearer token,
        // and anything in CacheStorage outlives sign-out (useAuth.signOut
        // clears the TanStack Query cache but knows nothing about
        // CacheStorage). This is also a scoring app, so a stale daySummary or
        // balance is wrong, not merely old. In-memory TanStack Query caching
        // (App.tsx, staleTime: 30_000) is the correct layer for that.
        // Offline behaviour is therefore: shell loads, queries fail, the
        // existing isLoading/error branches render.
      },
      devOptions: { enabled: false },
    }),
  ],
})
