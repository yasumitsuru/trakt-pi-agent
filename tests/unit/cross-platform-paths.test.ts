import { describe, expect, it } from "vitest";
import { resolveDataDirectory } from "../../src/config/paths";

// We test the pure resolver directly so tests are cross-platform.
// We never change process.platform.

describe("cross-platform-paths", () => {
  it("resolves Windows LOCALAPPDATA path", () => {
    const result = resolveDataDirectory("win32", { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" }, "C:\\Users\\test");
    expect(result).toBe("C:\\Users\\test\\AppData\\Local\\trakt-pi-agent");
  });

  it("resolves Linux default path (~/.local/share)", () => {
    const result = resolveDataDirectory("linux", { HOME: "/home/test" }, "/home/test");
    expect(result).toBe("/home/test/.local/share/trakt-pi-agent");
  });

  it("resolves Linux XDG_DATA_HOME path", () => {
    const result = resolveDataDirectory("linux", { XDG_DATA_HOME: "/opt/data", HOME: "/home/test" }, "/home/test");
    expect(result).toBe("/opt/data/trakt-pi-agent");
  });

  it("resolves macOS Application Support path", () => {
    const result = resolveDataDirectory("darwin", { HOME: "/Users/test" }, "/Users/test");
    expect(result).toBe("/Users/test/Library/Application Support/trakt-pi-agent");
  });

  it("uses path.win32 on Windows even with forward slashes in LOCALAPPDATA", () => {
    const result = resolveDataDirectory("win32", { LOCALAPPDATA: "C:/Users/test/AppData/Local" }, "C:/Users/test");
    // Should still produce a valid Windows path
    expect(result).toContain("trakt-pi-agent");
  });

  it("produces a path that ends with the app name", () => {
    const windows = resolveDataDirectory("win32", { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" }, "C:\\Users\\test");
    const linux = resolveDataDirectory("linux", { HOME: "/home/test" }, "/home/test");
    const macos = resolveDataDirectory("darwin", { HOME: "/Users/test" }, "/Users/test");

    expect(windows.endsWith("trakt-pi-agent")).toBe(true);
    expect(linux.endsWith("trakt-pi-agent")).toBe(true);
    expect(macos.endsWith("trakt-pi-agent")).toBe(true);
  });
});
