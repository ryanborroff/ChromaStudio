export function fileChecksum(file: File, signal: AbortSignal, onProgress: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker(new URL("./fileChecksum.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => { worker.terminate(); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => { cleanup(); reject(new Error("Could not calculate the original's checksum")); };
    worker.onmessage = (event: MessageEvent<{ progress?: number; digest?: string; error?: string }>) => {
      if (event.data.progress !== undefined) onProgress(event.data.progress);
      if (event.data.digest) { cleanup(); resolve(event.data.digest); }
      if (event.data.error) { cleanup(); reject(new Error(event.data.error)); }
    };
    worker.postMessage(file);
  });
}
