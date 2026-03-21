#!/usr/bin/env node

import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';

const version = process.env.TASKMASTER_AI_VERSION || '0.43.0';
const projectRoot = process.env.TASKMASTER_PROJECT_ROOT || process.cwd();
const logFile = process.env.TASKMASTER_MCP_STDERR_LOG;

const filteredMessages = new Set([
  JSON.stringify({
    method: 'notifications/message',
    params: {
      data: { message: 'MCP Server connected: undefined' },
      level: 'info',
    },
    jsonrpc: '2.0',
  }),
  JSON.stringify({
    method: 'notifications/message',
    params: {
      data: {
        message: 'MCP session missing required sampling capabilities, providers not registered',
      },
      level: 'info',
    },
    jsonrpc: '2.0',
  }),
]);

const child = spawn(
  'npx',
  ['-y', `--package=task-master-ai@${version}`, 'task-master-ai'],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  },
);

process.stdin.pipe(child.stdin);

const stderrStream = logFile
  ? createWriteStream(logFile, { flags: 'a' })
  : process.stderr;

child.stderr.pipe(stderrStream);

let stdoutBuffer = '';

child.stdout.on('data', (chunk) => {
  stdoutBuffer += chunk.toString();

  while (true) {
    const newlineIndex = stdoutBuffer.indexOf('\n');
    if (newlineIndex === -1) {
      break;
    }

    const line = stdoutBuffer.slice(0, newlineIndex);
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

    if (!filteredMessages.has(line.trim())) {
      process.stdout.write(`${line}\n`);
    }
  }
});

child.stdout.on('end', () => {
  const trailing = stdoutBuffer.trim();
  if (trailing && !filteredMessages.has(trailing)) {
    process.stdout.write(stdoutBuffer);
  }
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  const message = `[taskmaster-mcp-proxy] Failed to launch task-master-ai: ${error.message}\n`;
  stderrStream.write(message);
  process.exit(1);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
