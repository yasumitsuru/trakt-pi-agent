import * as fs from "node:fs";
import * as path from "node:path";
import { getDataDirectory } from "./paths.js";

export interface AppConfig {
  ttlSeconds?: number;
  traktCliPath?: string | null;
}

export interface LoadConfigOptions {
  dataDir?: string;
  configPath?: string;
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
 * @param options - Optional dataDir and/or configPath.
 */
export function loadConfig(options?: LoadConfigOptions): Config {
  let dataDir: string;
  let resolvedConfigPath: string;

  if (options?.dataDir) {
    dataDir = options.dataDir;
    resolvedConfigPath =
      options.configPath || path.join(dataDir, CONFIG_FILE_NAME);
  } else if (options?.configPath) {
    resolvedConfigPath = options.configPath;
    dataDir = path.dirname(resolvedConfigPath);
  } else {
    dataDir = getDataDirectory();
    resolvedConfigPath = path.join(dataDir, CONFIG_FILE_NAME);
  }

  let appConfig: AppConfig = {};
  try {
    const raw = fs.readFileSync(resolvedConfigPath, "utf8");
    appConfig = JSON.parse(raw) as AppConfig;
  } catch {
    // Config file absent or invalid — use defaults.
  }

  // Runtime TTL validation
  let ttl: number;
  const rawTtl = appConfig.ttlSeconds;
  if (
    typeof rawTtl === "number" &&
    Number.isFinite(rawTtl) &&
    rawTtl > 0
  ) {
    ttl = rawTtl;
  } else {
    ttl = DEFAULT_TTL;
  }

  // Runtime traktCliPath validation
  let traktCliPath: string | null;
  const rawCli = appConfig.traktCliPath;
  if (typeof rawCli === "string") {
    traktCliPath = rawCli;
  } else {
    traktCliPath = null;
  }

  const resolvedCacheDbPath = path.join(dataDir, CACHE_DB_NAME);

  return {
    ttlSeconds: ttl,
    traktCliPath,
    cacheDbPath: resolvedCacheDbPath,
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
