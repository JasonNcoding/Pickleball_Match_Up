import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: '/', // The original path
        destination: '/login', // The new path
        permanent: true, // Sets the 308 Permanent Redirect status code
      },
      // You can add more redirects here
    ];
  },
};

export default nextConfig;
