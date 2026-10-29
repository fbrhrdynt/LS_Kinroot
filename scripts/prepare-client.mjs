import { mkdirSync, copyFileSync, readdirSync } from "node:fs";
mkdirSync("public/kinroot-app", { recursive: true });
for (const f of readdirSync("src"))
  copyFileSync("src/" + f, "public/kinroot-app/" + f);
