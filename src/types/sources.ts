export const SOURCE_TYPE = {
  GIT: 'git',
  LOCAL: 'local',
} as const;

export type SourceType = (typeof SOURCE_TYPE)[keyof typeof SOURCE_TYPE];

export interface GitSource {
  type: 'git';
  url: string;
  name?: string | undefined;
}

export interface LocalSource {
  type: 'local';
  path: string;
  name?: string | undefined;
}

export type SourceObject = GitSource | LocalSource;

export type Source = SourceObject | string;

export interface ResolvedSource {
  type: SourceType;
  url?: string | undefined;
  path?: string | undefined;
  name?: string | undefined;
  localPath: string;
}

export interface UseCaseMetadata {
  description: string;
  sources: string[];
}

export type CombinedUseCases = Record<string, UseCaseMetadata>;
