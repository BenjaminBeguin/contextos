export const env = {
  port: Number(process.env.API_PORT ?? 3008),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3007",
};
