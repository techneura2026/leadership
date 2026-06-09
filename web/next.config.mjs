/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL ?? 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
  webpack(config) {
    // jsPDF's ES module build uses internal lazy chunks whose public URL
    // Next.js webpack cannot resolve (_next/undefined). Force the UMD build
    // which is a single self-contained file with no internal dynamic imports.
    // jspdf-autotable has zero dynamic imports so needs no alias.
    config.resolve.alias = {
      ...config.resolve.alias,
      jspdf: 'jspdf/dist/jspdf.umd.min.js',
    };
    return config;
  },
};

export default nextConfig;
