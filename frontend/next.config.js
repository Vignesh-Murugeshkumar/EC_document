/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * In local development, proxy /api/* requests to the FastAPI backend
   * running on localhost:8000.
   *
   * On Vercel, /api/* is handled by the Python Serverless Functions
   * defined in the root api/ directory, so no rewrite is needed.
   */
  async rewrites() {
    if (process.env.VERCEL) {
      // Running on Vercel — serverless functions handle /api/* natively
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
