// Page-side client for the Python worker. One shared engine for every Simulation Lab model.
import {useSyncExternalStore} from 'react';
import type {ExportOutcome, FieldError, RequestBody, RunOutcome, WorkerResponse} from './protocol';

export type EngineState = {status: 'idle' | 'loading' | 'ready' | 'error'; version?: string; error?: string};
type Pending = {resolve: (v: unknown) => void; reject: (e: Error) => void};

class PythonEngine {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private ready: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  state: EngineState = {status: 'idle'};

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private set(state: EngineState) { this.state = state; this.listeners.forEach(fn => fn()); }

  private call<T>(msg: RequestBody): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {resolve: resolve as (v: unknown) => void, reject});
      this.worker!.postMessage({...msg, id});
    });
  }

  /** Start Pyodide (≈ 12 MB the first time, then cached by the browser). Safe to call repeatedly. */
  start(): Promise<void> {
    if (this.ready) return this.ready;
    this.set({status: 'loading'});
    this.ready = (async () => {
      if (typeof WebAssembly !== 'object' || typeof Worker === 'undefined') throw new Error('This browser does not support WebAssembly workers.');
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.data); else p.reject(new Error(e.data.error));
      };
      this.worker.onerror = e => { e.preventDefault(); this.fail(e.message || 'The Python worker could not start.'); };
      const base = new URL('pyodide/', document.baseURI).href;
      const info = await this.call<{version: string}>({type: 'init', base});
      this.set({status: 'ready', version: info.version});
    })().catch(err => { this.fail(err instanceof Error ? err.message : String(err)); throw err; });
    return this.ready;
  }

  private fail(message: string) {
    this.pending.forEach(p => p.reject(new Error(message)));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.set({status: 'error', error: message});
  }

  /** Retry after a failed start (e.g. the network dropped while downloading the runtime). */
  retry() { if (this.state.status !== 'error') return this.start(); this.ready = null; return this.start(); }

  /**
   * Run a model in Python. If the Python runtime cannot start, the model's JavaScript
   * fallback (same equations) is used and the result is labelled as such.
   */
  async run<T>(model: string, params: unknown, fallback?: (p: unknown) => RunOutcome<T>): Promise<RunOutcome<T>> {
    try {
      await this.start();
    } catch (err) {
      if (fallback) return fallback(params);
      throw err;
    }
    const out = await this.call<{ok: boolean; result?: T; errors?: FieldError[]; ms: number}>({type: 'run', model, params});
    return out.ok ? {ok: true, result: out.result as T, engine: 'python', ms: out.ms} : {ok: false, errors: out.errors ?? []};
  }

  /** Build the .xlsx with openpyxl inside Python and return its bytes. */
  async exportWorkbook(model: string, params: unknown): Promise<ExportOutcome> {
    await this.start();
    const out = await this.call<{ok: boolean; bytes?: Uint8Array; filename?: string; errors?: FieldError[]}>({type: 'export', model, params});
    return out.ok ? {ok: true, bytes: out.bytes!, filename: out.filename!} : {ok: false, errors: out.errors ?? []};
  }
}

export const python = new PythonEngine();
export function usePythonEngine(): EngineState { return useSyncExternalStore(python.subscribe, () => python.state); }

export function saveBytes(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
