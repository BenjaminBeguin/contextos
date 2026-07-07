function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

const isProd = process.env.NODE_ENV === "production";

export const env = {
  isProd,
  // Railway (and most PaaS) inject PORT; fall back to API_PORT then the dev default.
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 3008),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  // Landing (3007) and the product app (3009) are separate origins.
  allowedOrigins: (
    process.env.CORS_ORIGINS ?? "http://localhost:3007,http://localhost:3009"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Where to send users after authentication (the product app).
  appUrl:
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3009",
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3008",

  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    get configured() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  // Email-only dev login. On by default outside production; never in production.
  allowDevLogin: bool(process.env.ALLOW_DEV_LOGIN, !isProd) && !isProd,

  // Platform superadmins (comma-separated emails) — can access the admin dashboard.
  superAdminEmails: (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};
