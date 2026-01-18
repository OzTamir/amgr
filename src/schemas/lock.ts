import { z } from 'zod';

export const LockFileSchema = z.object({
  version: z.string(),
  created: z.string(),
  lastSynced: z.string(),
  files: z.array(z.string()),
});

export type LockFileInput = z.infer<typeof LockFileSchema>;
