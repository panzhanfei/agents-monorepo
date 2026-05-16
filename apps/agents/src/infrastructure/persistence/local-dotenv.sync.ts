import fs from "node:fs";

/** 在保留其余行的前提下，更新或追加指定 KEY= 行（用于同步到 `apps/agents/.env`）。 */
export const upsertLocalDotenv = (
  filePath: string,
  vars: Record<string, string>,
): void => {
  const keys = new Set(Object.keys(vars));
  let lines: string[] = [];
  if (fs.existsSync(filePath)) {
    lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  }
  const seen = new Set<string>();
  const out = lines.map((line) => {
    const t = line.trim();
    if (t === "" || t.startsWith("#")) return line;
    const eq = t.indexOf("=");
    if (eq < 1) return line;
    const k = t.slice(0, eq).trim();
    if (!keys.has(k)) return line;
    seen.add(k);
    return `${k}=${vars[k]}`;
  });
  for (const k of keys) {
    if (!seen.has(k)) {
      out.push(`${k}=${vars[k]}`);
    }
  }
  fs.writeFileSync(filePath, out.join("\n").replace(/\n+$/, "") + "\n", "utf8");
};
