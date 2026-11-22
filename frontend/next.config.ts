import type { NextConfig } from "next";

// Production builds are a static export that FastAPI serves. Export mode does not allow rewrites, so only
// `next dev` drops it and forwards /api to a local backend (see CLAUDE.md for how to run it).
const dev = process.env.NODE_ENV === "development";
const api = process.env.API_URL ?? "http://localhost:8002";

const nextConfig: NextConfig = {
  ...(dev
    ? { rewrites: async () => [{ source: "/api/:path*", destination: `${api}/api/:path*` }] }
    : { output: "export" }),
  reactCompiler: true,
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
