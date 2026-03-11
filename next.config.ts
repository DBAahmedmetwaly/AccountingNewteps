
import nextPWA from "@ducanh2912/next-pwa";

const withPWA = nextPWA({
  dest: "public",
  disable: false,
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          },
          networkTimeoutSeconds: 3, // Fallback to cache after 3 seconds
        },
      },
      {
        urlPattern: ({ request }) =>
          request.destination === 'script' || request.destination === 'style',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-resources',
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 24 * 60 * 60, // 1 Day
          },
        },
      },
      {
        urlPattern: ({ request }) => request.destination === 'image',
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          },
        },
      },
       {
        urlPattern: ({ url }) => url.href.includes("firebaseio.com"),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'firebase-data',
          networkTimeoutSeconds: 5,
        },
      },
    ],
  },
  fallbacks: {
    document: "/offline",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  reactStrictMode: false, // Recommended for production PWA to avoid double renders
  eslint: { ignoreDuringBuilds: true }, // Avoid ESLint 9/10 options conflict during Vercel build
};

export default withPWA(nextConfig);
