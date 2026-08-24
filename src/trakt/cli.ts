import * as fs from "node:fs";
import * as path from "node:path";
import { getTraktCliPath } from "../config/config.js";

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
