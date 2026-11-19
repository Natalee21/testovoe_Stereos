import fs from "node:fs";
import path from "node:path";
import type { LoadedFile } from "../lib/types";

export function loadDir(relativeDir: string): LoadedFile[] {
  const dir = path.join(process.cwd(), relativeDir);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".txt"))
    .sort()
    .map((fileName) => ({
      fileName,
      text: fs.readFileSync(path.join(dir, fileName), "utf8"),
    }));
}

export function loadSamples(): LoadedFile[] {
  return loadDir("samples/documents");
}
