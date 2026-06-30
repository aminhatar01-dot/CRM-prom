import type { NextConfig } from "next";

// Security headers applied to all routes by default.
// Webchat API routes omit X-Frame-Options to allow cross-origin embedding of
// the chat widget container created by crm-pro-ai-widget.js.
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Avoid sending full referrer to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser feature access
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS — instruct browsers to always use HTTPS (1 year, include subdomains)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // CSP: allow inline styles/scripts required by Next.js; restrict external scripts
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://graph.facebook.com https://api.mercadopago.com",
      "frame-src 'self' https://www.facebook.com",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const frameHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@crm-pro-ai/ui",
    "@crm-pro-ai/types",
    "@crm-pro-ai/ai",
    "@crm-pro-ai/integrations",
    "@crm-pro-ai/automation",
    "@crm-pro-ai/database",
  ],
  async headers() {
    return [
      // Security headers for all routes
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // X-Frame-Options only for app routes (not webchat API — widget creates cross-origin containers)
      {
        source: "/((?!api/webchat|widget).*)",
        headers: frameHeaders,
      },
    ];
  },
};

export default nextConfig;
