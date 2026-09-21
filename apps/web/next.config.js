/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Needed for @mediapipe/tasks-vision WASM loading
    serverComponentsExternalPackages: [],
  },
  webpack: (config, { isServer }) => {
    // Allow .wasm files
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    // Resolve mediapipe WASM
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
  // Required for Teams iframe embedding
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow Teams iframe embedding
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://*.skype.com" },
          { key: "X-Frame-Options", value: "ALLOW-FROM https://teams.microsoft.com" },
        ],
      },
    ];
  },
  // Proxy FastAPI-specific routes to the backend (avoids CORS + hardcoded URLs in components)
  // Local Next.js handlers (/api/s3-list, /api/lambda-followup) are NOT proxied
  async rewrites() {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "https://techbee-api.onrender.com").replace(/\/+$/, '');
    return [
      { source: "/api/hr/:path*",          destination: `${apiBase}/api/hr/:path*` },
      { source: "/api/interview/:path*",   destination: `${apiBase}/api/interview/:path*` },
      { source: "/api/questions/:path*",   destination: `${apiBase}/api/questions/:path*` },
      { source: "/api/health",             destination: `${apiBase}/api/health` },
      { source: "/api/auth/:path*",        destination: `${apiBase}/api/auth/:path*` },
    ];
  },
};

module.exports = nextConfig;
