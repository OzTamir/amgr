/**
 * Validate command for amgr
 * Validates the .amgr/config.json without syncing
 */

import { loadConfig, validateConfig, getConfigPath, configExists } from '../lib/config.js';
import { createLogger } from '../lib/utils.js';

/**
 * Execute the validate command
 */
export async function validate(options = {}) {
  const projectPath = process.cwd();
  const logger = createLogger(options.verbose);

  try {
    // Check if config exists
    if (!configExists(projectPath, options.config)) {
      const configPath = getConfigPath(projectPath, options.config);
      logger.error(`No configuration file found at ${configPath}`);
      logger.info('Run "amgr init" to create one.');
      process.exit(1);
    }

    // Load config
    const configPath = getConfigPath(projectPath, options.config);
    logger.info(`Validating ${configPath}...`);

    let config;
    try {
      config = loadConfig(projectPath, options.config);
    } catch (e) {
      logger.error(e.message);
      process.exit(1);
    }

    // Validate config
    const errors = validateConfig(config);

    if (errors.length === 0) {
      logger.success('Configuration is valid');
      
      // Show summary in verbose mode
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
    logger.error(e.message);
    process.exit(1);
  }
}
