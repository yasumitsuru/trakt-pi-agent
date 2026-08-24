import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSpawn = vi.fn();
vi.mock("child_process", () => ({
  spawn: (...a: unknown[]) => mockSpawn(...a),
}));

const { executeTraktCli } = await import("../../src/trakt/cli");

function makeChild() {
  const closeCb: ((code: number) => void)[] = [];
  const errorCb: ((err: Error) => void)[] = [];
  const stdoutData: ((buf: Buffer) => void)[] = [];
  const stderrData: ((buf: Buffer) => void)[] = [];
  const stdinData: ((...a: unknown[]) => void)[] = [];

  const killSpy = vi.fn(() => {
    // kill triggers error event which rejects exitPromise
    for (const cb of errorCb) cb(new Error("killed"));
  });

  const child: {
    stdout: { on: ReturnType<typeof vi.fn> };
    stderr: { on: ReturnType<typeof vi.fn> };
    stdin: { on: ReturnType<typeof vi.fn> };
    on: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
  } = {
    stdout: {
      on: vi.fn((ev: string, cb: (b: Buffer) => void) => {
        stdoutData.push(cb);
        return child;
      }),
    },
    stderr: {
      on: vi.fn((ev: string, cb: (b: Buffer) => void) => {
        stderrData.push(cb);
        return child;
      }),
    },
    stdin: {
      on: vi.fn((ev: string, cb: (...a: unknown[]) => void) => {
        stdinData.push(cb);
        return child;
      }),
    },
    on: vi.fn((ev: string, cb: (...a: unknown[]) => void) => {
      if (ev === "close") closeCb.push(cb as (code: number) => void);
      if (ev === "error") errorCb.push(cb as (err: Error) => void);
      return child;
    }),
    kill: killSpy,
  };

  return {
    child,
    closeCb,
    errorCb,
    stdoutData,
    stderrData,
    stdinData,
    killSpy,
  };
}

describe("executeTraktCli", () => {
  beforeEach(() => {
    mockSpawn.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. JSON success
  it("parses successful stdout JSON", async () => {
    const payload = { ok: true, data: { id: 42 } };
    const { child } = makeChild();
    mockSpawn.mockReturnValue(child);

    const result = executeTraktCli("/fake/trakt-cli", ["--status"]);

    // Simulate stdout data
    child.stdout.on.mock.calls[0][1](Buffer.from(JSON.stringify(payload)));
    // Simulate close with code 0
    child.on.mock.calls[0][1](0);

    expect(await result).toEqual(payload);
  });

  // 2. non-zero exit
  it("throws on non-zero exit code", async () => {
    const { child } = makeChild();
    mockSpawn.mockReturnValue(child);

    const p = executeTraktCli("/fake/trakt-cli", ["--status"]);
    child.stdout.on.mock.calls[0][1](Buffer.from("{}"));
    child.stderr.on.mock.calls[0][1](Buffer.from("some error"));
    child.on.mock.calls[0][1](1);

    await expect(p).rejects.toThrow(/exited with code 1/);
  });

  // 3. timeout
  it("throws on timeout", async () => {
    vi.useFakeTimers();
    const { child } = makeChild();
    mockSpawn.mockReturnValue(child);

    const p = executeTraktCli("/fake/trakt-cli", ["--status"], { timeoutMs: 50 });

    // Advance past timeout — mock kill will reject via errorCb
    vi.advanceTimersByTime(100);

    await expect(p).rejects.toThrow(/timed out/);
    vi.useRealTimers();
  });

  // 4. kill on timeout
  it("kills child process on timeout", async () => {
    vi.useFakeTimers();
    const { child, killSpy } = makeChild();
    mockSpawn.mockReturnValue(child);

    const p = executeTraktCli("/fake/trakt-cli", ["--status"], { timeoutMs: 50 });

    vi.advanceTimersByTime(100);

    await expect(p).rejects.toThrow(/timed out/);

    expect(killSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  // 5. stderr sanitization
  it("sanitizes credential patterns from stderr", async () => {
    const { child } = makeChild();
    mockSpawn.mockReturnValue(child);

    const p = executeTraktCli("/fake/trakt-cli", ["--status"]);
    child.stdout.on.mock.calls[0][1](Buffer.from("{}"));
    child.stderr.on.mock.calls[0][1](Buffer.from("token=abc123 key=secret"));
    child.on.mock.calls[0][1](1);

    await expect(p).rejects.toThrow(/\*\*\*/);
  });

  // 6. literal argument stays one element
  it("keeps literal argument like 'hello; whoami' as one array element", async () => {
    const { child } = makeChild();
    mockSpawn.mockReturnValue(child);

    const p = executeTraktCli("/fake/trakt-cli", ["search", "hello; whoami"]);
    child.stdout.on.mock.calls[0][1](Buffer.from("{}"));
    child.on.mock.calls[0][1](0);

    await p;

    expect(mockSpawn).toHaveBeenCalledWith(
      "/fake/trakt-cli",
      ["search", "hello; whoami"],
      expect.any(Object),
    );
  });

  // 7. shell is not enabled
  it("does not enable shell", async () => {
    const { child } = makeChild();
    mockSpawn.mockReturnValue(child);

    const p = executeTraktCli("/fake/trakt-cli", ["--status"]);
    child.stdout.on.mock.calls[0][1](Buffer.from("{}"));
    child.on.mock.calls[0][1](0);

    await p;

    const callOpts = mockSpawn.mock.calls[0][2] as Record<string, unknown>;
    expect(callOpts.shell).toBe(false);
  });
});
