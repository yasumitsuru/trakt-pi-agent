import * as os from "node:os";
import * as pathPosix from "node:path/posix";
import * as pathWin32 from "node:path/win32";

const APP_NAME = "trakt-pi-agent";

export interface DataDirectoryResolver {
  (platform: NodeJS.Platform, env: Record<string, string | undefined>, homeDir: string): string;
}

/**
 * Pure resolver for the cross-platform data directory.
 * Accepts platform, environment, and home directory so tests can
 * simulate any target platform without mutating process.platform.
 */
export function resolveDataDirectory(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
  homeDir: string,
): string {
  switch (platform) {
    case "win32": {
      const localAppData = env.LOCALAPPDATA || pathWin32.join(homeDir, "AppData", "Local");
      return pathWin32.join(localAppData, APP_NAME);
    }

    case "darwin": {
      return pathPosix.join(homeDir, "Library", "Application Support", APP_NAME);
    }

    case "linux": {
      const xdgData = env.XDG_DATA_HOME;
      if (xdgData) {
        return pathPosix.join(xdgData, APP_NAME);
      }
      return pathPosix.join(homeDir, ".local", "share", APP_NAME);
    }

    default:
      // Fallback: use XDG_DATA_HOME if set, otherwise ~/.local/share
      const xdgData = env.XDG_DATA_HOME;
      if (xdgData) {
        return pathPosix.join(xdgData, APP_NAME);
      }
      return pathPosix.join(homeDir, ".local", "share", APP_NAME);
  }
}

/**
 * Resolve the application data directory using the actual process environment.
 */
export function getDataDirectory(): string {
  const platform = process.platform;
  const env = process.env as Record<string, string | undefined>;
  const homeDir = os.homedir() || "";
  return resolveDataDirectory(platform, env, homeDir);
}
