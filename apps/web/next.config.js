/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['127.0.0.1'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '::',
        port: '9000',
        pathname: "/**",
      },
    ],
    // Allow unoptimized images for localhost (development)
    unoptimized: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
