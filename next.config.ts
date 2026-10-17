import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // These packages load native code, WASM or their own workers, so they run
  // from node_modules instead of being bundled into the server build.
  serverExternalPackages: [
    '@mastra/core',
    '@mastra/observability',
    '@mastra/sentry',
    '@mastra/otel-exporter',
    '@temporalio/client',
    '@temporalio/worker',
    '@temporalio/activity',
    '@electric-sql/pglite',
    '@electric-sql/pglite-pgvector',
    'pg',
    'unpdf',
  ],
};

export default nextConfig;
