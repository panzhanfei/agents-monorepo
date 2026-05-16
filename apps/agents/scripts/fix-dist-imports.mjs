import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fix `tsc` + `tsc-alias` output for Node ESM: barrel dirs (`./interfaces`, `./config`)
 * append `/index.js`; other extensionless relative imports append `.js`.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

/** Folder names that expose `index.js` (last path segment triggers `/index.js`). */
const barrels = new Set([
  "application",
  "config",
  "domain",
  "http",
  "infrastructure",
  "interfaces",
  "llm",
  "routes",
  "sse",
  "persistence",
  "runner",
  "setup",
  "entry-chat",
  "analyst-chat",
]);

const fixSpec = (spec) => {
  if (!spec.startsWith(".")) return spec;
  if (/\.(js|json|mjs|cjs)$/i.test(spec)) return spec;
  const norm = spec.replace(/\\/g, "/");
  const last = norm.split("/").filter(Boolean).at(-1) ?? "";
  if (barrels.has(last)) return `${spec}/index.js`;
  return `${spec}.js`;
};

const fixSource = (code) =>
  code.replace(/(\bfrom\s+)(["'])([^"']+)\2/g, (_, prefix, q, spec) => {
    const next = fixSpec(spec);
    return next === spec ? `${prefix}${q}${spec}${q}` : `${prefix}${q}${next}${q}`;
  });

const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".js")) {
      const before = fs.readFileSync(p, "utf8");
      const after = fixSource(before);
      if (after !== before) fs.writeFileSync(p, after);
    }
  }
};

walk(distDir);
