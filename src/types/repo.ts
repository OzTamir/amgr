export interface UseCaseDefinition {
  description: string;
}

export interface RepoConfig {
  $schema?: string | undefined;
  name: string;
  description?: string | undefined;
  version?: string | undefined;
  author?: string | undefined;
  'use-cases': Record<string, UseCaseDefinition>;
}
