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

    const loaded = loadConfig({ configPath: cfgPath });
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

    const loaded = loadConfig({ configPath: cfgPath });
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

  describe("loadConfig with dataDir option", () => {
    it("uses dataDir for configPath and cacheDbPath", () => {
      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.configPath).toBe(path.join(tmpDir, "config.json"));
      expect(loaded.cacheDbPath).toBe(path.join(tmpDir, "trakt-cache.db"));
    });

    it("uses configPath with dataDir", () => {
      const customCfg = path.join(tmpDir, "custom.json");
      const loaded = loadConfig({ dataDir: tmpDir, configPath: customCfg });
      expect(loaded.configPath).toBe(customCfg);
      expect(loaded.cacheDbPath).toBe(path.join(tmpDir, "trakt-cache.db"));
    });

    it("derives dataDir from configPath when only configPath is supplied", () => {
      const customCfg = path.join(tmpDir, "custom.json");
      const loaded = loadConfig({ configPath: customCfg });
      expect(loaded.configPath).toBe(customCfg);
      expect(loaded.cacheDbPath).toBe(path.join(tmpDir, "trakt-cache.db"));
    });
  });

  describe("TTL validation", () => {
    it("returns default TTL when config has invalid JSON", () => {
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, "not valid json", "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.ttlSeconds).toBe(300);
    });

    it("returns default TTL when TTL is 0", () => {
      const cfg: AppConfig = { ttlSeconds: 0 };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.ttlSeconds).toBe(300);
    });

    it("returns default TTL when TTL is negative", () => {
      const cfg: AppConfig = { ttlSeconds: -10 };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.ttlSeconds).toBe(300);
    });

    it("returns default TTL when TTL is a string", () => {
      const cfg: AppConfig = { ttlSeconds: "300" as unknown as number };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.ttlSeconds).toBe(300);
    });

    it("returns default TTL when TTL is null", () => {
      const cfg: AppConfig = { ttlSeconds: null as unknown as number };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.ttlSeconds).toBe(300);
    });

    it("accepts valid TTL override", () => {
      const cfg: AppConfig = { ttlSeconds: 600 };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.ttlSeconds).toBe(600);
    });
  });

  describe("traktCliPath validation", () => {
    it("accepts string traktCliPath", () => {
      const cfg: AppConfig = { traktCliPath: "/usr/local/bin/trakt-cli" };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.traktCliPath).toBe("/usr/local/bin/trakt-cli");
    });

    it("returns null when traktCliPath is null", () => {
      const cfg: AppConfig = { traktCliPath: null };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.traktCliPath).toBeNull();
    });

    it("returns null when traktCliPath is undefined", () => {
      const cfg: AppConfig = { traktCliPath: undefined };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.traktCliPath).toBeNull();
    });

    it("returns null when traktCliPath is a number", () => {
      const cfg: AppConfig = { traktCliPath: 123 as unknown as string };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.traktCliPath).toBeNull();
    });

    it("returns null when traktCliPath is an array", () => {
      const cfg: AppConfig = { traktCliPath: ["/usr/bin/trakt"] as unknown as string };
      const cfgPath = path.join(tmpDir, "config.json");
      fs.writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

      const loaded = loadConfig({ dataDir: tmpDir });
      expect(loaded.traktCliPath).toBeNull();
    });
  });
});
