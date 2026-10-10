import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

it("hashes a large original in bounded slices with the same digest as Node", async () => {
  const bytes = Buffer.alloc(33 * 1024 * 1024 + 17, 123);
  const slices: number[] = [];
  const messages: { digest?: string; progress?: number }[] = [];
  const worker = { onmessage: null as unknown as (event: { data: unknown }) => Promise<void>, postMessage: (message: typeof messages[number]) => messages.push(message) };
  vi.stubGlobal("self", worker);
  // Keep the browser module outside the API's TypeScript compilation root.
  const workerModule = new URL("../../chroma/src/lib/fileChecksum.worker.ts", import.meta.url).pathname;
  await import(workerModule);
  await worker.onmessage({ data: {
    size: bytes.length,
    slice: (start: number, end: number) => {
      const chunk = bytes.subarray(start, end);
      slices.push(chunk.length);
      return { arrayBuffer: async () => chunk };
    },
  } });
  expect(Math.max(...slices)).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(messages.at(-1)?.digest).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(messages.at(-2)?.progress).toBe(1);
});
