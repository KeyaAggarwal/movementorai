/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell webpack not to try to bundle better-sqlite3 (it's a native module, server-only)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep better-sqlite3 external so Next.js doesn't bundle it
      config.externals = [...(config.externals || []), 'better-sqlite3'];
    }
    return config;
  },
};

module.exports = nextConfig;
