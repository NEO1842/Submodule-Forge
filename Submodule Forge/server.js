const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

let isRunning = false;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function safeJoin(base, target) {
  const targetPath = path.join(base, target);
  if (targetPath !== base && !targetPath.startsWith(base + path.sep)) {
    return null;
  }
  return targetPath;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large.'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', (error) => reject(error));
  });
}

function runGit(args, cwd, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        ...envOverrides,
      },
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function redactText(text, secrets) {
  return secrets.reduce((acc, secret) => {
    if (!secret) {
      return acc;
    }
    return acc.split(secret).join('***');
  }, text);
}

function formatGitCommand(args, secrets) {
  return redactText(`$ git ${args.join(' ')}`, secrets);
}

async function runGitLogged(args, cwd, logs, allowFailure = false, secrets = []) {
  logs.push(formatGitCommand(args, secrets));
  const result = await runGit(args, cwd);

  if (result.stdout.trim()) {
    logs.push(redactText(result.stdout.trimEnd(), secrets));
  }

  if (result.stderr.trim()) {
    logs.push(redactText(result.stderr.trimEnd(), secrets));
  }

  if (result.code !== 0 && !allowFailure) {
    throw new Error(`git ${args[0]} failed (exit ${result.code}).`);
  }

  return result;
}

function resolveInHome(homeDir, input, label) {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const normalized = trimmed.startsWith('~/') ? trimmed.slice(2) : trimmed;
  const resolved = path.resolve(homeDir, normalized);
  if (resolved !== homeDir && !resolved.startsWith(homeDir + path.sep)) {
    throw new Error(`${label} must stay inside the home directory.`);
  }

  return resolved;
}

function resolveInBase(baseDir, input, label) {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const resolved = path.resolve(baseDir, trimmed);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    throw new Error(`${label} must stay inside the base folder (git submodule cannot live outside).`);
  }

  return resolved;
}

function buildAuthArgs(username, token) {
  const args = [];
  const secrets = [];
  const safeUser = (username || '').trim();
  const authUser = token && !safeUser ? 'x-access-token' : safeUser;

  if (authUser) {
    args.push('-c', `credential.username=${authUser}`);
  }
  if (token && authUser) {
    const authHeader = Buffer.from(`${authUser}:${token}`).toString('base64');
    args.push('-c', `http.extraheader=AUTHORIZATION: basic ${authHeader}`);
    secrets.push(token, authHeader);
  }
  return { args, secrets };
}

async function hasCredentialHelper(cwd) {
  const result = await runGit(['config', '--get', 'credential.helper'], cwd);
  return result.code === 0 && result.stdout.trim().length > 0;
}

function deriveRepoName(repoUrl) {
  const trimmed = (repoUrl || '').trim();
  if (!trimmed) {
    return '';
  }

  let pathPart = '';
  const scpLikeMatch = trimmed.match(/^[^@]+@[^:]+:(.+)$/);
  if (scpLikeMatch) {
    pathPart = scpLikeMatch[1];
  } else {
    try {
      const parsed = new URL(trimmed);
      pathPart = parsed.pathname || '';
    } catch (error) {
      pathPart = trimmed;
    }
  }

  const cleaned = pathPart.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const segments = cleaned.split('/');
  const last = segments[segments.length - 1] || '';
  return last.replace(/\.git$/i, '');
}

