import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@crm-pro-ai/ui",
    "@crm-pro-ai/types",
    "@crm-pro-ai/ai",
    "@crm-pro-ai/integrations",
    "@crm-pro-ai/automation",
    "@crm-pro-ai/database"
  ]
};

export default nextConfig;
