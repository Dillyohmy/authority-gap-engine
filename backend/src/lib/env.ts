import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { config } from "dotenv";

const cwd = process.cwd();
const envPaths =
  basename(cwd) === "backend"
    ? [resolve(cwd, ".env"), resolve(cwd, "..", ".env")]
    : [resolve(cwd, ".env"), resolve(cwd, "backend", ".env")];

const loadedEnvPaths: string[] = [];

for (const path of envPaths) {
  if (existsSync(path)) {
    config({ path });
    loadedEnvPaths.push(path);
  }
}

export function readEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

export function requireEnv(names: string[]): string {
  const value = readEnv(names);
  if (!value) {
    const loaded =
      loadedEnvPaths.length > 0 ? loadedEnvPaths.join(", ") : "none";
    throw new Error(
      [
        `Missing required environment variable: ${names.join(" or ")}`,
        `Loaded .env files: ${loaded}`,
        `Checked .env paths: ${envPaths.join(", ")}`,
      ].join("\n")
    );
  }
  return value;
}
