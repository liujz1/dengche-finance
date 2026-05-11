import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@prisma/client", "@prisma/adapter-better-sqlite3"],
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/*.node",
      "./node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/lib/binding/**/*.node",
    ],
  },
};

export default nextConfig;
