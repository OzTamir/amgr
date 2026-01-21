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

/** @deprecated Use ProfileMetadata instead */
export interface UseCaseMetadata {
  description: string;
  sources: string[];
}

/** @deprecated Use CombinedProfiles instead */
export type CombinedUseCases = Record<string, UseCaseMetadata>;

export interface SubProfileMetadata {
  description: string;
}

export interface ProfileMetadata {
  description: string;
  sources: string[];
  'sub-profiles'?: Record<string, SubProfileMetadata> | undefined;
}

export type CombinedProfiles = Record<string, ProfileMetadata>;
