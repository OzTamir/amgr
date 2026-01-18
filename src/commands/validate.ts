import {
  loadConfig,
  validateConfig,
  getConfigPath,
  configExists,
} from '../lib/config.js';
import { createLogger } from '../lib/utils.js';
import type { CommandOptions } from '../types/common.js';

export async function validate(options: CommandOptions = {}): Promise<void> {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    if (!configExists(projectPath, options.config)) {
      const configPath = getConfigPath(projectPath, options.config);
      logger.error(`No configuration file found at ${configPath}`);
      logger.info('Run "amgr init" to create one.');
      process.exit(1);
    }

    const configPath = getConfigPath(projectPath, options.config);
    logger.info(`Validating ${configPath}...`);

    let config;
    try {
      config = loadConfig(projectPath, options.config);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(message);
      process.exit(1);
    }

    const errors = validateConfig(config);

    if (errors.length === 0) {
      logger.success('Configuration is valid');

      if (options.verbose) {
        console.log('\nConfiguration summary:');
        console.log(`  Targets: ${config.targets.join(', ')}`);
        console.log(`  Features: ${config.features.join(', ')}`);
        console.log(`  Use-cases: ${config['use-cases'].join(', ')}`);
        if (config.options) {
          console.log(`  Options: ${JSON.stringify(config.options)}`);
        }
      }
    } else {
      logger.error('Configuration validation failed:');
      for (const error of errors) {
        console.log(`  - ${error}`);
      }
      process.exit(1);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(message);
    process.exit(1);
  }
}
