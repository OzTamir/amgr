export interface Logger {
  info: (msg: string) => void;
  verbose: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  success: (msg: string) => void;
}

export interface CommandOptions {
  verbose?: boolean | undefined;
  config?: string | undefined;
  dryRun?: boolean | undefined;
  force?: boolean | undefined;
  global?: boolean | undefined;
  position?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  author?: string | undefined;
}
