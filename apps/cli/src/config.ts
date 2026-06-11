import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CRED_DIR = join(homedir(), ".cortex");
const CRED_FILE = join(CRED_DIR, "credentials.json");
const PROJECT_DIR = ".cortex";
const PROJECT_CONFIG = join(PROJECT_DIR, "config.json");

export interface Credentials {
  apiBaseUrl: string;
  token: string;
}

export interface ProjectConfig {
  apiBaseUrl: string;
  repoId: string;
  repoFullName?: string;
}

export function saveCredentials(creds: Credentials): void {
  if (!existsSync(CRED_DIR)) mkdirSync(CRED_DIR, { recursive: true });
  writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function loadCredentials(): Credentials | null {
  if (!existsSync(CRED_FILE)) return null;
  return JSON.parse(readFileSync(CRED_FILE, "utf8")) as Credentials;
}

export function saveProjectConfig(config: ProjectConfig, cwd = process.cwd()): void {
  const dir = join(cwd, PROJECT_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(cwd, PROJECT_CONFIG), JSON.stringify(config, null, 2));
}

export function loadProjectConfig(cwd = process.cwd()): ProjectConfig | null {
  const file = join(cwd, PROJECT_CONFIG);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as ProjectConfig;
}

export const DEFAULT_API_BASE_URL =
  process.env.CORTEX_API_URL ?? "http://localhost:3008";
