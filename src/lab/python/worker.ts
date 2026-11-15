/// <reference lib="webworker" />
/// <reference types="vite/client" />
// Python engine worker: boots Pyodide (CPython compiled to WebAssembly) off the main thread,
// writes the python/simlab package into its virtual file system and answers JSON requests.
// Only registered model ids + JSON parameters are accepted; no user code is ever executed.
import type {PyodideAPI} from 'pyodide';
import {WHEELS, type WorkerRequest, type WorkerResponse} from './protocol';

// The Python sources are bundled as text at build time — python/simlab stays the single source.
const SOURCES = import.meta.glob('../../../python/simlab/**/*.py', {query: '?raw', import: 'default', eager: true}) as Record<string, string>;
const HOME = '/home/pyodide';

let runtime: Promise<PyodideAPI> | null = null;
let openpyxl: Promise<void> | null = null;
let indexURL = '';

async function boot(base: string): Promise<PyodideAPI> {
  indexURL = base;
  const {loadPyodide} = await import(/* @vite-ignore */ `${base}pyodide.mjs`) as {loadPyodide: (o: {indexURL: string}) => Promise<PyodideAPI>};
  const py = await loadPyodide({indexURL: base});
  for (const [path, code] of Object.entries(SOURCES)) {
    const file = `${HOME}/${path.slice(path.indexOf('simlab/'))}`;
    py.FS.mkdirTree(file.slice(0, file.lastIndexOf('/')));
    py.FS.writeFile(file, code);
  }
  py.runPython(`import sys\nif "${HOME}" not in sys.path: sys.path.insert(0, "${HOME}")\nimport simlab.bridge`);
  return py;
}

function bridge(py: PyodideAPI) { return py.pyimport('simlab.bridge') as {run: (m: string, p: string) => string; export: (m: string, p: string, path: string) => string; models: () => string}; }

async function handle(msg: WorkerRequest): Promise<WorkerResponse> {
  if (msg.type === 'init') {
    runtime ??= boot(msg.base);
    const py = await runtime;
    return {id: msg.id, ok: true, data: {version: py.runPython('import sys; sys.version.split()[0]') as string, models: JSON.parse(bridge(py).models()).models}};
  }
  if (!runtime) throw new Error('Python engine is not initialised.');
  const py = await runtime;
  const params = JSON.stringify(msg.params ?? {});
  if (msg.type === 'run') {
    const t = performance.now();
    const out = JSON.parse(bridge(py).run(msg.model, params));
    return {id: msg.id, ok: true, data: {...out, ms: performance.now() - t}};
  }
  // export: openpyxl is loaded the first time a workbook is requested.
  openpyxl ??= py.loadPackage(WHEELS.map(w => `${indexURL}wheels/${w}`)).then(() => undefined);
  await openpyxl;
  const path = `/tmp/${msg.model}-${msg.id}.xlsx`;
  const out = JSON.parse(bridge(py).export(msg.model, params, path));
  if (!out.ok) return {id: msg.id, ok: true, data: out};
  const bytes = py.FS.readFile(path) as Uint8Array;
  py.FS.unlink(path);
  return {id: msg.id, ok: true, data: {...out, bytes}, transfer: [bytes.buffer as ArrayBuffer]};
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    const res = await handle(e.data) as WorkerResponse & {transfer?: Transferable[]};
    const {transfer, ...payload} = res;
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(payload, transfer ?? []);
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({id: e.data.id, ok: false, error: err instanceof Error ? err.message : String(err)});
  }
};
