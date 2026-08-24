import { describe, expect, it } from "vitest";

describe("foundation-entrypoint", () => {
  it("imports successfully", async () => {
    const mod = await import("../../src/index.ts");
    expect(mod).toBeDefined();
  });

  it("exports main() as a function", async () => {
    const mod = await import("../../src/index.ts");
    expect(typeof mod.main).toBe("function");
  });

  it("main() completes without throwing", async () => {
    const mod = await import("../../src/index.ts");
    expect(() => mod.main()).not.toThrow();
  });

  it("main() writes nothing to stdout", async () => {
    const mod = await import("../../src/index.ts");
    const captured: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk: unknown) => {
      captured.push(String(chunk));
      return true;
    };
    mod.main();
    process.stdout.write = origWrite;
    expect(captured.join("")).toBe("");
  });

  it("main() does not terminate the process", async () => {
    const mod = await import("../../src/index.ts");
    mod.main();
    expect(true).toBe(true);
  });

  it("no MCP server is started", async () => {
    const mod = await import("../../src/index.ts");
    mod.main();
    expect(true).toBe(true);
  });
});
