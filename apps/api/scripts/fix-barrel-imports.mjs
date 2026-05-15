import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Post-processes `tsc` output for Node ESM:
 * 1. Bare barrel dirs (`./lib`, `../config`, …) → `./lib/index.js`, etc.
 * 2. Module subfolders under `models/`, `services/`, `routes/`, `views/`, `worker/` → `…/index.js`
 * 3. Other extensionless relative specifiers → append `.js` (e.g. `./httpLog` → `./httpLog.js`).
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

const barrels = new Set([
  "config",
  "controllers",
  "lib",
  "middleware",
  "models",
  "routes",
  "services",
  "queue",
  "worker",
  "views",
]);

/** `models/auth`, `services/task`, `routes/project-chat`, `views/runner-v1`, `worker/jobs`, … */
const nestedIndexLeaves = {
  models: new Set([
    "auth",
    "project",
    "project-chat",
    "task",
    "runner",
    "runner-v1",
    "ready",
    "dev",
  ]),
  services: new Set([
    "auth",
    "project",
    "project-chat",
    "task",
    "runner",
    "runner-v1",
    "ready",
    "dev",
  ]),
  routes: new Set([
    "auth",
    "health",
    "ready",
    "dev",
    "project",
    "project-chat",
    "task",
    "runner",
    "runner-v1",
    "agent",
    "events",
  ]),
  views: new Set([
    "health",
    "ready",
    "dev",
    "project",
    "task",
    "runner",
    "runner-v1",
    "project-chat",
    "agent",
    "events",
  ]),
  worker: new Set(["jobs"]),
  controllers: new Set([
    "auth",
    "health",
    "ready",
    "dev",
    "project",
    "project-chat",
    "task",
    "runner",
    "runner-v1",
    "agent",
    "events",
  ]),
  lib: new Set(["common", "auth", "agent", "runner"]),
};

const shouldUseNestedIndex = (norm) => {
  const segments = norm.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  const leaf = segments[segments.length - 1] ?? "";
  const parent = segments[segments.length - 2] ?? "";
  return Boolean(nestedIndexLeaves[parent]?.has(leaf));
};

const fixSpec = (spec) => {
  if (!spec.startsWith(".")) return spec;
  if (/\.(js|json|mjs|cjs)$/i.test(spec)) return spec;
  const norm = spec.replace(/\\/g, "/");
  if (shouldUseNestedIndex(norm)) return `${spec}/index.js`;
  const segments = norm.split("/");
  const last = segments[segments.length - 1] ?? "";
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
