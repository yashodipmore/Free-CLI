/**
 * @free-cli/cli — Doctor Command
 *
 * Environment diagnostics — checks API keys, dependencies,
 * and configuration health. Reports issues clearly.
 */

import chalk from 'chalk';
import { getApiKey, getAllConfig } from '../storage/config.js';
import { GroqProvider } from '../llm/groq.js';
import { VERSION, getConfigDir, getDataDir, getOSName } from '@free-cli/core';

interface DiagnosticResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
}

/**
 * Run all diagnostics and print results.
 */
export async function doctorCommand(): Promise<void> {
  console.error('');
  console.error(chalk.bold.cyan('  ⚡ Free-CLI Doctor'));
  console.error(chalk.gray(`  Version: ${VERSION}\n`));

  const results: DiagnosticResult[] = [];

  // Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1), 10);
  results.push({
    name: 'Node.js',
    status: nodeMajor >= 18 ? 'ok' : 'error',
    message: nodeMajor >= 18
      ? `${nodeVersion} (supported)`
      : `${nodeVersion} (requires Node.js 18+)`,
  });

  // OS
  results.push({
    name: 'Operating System',
    status: 'ok',
    message: getOSName(),
  });

  // Config directory
  results.push({
    name: 'Config Directory',
    status: 'ok',
    message: getConfigDir(),
  });

  // Data directory
  results.push({
    name: 'Data Directory',
    status: 'ok',
    message: getDataDir(),
  });

  // Groq API key
  const groqKey = await getApiKey('groq');
  if (groqKey) {
    results.push({
      name: 'Groq API Key',
      status: 'ok',
      message: `Configured (ending in ...${groqKey.slice(-4)})`,
    });

    // Test Groq connectivity
    try {
      const provider = new GroqProvider();
      const available = await provider.isAvailable();
      results.push({
        name: 'Groq Connectivity',
        status: available ? 'ok' : 'error',
        message: available ? 'API reachable' : 'Cannot reach Groq API',
      });
    } catch {
      results.push({
        name: 'Groq Connectivity',
        status: 'warn',
        message: 'Could not verify connection',
      });
    }
  } else {
    results.push({
      name: 'Groq API Key',
      status: 'error',
      message: 'Not configured — run "fcli config" to set up',
    });
  }

  // Optional keys
  const tavilyKey = await getApiKey('tavily');
  results.push({
    name: 'Tavily API Key',
    status: tavilyKey ? 'ok' : 'warn',
    message: tavilyKey ? 'Configured (web search enabled)' : 'Not set (web search disabled)',
  });

  // keytar availability
  try {
    await import('keytar');
    results.push({
      name: 'OS Keychain (keytar)',
      status: 'ok',
      message: 'Available — API keys stored securely',
    });
  } catch {
    results.push({
      name: 'OS Keychain (keytar)',
      status: 'warn',
      message: 'Not available — keys stored in config file',
    });
  }

  // Configuration
  const config = getAllConfig();
  results.push({
    name: 'Default Model',
    status: 'ok',
    message: config.defaultModel,
  });

  results.push({
    name: 'Approval Mode',
    status: 'ok',
    message: config.approvalMode,
  });

  // Print results
  const icons = { ok: chalk.green('✓'), warn: chalk.yellow('⚠'), error: chalk.red('✗') };

  for (const result of results) {
    console.error(`  ${icons[result.status]} ${chalk.bold(result.name)}: ${result.message}`);
  }

  const errors = results.filter((r) => r.status === 'error');
  const warnings = results.filter((r) => r.status === 'warn');

  console.error('');
  if (errors.length > 0) {
    console.error(chalk.red(`  ${errors.length} error(s) found. Fix them to use Free-CLI.`));
  } else if (warnings.length > 0) {
    console.error(chalk.yellow(`  ${warnings.length} warning(s), but everything essential is working.`));
  } else {
    console.error(chalk.green('  All checks passed! Free-CLI is ready to use.'));
  }
  console.error('');
}
