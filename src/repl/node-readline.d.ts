// Minimal ambient declarations for the Node built-ins used by the CLI entry
// points (repl, debug). These avoid a hard dependency on @types/node while
// keeping the core library DOM/Node-agnostic. Only the surface actually used
// is declared.
declare module "node:readline" {
  export interface Interface {
    prompt(preserveCursor?: boolean): void;
    on(event: "line", listener: (line: string) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    close(): void;
  }
  export interface ReadLineOptions {
    input: any;
    output?: any;
    prompt?: string;
    completer?: (line: string) => [string[], string];
  }
  export function createInterface(options: ReadLineOptions): Interface;
}
