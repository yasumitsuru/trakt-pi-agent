import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { getTtlSeconds, loadConfig, type AppConfig } from "../../src/config/config";

function createTmpDir(): string {
  const tmpDir = path.join(os.tmpdir(), `trakt-test-${crypto.randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

describe("ttl", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("returns default TTL of 300 when no config exists", () => {
    const ttl = getTtlSeconds();
    expect(ttl).toBe(300);
  });

  it("returns TTL from valid config.json", () => {
    const cfg: AppConfig = { ttlSeconds: 600 };
    const cfgPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

    const loaded = loadConfig(cfgPath);
    expect(loaded.ttlSeconds).toBe(600);
  });

  it("uses defaults when config.json is absent", () => {
    const cfgPath = path.join(tmpDir, "nonexistent.json");
    const loaded = loadConfig(cfgPath);
    expect(loaded.ttlSeconds).toBe(300);
    expect(loaded.traktCliPath).toBeNull();
  });

  it("returns configured TraktCLI path", () => {
    const cfg: AppConfig = { traktCliPath: "/usr/local/bin/trakt-cli" };
    const cfgPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

    const loaded = loadConfig(cfgPath);
    expect(loaded.traktCliPath).toBe("/usr/local/bin/trakt-cli");
  });

  it("returns null traktCliPath when not configured", () => {
    const cfg: AppConfig = {};
    const cfgPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

    const loaded = loadConfig(cfgPath);
    expect(loaded.traktCliPath).toBeNull();
  });

  it("derives cacheDbPath from data directory", () => {
    const cfgPath = path.join(tmpDir, "config.json");
    const loaded = loadConfig(cfgPath);
    expect(loaded.cacheDbPath).toContain("trakt-cache.db");
  });

  it("derives configPath from data directory", () => {
    const cfgPath = path.join(tmpDir, "config.json");
    const loaded = loadConfig(cfgPath);
    expect(loaded.configPath).toContain("config.json");
  });
});
