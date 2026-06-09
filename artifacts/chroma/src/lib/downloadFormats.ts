export const DOWNLOAD_FORMATS = [
  { value: "1080p", label: "1080p", hint: "Full HD" },
  { value: "720p", label: "720p", hint: "HD" },
  { value: "480p", label: "480p", hint: "SD" },
  { value: "360p", label: "360p", hint: "Mobile" },
  { value: "iphone", label: "iPhone", hint: "Mobile-optimized" },
] as const;

export type DownloadFormatValue = (typeof DOWNLOAD_FORMATS)[number]["value"];

export const DOWNLOAD_FORMAT_LABELS: Record<string, { label: string; hint: string }> =
  Object.fromEntries(DOWNLOAD_FORMATS.map((f) => [f.value, { label: f.label, hint: f.hint }]));
