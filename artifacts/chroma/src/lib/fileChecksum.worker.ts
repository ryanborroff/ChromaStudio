import { sha256 } from "@noble/hashes/sha2.js";

// Hash in a worker with a fixed memory bound, including files resumed from R2.
self.onmessage = async (event: MessageEvent<File>) => {
  const file = event.data;
  const hash = sha256.create();
  try {
    const chunkSize = 8 * 1024 * 1024;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      hash.update(new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer()));
      self.postMessage({ progress: Math.min(offset + chunkSize, file.size) / file.size });
    }
    self.postMessage({ digest: Array.from(hash.digest(), (byte) => byte.toString(16).padStart(2, "0")).join("") });
  } catch {
    self.postMessage({ error: "Could not calculate the original's checksum" });
  } finally {
    hash.destroy();
  }
};
