#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';

function nowIso() {
  return new Date().toISOString();
}

function toRunId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function formatCommand(cmd, args) {
  return [cmd, ...args].join(' ');
}

async function runStep({ stepName, scriptPath, scriptArgs, cwd, runDir }) {
  const startedAt = nowIso();
  const startedMs = Date.now();
  const logPath = path.join(runDir, `${stepName}.log`);
  const cmd = process.execPath;
  const args = [scriptPath, ...scriptArgs];
  const commandText = formatCommand('node', [scriptPath, ...scriptArgs]);

  const header = [
    `# step: ${stepName}`,
    `# startedAt: ${startedAt}`,
    `# command: ${commandText}`,
    '',
  ].join('\n');
  await fs.writeFile(logPath, header, 'utf8');

  const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

  return await new Promise((resolve) => {
    const append = async (chunk, streamName) => {
      const text = chunk.toString();
      const prefixed = text
        .split(/\r?\n/)
        .map((line) => (line ? `[${streamName}] ${line}` : ''))
        .join('\n');
      if (prefixed) {
        await fs.appendFile(logPath, `${prefixed}\n`, 'utf8');
      }
      if (streamName === 'stdout') {
        process.stdout.write(text);
      } else {
        process.stderr.write(text);
      }
    };

    child.stdout.on('data', (chunk) => {
      append(chunk, 'stdout').catch(() => {});
    });
    child.stderr.on('data', (chunk) => {
      append(chunk, 'stderr').catch(() => {});
    });

    child.on('close', async (exitCode) => {
      const endedAt = nowIso();
      const endedMs = Date.now();
      const status = exitCode === 0 ? 'success' : 'failed';
      const footer = [
        '',
        `# endedAt: ${endedAt}`,
        `# durationMs: ${endedMs - startedMs}`,
        `# exitCode: ${exitCode}`,
        `# status: ${status}`,
        '',
      ].join('\n');
      await fs.appendFile(logPath, footer, 'utf8');

      resolve({
        stepName,
        status,
        exitCode,
        startedAt,
        endedAt,
        durationMs: endedMs - startedMs,
        command: commandText,
        logPath,
      });
    });
  });
}

function buildSteps(options, cwd) {
  const scriptsDir = path.join(cwd, 'scripts');
  const steps = [];

  steps.push({
    stepName: '01-validate',
    scriptPath: path.join(scriptsDir, 'validate-wordbank.mjs'),
    scriptArgs: ['--input', options.input, '--maxIssues', String(options.maxIssues)],
  });

  const importArgs = ['--input', options.input];
  if (options.rootsHierarchy) {
    importArgs.push('--rootsHierarchy', options.rootsHierarchy);
  }
  if (options.output) {
    importArgs.push('--output', options.output);
  }
  if (options.importNoClean) {
    importArgs.push('--clean=false');
  }
  steps.push({
    stepName: '02-import',
    scriptPath: path.join(scriptsDir, 'import-rootflow-wordbank.mjs'),
    scriptArgs: importArgs,
  });

  if (!options.skipShard) {
    const shardArgs = ['--mode', options.shardMode];
    if (options.shardMode === 'batch') {
      shardArgs.push('--batchSize', String(options.batchSize));
    }
    if (options.shardNoClean) {
      shardArgs.push('--clean=false');
    }
    steps.push({
      stepName: '03-shard',
      scriptPath: path.join(scriptsDir, 'slice-wordbank-shards.mjs'),
      scriptArgs: shardArgs,
    });
  }

  return steps;
}

async function main() {
  const parsed = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      rootsHierarchy: { type: 'string' },
      output: { type: 'string', short: 'o' },
      shardMode: { type: 'string', default: 'alpha' },
      batchSize: { type: 'string', default: '40' },
      maxIssues: { type: 'string', default: '200' },
      skipShard: { type: 'boolean', default: false },
      importNoClean: { type: 'boolean', default: false },
      shardNoClean: { type: 'boolean', default: false },
      logsDir: { type: 'string', default: 'logs/wordbank-pipeline' },
    },
    allowPositionals: true,
  });

  const inputArg = parsed.values.input || parsed.positionals[0];
  if (!inputArg) {
    throw new Error('missing input file. use --input <path-to-json-or-jsonl>');
  }

  const shardMode = String(parsed.values.shardMode || 'alpha').toLowerCase();
  if (shardMode !== 'alpha' && shardMode !== 'batch') {
    throw new Error(`unsupported shardMode "${shardMode}". use "alpha" or "batch".`);
  }

  const cwd = process.cwd();
  const runId = toRunId();
  const logsRoot = path.resolve(cwd, parsed.values.logsDir);
  const runDir = path.join(logsRoot, runId);
  await ensureDir(runDir);

  const options = {
    input: inputArg,
    rootsHierarchy: parsed.values.rootsHierarchy || '',
    output: parsed.values.output || '',
    shardMode,
    batchSize: Math.max(1, Number(parsed.values.batchSize) || 40),
    maxIssues: Math.max(1, Number(parsed.values.maxIssues) || 200),
    skipShard: parsed.values.skipShard,
    importNoClean: parsed.values.importNoClean,
    shardNoClean: parsed.values.shardNoClean,
  };

  const steps = buildSteps(options, cwd);
  const summary = {
    runId,
    startedAt: nowIso(),
    endedAt: '',
    status: 'running',
    failedStep: '',
    options,
    steps: [],
    summaryPath: path.join(runDir, 'summary.json'),
  };

  console.log(`[pipeline] runId: ${runId}`);
  console.log(`[pipeline] logs: ${runDir}`);

  for (const step of steps) {
    console.log(`[pipeline] starting ${step.stepName}`);
    const result = await runStep({ ...step, cwd, runDir });
    summary.steps.push(result);
    if (result.status !== 'success') {
      summary.status = 'failed';
      summary.failedStep = result.stepName;
      summary.endedAt = nowIso();
      await writeJson(summary.summaryPath, summary);
      await writeJson(path.join(logsRoot, 'latest.json'), {
        runId,
        status: summary.status,
        summaryPath: summary.summaryPath,
        failedStep: summary.failedStep,
      });
      console.error(`[pipeline] failed at ${result.stepName}`);
      process.exitCode = 1;
      return;
    }
  }

  summary.status = 'success';
  summary.endedAt = nowIso();
  await writeJson(summary.summaryPath, summary);
  await writeJson(path.join(logsRoot, 'latest.json'), {
    runId,
    status: summary.status,
    summaryPath: summary.summaryPath,
    failedStep: '',
  });

  console.log('[pipeline] success');
  console.log(`[pipeline] summary: ${summary.summaryPath}`);
}

main().catch((error) => {
  console.error(`[pipeline] failed: ${error.message}`);
  process.exitCode = 1;
});
