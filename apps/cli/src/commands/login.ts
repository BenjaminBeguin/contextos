import { createInterface } from "node:readline/promises";
import { saveCredentials, DEFAULT_API_BASE_URL } from "../config.js";

export async function loginCommand(opts: { email?: string; api?: string }) {
  const baseUrl = opts.api ?? DEFAULT_API_BASE_URL;
  let email = opts.email;
  if (!email) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    email = (await rl.question("Email: ")).trim();
    rl.close();
  }

  // 1. Create/find the user and obtain a session cookie.
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const setCookie = loginRes.headers.getSetCookie?.().join("; ") ?? "";

  // 2. Exchange the session for a long-lived API token.
  const tokenRes = await fetch(`${baseUrl}/auth/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: setCookie },
    body: JSON.stringify({ name: "cli" }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Token mint failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const { token } = (await tokenRes.json()) as { token: string };

  saveCredentials({ apiBaseUrl: baseUrl, token });
  console.log(`Logged in as ${email}. Credentials saved to ~/.cortex/credentials.json`);
}
