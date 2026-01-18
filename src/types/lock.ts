export interface LockFile {
  version: string;
  created: string;
  lastSynced: string;
  files: string[];
}

export interface RemoveResult {
  removed: string[];
  failed: Array<{ file: string; error: string }>;
}
