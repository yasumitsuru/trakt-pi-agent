import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import { discoverTraktCli } from "../../src/trakt/cli";

function createTempDir(): string {
  return fs.mkdtempSync("trakt-cli-test-");
}

function writeFakeCli(dir: string, name: string): void {
  fs.writeFileSync(path.join(dir, name), "", { encoding: "utf8" });
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe("discoverTraktCli", () => {
  // ---- Explicit configured path tests ----

  it("returns configured explicit path when it exists", () => {
    const tmpDir = createTempDir();
    try {
      const fakePath = path.join(tmpDir, "trakt-cli.exe");
      fs.writeFileSync(fakePath, "", { encoding: "utf8" });
      const result = discoverTraktCli({ configuredPath: fakePath });
      expect(result).toBe(fakePath);
    } finally {
      cleanup(tmpDir);
    }
  });

  it("returns null when configured explicit path does not exist", () => {
    const result = discoverTraktCli({ configuredPath: "/nonexistent/fake/trakt-cli.exe" });
    expect(result).toBeNull();
  });

  // ---- Property-absent fallback tests (dependency injection) ----

  it("property absent configuredPath falls through to injected getConfiguredPath", () => {
    const injected = "/some/injected/path";
    const result = discoverTraktCli({
      getConfiguredPath: () => injected,
      exists: () => true,
      platform: "linux",
      pathEnv: "",
    });
    expect(result).toBe(injected);
  });

  it("configuredPath: null does not invoke production config lookup", () => {
    const result = discoverTraktCli({
      configuredPath: null,
      getConfiguredPath: () => {
        throw new Error("must not be called");
      },
      platform: "linux",
      pathEnv: "",
    });
    expect(result).toBeNull();
  });

  // ---- PATH lookup tests ----

  it("returns Windows trakt-cli.exe when found in PATH", () => {
    const tmpDir = createTempDir();
    try {
      const binDir = path.join(tmpDir, "bin");
      fs.mkdirSync(binDir);
      writeFakeCli(binDir, "trakt-cli.exe");
      const result = discoverTraktCli({
        configuredPath: null,
        pathEnv: binDir,
        platform: "win32",
      });
      expect(result).toBe(path.join(binDir, "trakt-cli.exe"));
    } finally {
      cleanup(tmpDir);
    }
  });

  it("returns Unix trakt-cli when found in PATH", () => {
    const tmpDir = createTempDir();
    try {
      const binDir = path.join(tmpDir, "bin");
      fs.mkdirSync(binDir);
      writeFakeCli(binDir, "trakt-cli");
      const result = discoverTraktCli({
        configuredPath: null,
        pathEnv: binDir,
        platform: "linux",
      });
      expect(result).toBe(path.join(binDir, "trakt-cli"));
    } finally {
      cleanup(tmpDir);
    }
  });

  it("returns first valid candidate in PATH order (later entry wins over earlier empty)", () => {
    const tmpDir = createTempDir();
    try {
      const binDir1 = path.join(tmpDir, "bin1");
      const binDir2 = path.join(tmpDir, "bin2");
      fs.mkdirSync(binDir1);
      fs.mkdirSync(binDir2);
      // Only second directory has the executable
      writeFakeCli(binDir2, "trakt-cli.exe");
      // Hardcoded semicolon for win32 simulation — independent of host OS
      const result = discoverTraktCli({
        configuredPath: null,
        pathEnv: `${binDir1};${binDir2}`,
        platform: "win32",
      });
      expect(result).toBe(path.join(binDir2, "trakt-cli.exe"));
    } finally {
      cleanup(tmpDir);
    }
  });

  it("returns null when PATH is empty and no configured path", () => {
    const result = discoverTraktCli({
      configuredPath: null,
      pathEnv: "",
      platform: "linux",
    });
    expect(result).toBeNull();
  });

  it("returns null when PATH entries contain no executable", () => {
    const tmpDir = createTempDir();
    try {
      const emptyDir = path.join(tmpDir, "empty");
      fs.mkdirSync(emptyDir);
      const result = discoverTraktCli({
        configuredPath: null,
        pathEnv: emptyDir,
        platform: "linux",
      });
      expect(result).toBeNull();
    } finally {
      cleanup(tmpDir);
    }
  });

  // ---- Regression tests for Blocker 1: config test isolation ----

  it("Windows PATH simulation uses semicolon regardless of host OS", () => {
    const tmpDir = createTempDir();
    try {
      const binDir1 = path.join(tmpDir, "bin1");
      const binDir2 = path.join(tmpDir, "bin2");
      fs.mkdirSync(binDir1);
      fs.mkdirSync(binDir2);
      writeFakeCli(binDir2, "trakt-cli.exe");
      // Hardcoded semicolon for win32 simulation — independent of host OS
      const result = discoverTraktCli({
        configuredPath: null,
        pathEnv: `${binDir1};${binDir2}`,
        platform: "win32",
      });
      expect(result).toBe(path.join(binDir2, "trakt-cli.exe"));
    } finally {
      cleanup(tmpDir);
    }
  });

  it("Unix PATH simulation uses colon regardless of host OS", () => {
    const tmpDir = createTempDir();
    try {
      const binDir1 = path.join(tmpDir, "bin1");
      const binDir2 = path.join(tmpDir, "bin2");
      fs.mkdirSync(binDir1);
      fs.mkdirSync(binDir2);
      writeFakeCli(binDir2, "trakt-cli");
      // Hardcoded colon for unix simulation — independent of host OS
      const result = discoverTraktCli({
        configuredPath: null,
        pathEnv: `${binDir1}:${binDir2}`,
        platform: "linux",
      });
      expect(result).toBe(path.join(binDir2, "trakt-cli"));
    } finally {
      cleanup(tmpDir);
    }
  });

  it("explicit configured valid path still wins over PATH", () => {
    const tmpDir = createTempDir();
    try {
      const binDir = path.join(tmpDir, "bin");
      fs.mkdirSync(binDir);
      writeFakeCli(binDir, "trakt-cli.exe");
      const fakeConfig = path.join(tmpDir, "configured-trakt-cli.exe");
      fs.writeFileSync(fakeConfig, "", { encoding: "utf8" });
      const result = discoverTraktCli({
        configuredPath: fakeConfig,
        pathEnv: binDir,
        platform: "win32",
      });
      expect(result).toBe(fakeConfig);
    } finally {
      cleanup(tmpDir);
    }
  });

  it("explicit invalid configured path returns null without falling back to PATH", () => {
    const tmpDir = createTempDir();
    try {
      const binDir = path.join(tmpDir, "bin");
      fs.mkdirSync(binDir);
      writeFakeCli(binDir, "trakt-cli.exe");
      const result = discoverTraktCli({
        configuredPath: "/nonexistent/configured/trakt-cli.exe",
        pathEnv: binDir,
        platform: "win32",
      });
      expect(result).toBeNull();
    } finally {
      cleanup(tmpDir);
    }
  });
});
