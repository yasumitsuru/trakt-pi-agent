import * as fs from "node:fs";
import * as path from "node:path";
import { getDataDirectory } from "./paths.js";

export interface AppConfig {
  ttlSeconds?: number;
  traktCliPath?: string | null;
}

export interface Config {
  ttlSeconds: number;
  traktCliPath: string | null;
  cacheDbPath: string;
  configPath: string;
}

const DEFAULT_TTL = 300;
const CACHE_DB_NAME = "trakt-cache.db";
const CONFIG_FILE_NAME = "config.json";

/**
 * Load configuration from a config.json file.
 * @param configPath - Optional explicit path. Defaults to <data dir>/config.json.
 */
export function loadConfig(configPath?: string): Config {
  const dataDir = getDataDirectory();
  const resolvedConfigPath = configPath || path.join(dataDir, CONFIG_FILE_NAME);

  let appConfig: AppConfig = {};
  try {
    const raw = fs.readFileSync(resolvedConfigPath, "utf8");
    appConfig = JSON.parse(raw) as AppConfig;
  } catch {
    // Config file absent or invalid — use defaults.
  }

  return {
    ttlSeconds: appConfig.ttlSeconds ?? DEFAULT_TTL,
    traktCliPath: appConfig.traktCliPath ?? null,
    cacheDbPath: path.join(dataDir, CACHE_DB_NAME),
    configPath: resolvedConfigPath,
  };
}

/**
 * Get the default TTL in seconds.
 */
export function getTtlSeconds(): number {
  return loadConfig().ttlSeconds;
}

/**
 * Get the configured TraktCLI path, or null if not set.
 */
export function getTraktCliPath(): string | null {
  return loadConfig().traktCliPath;
}

/**
 * Get the cache database path.
 */
export function getCacheDbPath(): string {
  return loadConfig().cacheDbPath;
}

/**
 * Get the config file path.
 */
export function getConfigPath(): string {
  return loadConfig().configPath;
}
