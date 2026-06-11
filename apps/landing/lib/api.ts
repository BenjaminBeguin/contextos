export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3008";

// The authenticated product app (apps/web) lives on its own origin.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3009";
