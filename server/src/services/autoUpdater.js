const { exec, spawn } = require('child_process');
const config = require('../config');

let updateInterval = null;
let updateInProgress = false;
const gitBin = (config.autoUpdate.gitBin || 'git').trim();
const configuredNpmBin = (config.autoUpdate.npmBin || 'npm').trim();
let resolvedNpmBin = configuredNpmBin;
const preservePaths = Array.isArray(config.autoUpdate.preservePaths) ? config.autoUpdate.preservePaths : [];

function git(command) {
  return `"${gitBin}" ${command}`;
}

function npm(command) {
  return `"${resolvedNpmBin}" ${command}`;
}

function shellQuote(value) {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function run(command, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, shell: true, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      if (error) {
        error.command = command;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function tail(text, lines = 60) {
  const parts = String(text || '').trim().split(/\r?\n/);
  if (parts.length <= lines) return parts.join('\n');
  return parts.slice(-lines).join('\n');
}

function logCommandFailure(prefix, err) {
  console.error(prefix, err.message);
  if (err.command) {
    console.error(`[AutoUpdate] Failed command: ${err.command}`);
  }
  if (err.stdout && err.stdout.trim()) {
    console.error(`[AutoUpdate] stdout:\n${tail(err.stdout)}`);
  }
  if (err.stderr && err.stderr.trim()) {
    console.error(`[AutoUpdate] stderr:\n${tail(err.stderr)}`);
  }
}

async function resolveNpmBin() {
  const candidates = [];
  if (configuredNpmBin) candidates.push(configuredNpmBin);

  if (process.platform === 'win32') {
    for (const candidate of ['npm.cmd', 'C:\\Program Files\\nodejs\\npm.cmd']) {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  } else if (!candidates.includes('npm')) {
    candidates.push('npm');
  }

  let lastErr = null;
  for (const candidate of candidates) {
    try {
      await run(`"${candidate}" --version`, process.cwd());
      resolvedNpmBin = candidate;
      return;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('No working npm binary found');
}

async function resolveRepoRoot() {
  const { stdout } = await run(git('rev-parse --show-toplevel'), process.cwd());
  return stdout.trim();
}

async function resolveBranch(repoRoot) {
  if (config.autoUpdate.branch) return config.autoUpdate.branch;
  const { stdout } = await run(git('rev-parse --abbrev-ref HEAD'), repoRoot);
  return stdout.trim();
}

function restartCurrentProcess() {
  const args = process.argv.slice(1);
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function gitCleanCommand() {
  const excludes = preservePaths
    .map(path => String(path || '').trim())
    .filter(Boolean)
    .map(path => `-e ${shellQuote(path)}`)
    .join(' ');
  return git(`clean -fd ${excludes}`.trim());
}

async function discardLocalChanges(repoRoot) {
  await run(git('reset --hard HEAD'), repoRoot);
  await run(gitCleanCommand(), repoRoot);
}

async function checkForUpdates(repoRoot, branch) {
  if (updateInProgress) return;
  updateInProgress = true;

  try {
    const { stdout: status } = await run(git('status --porcelain'), repoRoot);
    if (status.trim()) {
      if (!config.autoUpdate.forceSync) {
        const changed = status
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .slice(0, 20);
        console.warn('[AutoUpdate] Local changes detected; skipping update check');
        console.warn(`[AutoUpdate] Changed files:\n${changed.join('\n')}`);
        return;
      }

      console.log('[AutoUpdate] Local changes detected; force sync enabled, discarding local repository changes');
      await discardLocalChanges(repoRoot);
    }

    await run(git(`fetch origin ${branch}`), repoRoot);
    const { stdout: behindOut } = await run(git(`rev-list --count HEAD..origin/${branch}`), repoRoot);
    const behind = Number.parseInt(behindOut.trim(), 10) || 0;

    if (behind <= 0) return;

    console.log(`[AutoUpdate] ${behind} update(s) found on origin/${branch}. Applying update...`);
    await run(git(`reset --hard origin/${branch}`), repoRoot);
    await run(gitCleanCommand(), repoRoot);

    if (config.autoUpdate.runNpmInstall) {
      console.log('[AutoUpdate] Running npm install...');
      await run(npm('install --include=dev'), repoRoot, {
        npm_config_production: 'false',
        npm_config_include: 'dev',
      });
    }

    if (config.autoUpdate.runWebBuild) {
      console.log('[AutoUpdate] Running npm run build...');
      try {
        await run(npm('run build'), repoRoot, {
          npm_config_production: 'false',
          npm_config_include: 'dev',
        });
      } catch (err) {
        const text = `${err?.message || ''}\n${err?.stderr || ''}\n${err?.stdout || ''}`;
        const missingVite = /'vite' is not recognized|vite(\.cmd)?\s*:\s*The term 'vite'/i.test(text);
        if (!missingVite) throw err;

        console.warn('[AutoUpdate] Build failed due to missing vite. Re-installing web dev dependencies and retrying build once...');
        await run(npm('install --workspace=web --include=dev'), repoRoot, {
          npm_config_production: 'false',
          npm_config_include: 'dev',
        });
        await run(npm('run build'), repoRoot, {
          npm_config_production: 'false',
          npm_config_include: 'dev',
        });
      }
    }

    console.log('[AutoUpdate] Update applied successfully');
    if (config.autoUpdate.exitOnUpdate) {
      if (config.autoUpdate.selfRestart) {
        console.log('[AutoUpdate] Starting replacement process');
        restartCurrentProcess();
      }
      console.log('[AutoUpdate] Exiting process for restart');
      setTimeout(() => process.exit(0), 500);
    }
  } catch (err) {
    logCommandFailure('[AutoUpdate] Update check failed:', err);
  } finally {
    updateInProgress = false;
  }
}

async function startAutoUpdater() {
  if (!config.autoUpdate.enabled) return;
  if (updateInterval) return;

  try {
    await run(git('--version'), process.cwd());
    await resolveNpmBin();
    console.log(`[AutoUpdate] Using npm binary: ${resolvedNpmBin}`);

    const repoRoot = await resolveRepoRoot();
    const branch = await resolveBranch(repoRoot);
    const minutes = Math.max(1, Number(config.autoUpdate.intervalMinutes || 5));
    const intervalMs = minutes * 60 * 1000;

    console.log(`[AutoUpdate] Enabled. Checking origin/${branch} every ${minutes} minute(s)`);
    await checkForUpdates(repoRoot, branch);
    updateInterval = setInterval(() => {
      checkForUpdates(repoRoot, branch);
    }, intervalMs);
  } catch (err) {
    logCommandFailure('[AutoUpdate] Could not start updater:', err);
    console.error('[AutoUpdate] Ensure Git/NPM are in PATH or set GIT_BIN/NPM_BIN in .env');
    console.error('[AutoUpdate] Example: GIT_BIN=C:\\Program Files\\Git\\cmd\\git.exe');
  }
}

module.exports = { startAutoUpdater };
