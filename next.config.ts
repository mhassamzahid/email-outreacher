import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The default bottom-left spot covers the sidebar footer controls.
  devIndicators: { position: "bottom-right" },
  async redirects() {
    return [{ source: "/", destination: "/icps", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
