export const hasWindow = (): boolean => globalThis.window !== undefined;

export const hasDocument = (): boolean => globalThis.document !== undefined;

export const hasEventSource = (): boolean => globalThis.EventSource !== undefined;
