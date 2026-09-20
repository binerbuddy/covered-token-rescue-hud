/**
 * Package the module into dist/module.zip alongside a copy of the manifest,
 * matching the layout Foundry expects from a release asset.
 *
 * Run with `npm run build`.
 */

import {execFileSync} from "node:child_process";
import {cpSync, mkdirSync, rmSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const staging = resolve(dist, "covered-token-rescue-hud");

/** Paths copied into the packaged module, relative to the repository root. */
const CONTENTS = ["module.json", "scripts", "styles", "lang", "README.md", "CHANGELOG.md", "LICENSE"];

rmSync(dist, {recursive: true, force: true});
mkdirSync(staging, {recursive: true});

for ( const entry of CONTENTS ) {
  cpSync(resolve(root, entry), resolve(staging, entry), {recursive: true});
}

cpSync(resolve(root, "module.json"), resolve(dist, "module.json"));
execFileSync("zip", ["-r", "-q", "module.zip", "covered-token-rescue-hud"], {cwd: dist, stdio: "inherit"});
rmSync(staging, {recursive: true, force: true});

console.log("Built dist/module.zip and dist/module.json");
