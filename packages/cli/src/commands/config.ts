/**
 * @free-cli/cli — Config Command
 *
 * Set up and manage API keys and user preferences.
 */

import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { setApiKey, getApiKey, setConfig, getConfig, resetConfig } from '../storage/config.js';
import { logger } from '../utils/logger.js';

/**
 * Run the config wizard — interactive API key and preferences setup.
 */
export async function configCommand(
  action: string | undefined,
  args: string[],
): Promise<void> {
  if (!action) {
    await configWizard();
    return;
  }

  switch (action) {
    case 'set':
      await configSet(args[0], args[1]);
      break;
    case 'get':
      configGet(args[0]);
      break;
    case 'reset':
      resetConfig();
      console.error(chalk.green('✓ Configuration reset to defaults.'));
      break;
    default:
      console.error(chalk.yellow(`Unknown config action: ${action}`));
      console.error(chalk.gray('Usage: fcli config [set <key> <value> | get <key> | reset]'));
  }
}

/**
 * Interactive setup wizard for first-run configuration.
 */
export async function configWizard(): Promise<void> {
  console.error('');
  console.error(chalk.bold.cyan('  ⚡ Free-CLI Setup'));
  console.error(chalk.gray('  Let\'s get you configured.\n'));

  // Groq API Key
  const existingKey = await getApiKey('groq');
  const keyStatus = existingKey ? chalk.green('(configured)') : chalk.yellow('(not set)');

  console.error(chalk.bold(`  Groq API Key ${keyStatus}`));
  console.error(chalk.gray('  Get a free key at: https://console.groq.com\n'));

  try {
    const groqKey = await input({
      message: 'Groq API Key:',
      default: existingKey ? '••••••••' + existingKey.slice(-4) : undefined,
      validate: (val) => {
        if (!val || val.startsWith('••••')) return true; // Keep existing
        if (!val.startsWith('gsk_')) return 'Groq API keys start with "gsk_"';
        if (val.length < 20) return 'API key seems too short';
        return true;
      },
    });

    if (groqKey && !groqKey.startsWith('••••')) {
      await setApiKey('groq', groqKey);
      console.error(chalk.green('  ✓ Groq API key saved securely.\n'));
    }

    // Default model
    const currentModel = getConfig('defaultModel');
    const model = await select({
      message: 'Default model:',
      choices: [
        {
          name: 'Llama 3.3 70B Versatile (best reasoning, recommended)',
          value: 'llama-3.3-70b-versatile',
        },
        {
          name: 'Llama 3.1 8B Instant (faster, lighter tasks)',
          value: 'llama-3.1-8b-instant',
        },
      ],
      default: currentModel,
    });
    setConfig('defaultModel', model);

    // Approval mode
    const approvalMode = await select({
      message: 'Tool approval mode:',
      choices: [
        { name: 'Ask before destructive operations (recommended)', value: 'ask' as const },
        { name: 'Auto-approve everything (yolo mode)', value: 'auto' as const },
        { name: 'Ask before every operation (strict)', value: 'strict' as const },
      ],
      default: getConfig('approvalMode'),
    });
    setConfig('approvalMode', approvalMode);

    console.error('');
    console.error(chalk.green('  ✓ Configuration saved!'));
    console.error(chalk.gray('  Run "fcli" to start chatting.\n'));
  } catch {
    console.error(chalk.gray('\n  Setup cancelled.'));
  }
}

/**
 * Set a specific config key.
 */
async function configSet(key: string | undefined, value: string | undefined): Promise<void> {
  if (!key || !value) {
    console.error(chalk.yellow('Usage: fcli config set <key> <value>'));
    return;
  }

  // Handle API key setting specially
  if (key === 'groqApiKey' || key === 'groq-api-key') {
    await setApiKey('groq', value);
    console.error(chalk.green('✓ Groq API key saved securely.'));
    return;
  }

  if (key === 'tavilyApiKey' || key === 'tavily-api-key') {
    await setApiKey('tavily', value);
    console.error(chalk.green('✓ Tavily API key saved securely.'));
    return;
  }

  if (key === 'openrouterApiKey' || key === 'openrouter-api-key') {
    await setApiKey('openrouter', value);
    console.error(chalk.green('✓ OpenRouter API key saved securely.'));
    return;
  }

  const validKeys = [
    'defaultModel',
    'approvalMode',
    'theme',
    'dashboardEnabled',
    'dashboardPort',
    'maxIterations',
    'contextWindowTokens',
    'telemetry',
  ];

  if (!validKeys.includes(key)) {
    console.error(chalk.yellow(`Unknown config key: ${key}`));
    console.error(chalk.gray(`Valid keys: ${validKeys.join(', ')}`));
    return;
  }

  // Type coercion for non-string values
  let typedValue: string | number | boolean = value;
  if (value === 'true') typedValue = true;
  if (value === 'false') typedValue = false;
  if (/^\d+$/.test(value)) typedValue = parseInt(value, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setConfig(key as any, typedValue as any);
  console.error(chalk.green(`✓ ${key} = ${typedValue}`));
}

/**
 * Get and display a specific config value.
 */
function configGet(key: string | undefined): void {
  if (!key) {
    // Show all config
    const allKeys = [
      'defaultModel',
      'approvalMode',
      'theme',
      'dashboardEnabled',
      'dashboardPort',
      'maxIterations',
      'contextWindowTokens',
      'telemetry',
    ] as const;

    console.error('');
    console.error(chalk.bold('  Current Configuration:'));
    for (const k of allKeys) {
      const val = getConfig(k);
      console.error(chalk.gray(`  ${k}: `) + chalk.white(String(val)));
    }
    console.error('');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = getConfig(key as any);
    console.error(`${key} = ${val}`);
  } catch {
    console.error(chalk.yellow(`Unknown config key: ${key}`));
  }
}
