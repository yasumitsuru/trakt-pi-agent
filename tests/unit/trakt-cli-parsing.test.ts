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

  it("returns Windows trakt-cli.exe when found in PATH", () => {
    const tmpDir = createTempDir();
    try {
      const binDir = path.join(tmpDir, "bin");
      fs.mkdirSync(binDir);
      writeFakeCli(binDir, "trakt-cli.exe");
      const result = discoverTraktCli({
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
      const pathSep = process.platform === "win32" ? ";" : ":";
      const result = discoverTraktCli({
        pathEnv: `${binDir1}${pathSep}${binDir2}`,
        platform: "win32",
      });
      expect(result).toBe(path.join(binDir2, "trakt-cli.exe"));
    } finally {
      cleanup(tmpDir);
    }
  });

  it("returns null when PATH is empty and no configured path", () => {
    const result = discoverTraktCli({ pathEnv: "", platform: "linux" });
    expect(result).toBeNull();
  });

  it("returns null when PATH entries contain no executable", () => {
    const tmpDir = createTempDir();
    try {
      const emptyDir = path.join(tmpDir, "empty");
      fs.mkdirSync(emptyDir);
      const result = discoverTraktCli({
        pathEnv: emptyDir,
        platform: "linux",
      });
      expect(result).toBeNull();
    } finally {
      cleanup(tmpDir);
    }
  });
});
