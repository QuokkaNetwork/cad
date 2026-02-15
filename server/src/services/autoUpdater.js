const { exec, spawn } = require('child_process');
const config = require('../config');

let updateInterval = null;
let updateInProgress = false;
const gitBin = (config.autoUpdate.gitBin || 'git').trim();

function git(command) {
  return `"${gitBin}" ${command}`;
}

function run(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, shell: true }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
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

async function checkForUpdates(repoRoot, branch) {
  if (updateInProgress) return;
  updateInProgress = true;

  try {
    const { stdout: status } = await run(git('status --porcelain'), repoRoot);
    if (status.trim()) {
      const changed = status
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 20);
      console.warn('[AutoUpdate] Local changes detected; skipping update check');
      console.warn(`[AutoUpdate] Changed files:\n${changed.join('\n')}`);
      return;
    }

    await run(git(`fetch origin ${branch}`), repoRoot);
    const { stdout: behindOut } = await run(git(`rev-list --count HEAD..origin/${branch}`), repoRoot);
    const behind = Number.parseInt(behindOut.trim(), 10) || 0;

    if (behind <= 0) return;

    console.log(`[AutoUpdate] ${behind} update(s) found on origin/${branch}. Applying update...`);
    await run(git(`pull --ff-only origin ${branch}`), repoRoot);

    if (config.autoUpdate.runNpmInstall) {
      console.log('[AutoUpdate] Running npm install...');
      await run('npm install', repoRoot);
    }

    if (config.autoUpdate.runWebBuild) {
      console.log('[AutoUpdate] Running npm run build...');
      await run('npm run build', repoRoot);
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
    console.error('[AutoUpdate] Update check failed:', err.message);
  } finally {
    updateInProgress = false;
  }
}

async function startAutoUpdater() {
  if (!config.autoUpdate.enabled) return;
  if (updateInterval) return;

  try {
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
    console.error('[AutoUpdate] Could not start updater:', err.message);
    console.error('[AutoUpdate] Install Git and ensure it is in PATH, or set GIT_BIN in .env (e.g. C:\\Program Files\\Git\\cmd\\git.exe)');
  }
}

module.exports = { startAutoUpdater };
