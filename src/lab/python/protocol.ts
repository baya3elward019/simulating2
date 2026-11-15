// Messages between the page and the Python worker, and the JSON shapes returned by simlab.bridge.
export const WHEELS = ['et_xmlfile-2.0.0-py3-none-any.whl', 'openpyxl-3.1.5-py2.py3-none-any.whl'];

export type WorkerRequest =
  | {id: number; type: 'init'; base: string}
  | {id: number; type: 'run' | 'export'; model: string; params: unknown};

/** A request before the client assigns its id (Omit that distributes over the union). */
export type RequestBody = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never;

export type WorkerResponse = {id: number; ok: true; data: unknown; transfer?: Transferable[]} | {id: number; ok: false; error: string};

/** A validation problem reported by Python (or the instant JS check), bilingual. */
export type FieldError = {field: string; en: string; ar: string};

export type RunOutcome<T> =
  | {ok: true; result: T; engine: 'python' | 'javascript'; ms: number}
  | {ok: false; errors: FieldError[]};

export type ExportOutcome = {ok: true; bytes: Uint8Array; filename: string} | {ok: false; errors: FieldError[]};
