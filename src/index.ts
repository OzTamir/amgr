import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sync } from './commands/sync.js';
import { init } from './commands/init.js';
import { configEdit } from './commands/config.js';
import { list } from './commands/list.js';
import { validate } from './commands/validate.js';
import { clean } from './commands/clean.js';
import { detach } from './commands/detach.js';
import { repoInit, repoAdd, repoRemove, repoList } from './commands/repo.js';
import {
  sourceAdd,
  sourceRemove,
  sourceList,
  sourceUpdate,
} from './commands/source.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PackageJson {
  version: string;
}

const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;

const program = new Command();

program
  .name('amgr')
  .description('Manage AI agent configurations across projects')
  .version(packageJson.version);

program
  .command('sync', { isDefault: true })
  .description('Synchronize agent configurations based on .amgr/config.json')
  .option('-n, --dry-run', 'Show what would be done without making changes')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <path>', 'Use a custom config file path')
  .option(
    '--replace',
    'Delete all tracked files before deploying (may cause conflicts in cloud-synced directories)'
  )
  .action(sync);

program
  .command('init')
  .description('Initialize a new .amgr/config.json configuration file')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <path>', 'Use a custom config file path')
  .action(init);

program
  .command('config')
  .description('Interactively edit the .amgr/config.json configuration file')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <path>', 'Use a custom config file path')
  .action(configEdit);

program
  .command('list')
  .description('List available profiles from configured sources')
  .option('-v, --verbose', 'Show targets and features as well')
  .action(list);

program
  .command('validate')
  .description('Validate the .amgr/config.json configuration file')
  .option('-v, --verbose', 'Show configuration summary')
  .option('-c, --config <path>', 'Use a custom config file path')
  .action(validate);

program
  .command('clean')
  .description('Remove all generated agent configuration files')
  .option('-n, --dry-run', 'Show what would be removed without making changes')
  .option('-v, --verbose', 'Enable verbose output')
  .action(clean);

program
  .command('detach')
  .description('Remove all amgr-created files and optionally the config')
  .option('-n, --dry-run', 'Show what would be done without making changes')
  .option('-v, --verbose', 'Enable verbose output')
  .action(detach);

const repoCommand = program.command('repo').description('Manage amgr repositories');

repoCommand
  .command('init')
  .description('Initialize a new amgr repository in the current directory')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--name <name>', 'Repository name')
  .option('--description <description>', 'Repository description')
  .option('--author <author>', 'Repository author')
  .action(repoInit);

repoCommand
  .command('add <name>')
  .description('Add a profile to the repository (e.g., "development" or "development:frontend")')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--description <description>', 'Profile description')
  .option('--nested', 'Create as a nested profile with sub-profiles')
  .action(repoAdd);

repoCommand
  .command('remove <name>')
  .description('Remove a profile from the repository (e.g., "development" or "development:frontend")')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(repoRemove);

repoCommand
  .command('list')
  .description('List profiles in the current repository')
  .option('-v, --verbose', 'Show additional details')
  .action(repoList);

const sourceCommand = program
  .command('source')
  .description('Manage rules sources for the project');

sourceCommand
  .command('add <url-or-path>')
  .description('Add a rules source (git URL or local path)')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-g, --global', 'Add as a global source (available to all projects)')
  .option('--position <index>', 'Insert at specific position (default: append)')
  .option('--name <name>', 'Optional alias for the source')
  .action(sourceAdd);

sourceCommand
  .command('remove <index-or-name>')
  .description('Remove a source from the config')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-g, --global', 'Remove from global sources')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(sourceRemove);

sourceCommand
  .command('list')
  .description('List configured sources and their status')
  .option('-v, --verbose', 'Show additional details')
  .option('-g, --global', 'Show only global sources')
  .action(sourceList);

sourceCommand
  .command('update')
  .description('Refresh all git sources')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-g, --global', 'Update only global sources')
  .action(sourceUpdate);

program.parse();
