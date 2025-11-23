/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  //Disable service worker check
  webpack: (config, { isServer }) => {
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
};

export default nextConfig;
