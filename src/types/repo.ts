/**
 * @deprecated Use ProfileDefinition instead. Kept for backwards compatibility.
 */
export interface UseCaseDefinition {
  description: string;
}

/**
 * Definition for a sub-profile within a nested profile.
 */
export interface SubProfileDefinition {
  description: string;
}

/**
 * Definition for a profile. Can be flat (no sub-profiles) or nested (with sub-profiles).
 * - Flat profile: Just has a description, content lives in `{profile}/.rulesync/`
 * - Nested profile: Has sub-profiles, content lives in `{profile}/{sub-profile}/.rulesync/`
 */
export interface ProfileDefinition {
  description: string;
  'sub-profiles'?: Record<string, SubProfileDefinition> | undefined;
}

/**
 * Repository configuration file (repo.json).
 * Supports both legacy `use-cases` and new `profiles` fields.
 */
export interface RepoConfig {
  $schema?: string | undefined;
  name: string;
  description?: string | undefined;
  version?: string | undefined;
  author?: string | undefined;
  /**
   * @deprecated Use `profiles` instead. Kept for backwards compatibility during migration.
   */
  'use-cases'?: Record<string, UseCaseDefinition> | undefined;
  /**
   * Registry of available profiles. Supports both flat and nested profiles.
   * - Flat profile: `{ "writing": { "description": "..." } }`
   * - Nested profile: `{ "development": { "description": "...", "sub-profiles": { "frontend": {...}, "backend": {...} } } }`
   */
  profiles?: Record<string, ProfileDefinition> | undefined;
}
