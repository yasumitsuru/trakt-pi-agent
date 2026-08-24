import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { getTraktCliPath } from "../config/config.js";

// Credential-like patterns to sanitize from stderr
const CRED_PATTERNS = [
  /token[=:]\s*\S+/gi,
  /key[=:]\s*\S+/gi,
  /secret[=:]\s*\S+/gi,
  /password[=:]\s*\S+/gi,
  /api[_-]?key[=:]\s*\S+/gi,
  /client_id[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
];

function sanitizeStderr(raw: string): string {
  let out = raw;
  for (const pat of CRED_PATTERNS) {
    out = out.replace(pat, (m) => {
      const eq = m.indexOf("=");
      const prefix = eq > -1 ? m.slice(0, eq + 1) : m.slice(0, 6);
      return prefix + "***";
    });
  }
  return out;
}

export interface ExecuteTraktCliOptions {
  timeoutMs?: number;
}

export interface ExecuteTraktCliResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Execute TraktCLI via child_process.spawn (no shell).
 *
 * - Arguments passed as array (no shell expansion).
 * - stdout parsed as JSON on success.
 * - Non-zero exit throws.
 * - Timeout kills the child and throws.
 * - stderr credential patterns are sanitized.
 */
export async function executeTraktCli(
  cliPath: string,
  args: string[],
  opts?: ExecuteTraktCliOptions,
): Promise<unknown> {
  const timeoutMs = opts?.timeoutMs ?? 30_000;

  const child: ReturnType<typeof cp.spawn> = cp.spawn(
    cliPath,
    args,
    { shell: false } as cp.SpawnOptions,
  );

  const stdoutBuf: Buffer[] = [];
  const stderrBuf: Buffer[] = [];

  child.stdout!.on("data", (buf: Buffer) => stdoutBuf.push(buf));
  child.stderr!.on("data", (buf: Buffer) => stderrBuf.push(buf));

  const exitPromise = new Promise<[number, string | null]>(
    (resolve, reject) => {
      child.on("close", (code: number) => resolve([code ?? -1, null]));
      child.on("error", (err: Error) => reject(err));
    },
  );

  // Timeout guard: kill child if it exceeds timeoutMs
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { child.kill("SIGKILL"); } catch { /* already dead */ }
  }, timeoutMs);

  let code: number;
  try {
    [code] = await exitPromise;
  } catch (err) {
    clearTimeout(timer);
    if (timedOut) {
      throw new Error(`TraktCLI timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
  clearTimeout(timer);

  if (code !== 0) {
    const rawStderr = Buffer.concat(stderrBuf).toString("utf8");
    const sanitized = sanitizeStderr(rawStderr);
    throw new Error(
      `TraktCLI exited with code ${code}: ${sanitized.trim() || "no output"}`,
    );
  }

  const stdout = Buffer.concat(stdoutBuf).toString("utf8").trim();
  if (!stdout) throw new Error("TraktCLI returned empty output");

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(
      `TraktCLI returned malformed JSON: ${stdout.slice(0, 200)}`,
    );
  }
}

export interface DiscoverTraktCliOptions {
  configuredPath?: string | null;
  pathEnv?: string;
  platform?: NodeJS.Platform;
  exists?: (candidate: string) => boolean;
  getConfiguredPath?: () => string | null;
}

const DEFAULT_CLI_NAME_WIN = "trakt-cli.exe";
const DEFAULT_CLI_NAME_UNIX = "trakt-cli";

/**
 * Discover the TraktCLI executable path.
 *
 * Priority:
 * 1. Configured explicit path (if present and exists)
 * 2. PATH lookup (trakt-cli.exe on Windows, trakt-cli on Unix)
 *
 * Returns null when TraktCLI is not found.
 * Does not throw when TraktCLI is missing.
 */
export function discoverTraktCli(
  options?: DiscoverTraktCliOptions,
): string | null {
  // Use property-presence semantics: configuredPath: null explicitly means
  // "no configured path" and must NOT fall through to production config.
  const hasConfiguredPath =
    options != null && Object.prototype.hasOwnProperty.call(options, "configuredPath");
  const configuredPath = hasConfiguredPath
    ? options.configuredPath
    : (options?.getConfiguredPath ?? getTraktCliPath)();

  // 1. Configured explicit path has priority.
  if (configuredPath != null && configuredPath.length > 0) {
    const exists = options?.exists ?? fs.existsSync;
    if (exists(configuredPath)) {
      return configuredPath;
    }
    // Invalid configured path → return null (do NOT fall back to PATH).
    return null;
  }

  // 2. PATH lookup.
  const pathEnv = options?.pathEnv ?? process.env.PATH;
  if (!pathEnv || pathEnv.length === 0) {
    return null;
  }

  const platform = options?.platform ?? process.platform;
  const cliName = platform === "win32" ? DEFAULT_CLI_NAME_WIN : DEFAULT_CLI_NAME_UNIX;
  const sep = platform === "win32" ? ";" : ":";
  const entries = pathEnv.split(sep);

  const fileExists = options?.exists ?? fs.existsSync;

  for (const entry of entries) {
    if (!entry || entry.length === 0) {
      continue;
    }
    const candidate = path.join(entry, cliName);
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}
