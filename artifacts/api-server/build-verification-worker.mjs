import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(directory, "src/mediaVerificationWorker.ts")],
  outfile: path.join(directory, "dist/mediaVerificationWorker.mjs"),
  platform: "node",
  target: "node20",
  format: "esm",
  bundle: true,
  packages: "external",
  sourcemap: true,
});
