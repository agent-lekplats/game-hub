// Bygger varje spel i games.json och samlar allt i _site/ för GitHub Pages.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const site = join(root, "_site");
const games = JSON.parse(readFileSync(join(root, "games.json"), "utf8"));
const only = process.argv[2]; // valfritt: bygg bara en sökväg, t.ex. games/duell

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
cpSync(join(root, "hub"), site, { recursive: true });
cpSync(join(root, "games.json"), join(site, "games.json"));

for (const game of games) {
  for (const v of game.versions) {
    if (only && v.path !== only) continue;
    const dir = join(root, v.path);
    console.log(`\n=== ${v.path}`);
    const install = existsSync(join(dir, "package-lock.json")) ? "npm ci" : "npm install";
    execSync(`${install} --no-audit --no-fund`, { cwd: dir, stdio: "inherit" });
    execSync("npx vite build --base=./", { cwd: dir, stdio: "inherit" });
    cpSync(join(dir, "dist"), join(site, v.path), { recursive: true });
  }
}
console.log(`\nKlart: ${site}`);