async function handleSetup(req, res) {
  if (isRunning) {
    sendJson(res, 409, { ok: false, error: 'Another setup is running. Try again shortly.' });
    return;
  }

  isRunning = true;
  const logs = [];

  try {
    const body = await readJson(req);
    const homeDir = os.homedir();

    // 配列形式を優先し、無ければ単一形式から生成。最後に空のものを除外
    let submodules = Array.isArray(body.submodules) ? body.submodules : [];
    if (submodules.length === 0 && body.submoduleRepo) {
      submodules = [{ repo: body.submoduleRepo, path: body.submodulePath }];
    }

    // 有効なリポジトリURLがあるものだけを抽出
    submodules = submodules.filter(s => (s.repo || '').trim() !== '');

    if (submodules.length === 0) {
      throw new Error('Submodule repository URL is required. Please enter at least one URL.');
    }

    const originUrl = (body.originUrl || '').trim();
    const derivedBaseName = deriveRepoName(originUrl) || deriveRepoName(submodules[0].repo);
    if (!derivedBaseName) {
      throw new Error('Base folder name could not be derived. Provide a base folder name or a valid repo URL.');
    }
    const baseFolderName = (body.baseFolderName || '').trim() || derivedBaseName;
    const commitMessage = body.commitMessage || 'Add submodule';
    const branch = body.branch || 'main';
    const runCommit = body.runCommit !== false;
    const push = body.push === true;
    const initRepo = body.initRepo !== false;
    const gitUsername = (body.gitUsername || '').trim();
    const gitToken = (body.gitToken || '').trim();
    if (gitUsername.includes('@')) {
      throw new Error('Email addresses are not supported. Use your GitHub username.');
    }
    const auth = buildAuthArgs(gitUsername, gitToken);

    const baseDir = resolveInHome(homeDir, baseFolderName, 'Base folder');

    logs.push(`Home: ${homeDir}`);
    logs.push(`Base folder: ${baseDir}`);

    const baseExists = fs.existsSync(baseDir);
    if (baseExists && !fs.statSync(baseDir).isDirectory()) {
      throw new Error('Base folder must be a directory.');
    }

    if (!baseExists) {
      if (originUrl) {
        await runGitLogged([...auth.args, 'clone', originUrl, baseDir], homeDir, logs, false, auth.secrets);
      } else {
        fs.mkdirSync(baseDir, { recursive: true });
      }
    }

    const gitMarker = path.join(baseDir, '.git');
    if (!fs.existsSync(gitMarker)) {
      if (originUrl) {
        const entries = fs.readdirSync(baseDir);
        if (entries.length > 0) {
          throw new Error('Base folder exists but is not a git repo. Use an empty folder or remove existing files.');
        }
        await runGitLogged([...auth.args, 'clone', originUrl, '.'], baseDir, logs, false, auth.secrets);
      } else {
        if (!initRepo) {
          throw new Error('Base folder is not a git repository. Enable "Initialize repo" to create one.');
        }
        await runGitLogged(['init'], baseDir, logs);
        if (branch && branch !== 'master') {
          await runGitLogged(['branch', '-m', branch], baseDir, logs, true);
        }
      }
    }

    if (originUrl) {
      const originCheck = await runGitLogged(['remote', 'get-url', 'origin'], baseDir, logs, true);
      if (originCheck.code !== 0) {
        await runGitLogged(['remote', 'add', 'origin', originUrl], baseDir, logs);
      }
    }

    // 入力されたサブモジュールの数だけ、順番に同じプロセスを実行していく
    logs.push(`Total submodules found: ${submodules.length}. Starting sequential processing...`);

    for (let i = 0; i < submodules.length; i++) {
      const sub = submodules[i];
      const sRepo = sub.repo;
      const sPath = sub.path || deriveRepoName(sRepo) || 'submodule';
      const submoduleDir = resolveInBase(baseDir, sPath, `Submodule #${i + 1} path`);
      const submoduleRelative = path.relative(baseDir, submoduleDir);

      logs.push(`\n[Processing Submodule ${i + 1}/${submodules.length}]`);
      logs.push(`- URL: ${sRepo}`);
      logs.push(`- Path: ${submoduleRelative}`);

      if (!submoduleRelative || submoduleRelative === '.') {
        throw new Error(`Submodule folder (${sPath}) must not be base folder.`);
      }

      // すでに登録済みかチェック (config --file .gitmodules)
      let isExisting = false;
      if (fs.existsSync(path.join(baseDir, '.gitmodules'))) {
        const check = await runGit(['config', '--file', '.gitmodules', '--get', `submodule.${submoduleRelative}.path`], baseDir);
        if (check.code === 0) isExisting = true;
      }

      if (isExisting) {
        logs.push(`Submodule at ${submoduleRelative} is already in .gitmodules. Updating existing entry...`);
      } else {
        logs.push(`Adding new submodule: ${sRepo}`);
        const addArgs = [...auth.args, 'submodule', 'add'];
        if (fs.existsSync(submoduleDir)) addArgs.push('--force');
        addArgs.push(sRepo, submoduleRelative);
        await runGitLogged(addArgs, baseDir, logs, false, auth.secrets);
      }

      await runGitLogged(
        [...auth.args, 'submodule', 'update', '--init', '--recursive'],
        baseDir, logs, false, auth.secrets
      );
      await runGitLogged(['add', '.gitmodules'], baseDir, logs);
      await runGitLogged(['add', submoduleRelative], baseDir, logs);
      
      logs.push(`Submodule ${i + 1} processing finished.`);
    }

    if (runCommit) {
      const diff = await runGitLogged(['diff', '--cached', '--name-only'], baseDir, logs);
      if (diff.stdout.trim()) {
        await runGitLogged(['commit', '-m', commitMessage], baseDir, logs);
      } else {
        logs.push('No staged changes. Commit skipped.');
      }
    } else {
      logs.push('Commit disabled.');
    }

    if (push) {
      const originCheck = await runGitLogged(['remote', 'get-url', 'origin'], baseDir, logs, true);
      if (originCheck.code !== 0) {
        logs.push('origin remote is not configured. Push skipped.');
      } else {
        const originUrlValue = originCheck.stdout.trim();
        const isHttps = originUrlValue.startsWith('http://') || originUrlValue.startsWith('https://');
        const hasInlineToken = Boolean(gitToken);
        if (isHttps && !hasInlineToken && !(await hasCredentialHelper(baseDir))) {
          logs.push('No token or credential helper detected. Provide a token or use SSH. Push skipped.');
        } else {
          const pushArgs = [...auth.args, 'push', 'origin', branch];
          await runGitLogged(pushArgs, baseDir, logs, false, auth.secrets);
        }
      }
    } else {
      logs.push('Push disabled.');
    }

    sendJson(res, 200, { ok: true, logs });
  } catch (error) {
    logs.push(`Error: ${error.message}`);
    sendJson(res, 400, { ok: false, error: error.message, logs });
  } finally {
    isRunning = false;
  }
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(requestedPath).replace(/^([\\/]*\.\.)+/g, '');
  const filePath = safeJoin(PUBLIC_DIR, normalized);

  if (!filePath) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not Found');
      return;
    }
    const ext = path.extname(filePath);
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/setup') {
    handleSetup(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  sendText(res, 405, 'Method Not Allowed');
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${PORT}`);
});
