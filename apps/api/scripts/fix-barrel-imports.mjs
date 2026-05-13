import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

const barrels = new Set(["config", "lib", "middleware", "routes", "queue", "jobs"]);

const fixSpec = (spec) => {
  if (!spec.startsWith(".")) return spec;
  if (spec.endsWith(".js")) return spec;
  const norm = spec.replace(/\\/g, "/");
  const segments = norm.split("/");
  const last = segments[segments.length - 1] ?? "";
  if (!barrels.has(last)) return spec;
  return `${spec}/index.js`;
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
