// Copies the self-hosted Python runtime (Pyodide, WebAssembly) and the pure-Python wheels
// used by the Simulation Lab into public/pyodide/, so the site works offline and on
// GitHub Pages without any CDN or backend. Runs automatically before `dev` and `build`.
import {cpSync, existsSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pyodide');
const out = join(root, 'public', 'pyodide');
const files = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
if (!existsSync(join(src, 'pyodide.mjs'))) throw new Error('pyodide is not installed. Run `npm ci` first.');
rmSync(out, {recursive: true, force: true});
mkdirSync(join(out, 'wheels'), {recursive: true});
for (const f of files) cpSync(join(src, f), join(out, f));
const wheels = readdirSync(join(root, 'python', 'wheels')).filter(f => f.endsWith('.whl'));
for (const w of wheels) cpSync(join(root, 'python', 'wheels', w), join(out, 'wheels', w));
console.log(`Pyodide runtime + ${wheels.length} wheels copied to public/pyodide/`);
