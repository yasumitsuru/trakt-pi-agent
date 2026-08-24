import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIST_ENTRY = fileURLToPath(
  new URL("../../dist/index.js", import.meta.url),
);

function runNode(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, _reject) => {
    execFile("node", args, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode: err.code ?? null });
        return;
      }
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 });
    });
  });
}

describe("foundation-entrypoint", () => {
  it("imports without error", async () => {
    const { stdout, exitCode } = await runNode([DIST_ENTRY]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
  });

  it("exits cleanly", async () => {
    const { exitCode } = await runNode([DIST_ENTRY]);
    expect(exitCode).toBe(0);
  });

  it("writes nothing to stdout", async () => {
    const { stdout } = await runNode([DIST_ENTRY]);
    expect(stdout).toBe("");
  });
});
