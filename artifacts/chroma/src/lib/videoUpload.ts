const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 0 || status >= 500;
}

async function withRetry(
  attempt: () => Promise<void>,
  isRetryable: (err: unknown) => boolean,
): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      await attempt();
      return;
    } catch (err) {
      lastError = err;
      if (i === MAX_ATTEMPTS - 1 || !isRetryable(err)) throw err;
      await sleep(RETRY_DELAY_MS * (i + 1));
    }
  }
  throw lastError;
}

class UploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function uploadViaPost(
  uploadURL: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file);
        xhr.open("POST", uploadURL, true);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else
            reject(
              new UploadError(`Upload failed (${xhr.status})`, xhr.status),
            );
        };
        xhr.onerror = () =>
          reject(new UploadError("Network error during upload", 0));
        xhr.send(formData);
      }),
    (err) => err instanceof UploadError && isRetryableStatus(err.status),
  );
}

export function uploadViaPut(
  uploadURL: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL, true);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else
            reject(
              new UploadError(`Upload failed (${xhr.status})`, xhr.status),
            );
        };
        xhr.onerror = () =>
          reject(new UploadError("Network error during upload", 0));
        xhr.send(file);
      }),
    (err) => err instanceof UploadError && isRetryableStatus(err.status),
  );
}
