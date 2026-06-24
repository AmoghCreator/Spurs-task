/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL ?? "http://localhost:3002",
  },
};

export default nextConfig;
