const form = document.getElementById('setupForm');
const output = document.getElementById('output');
const statusBadge = document.getElementById('status');
const runButton = document.getElementById('runButton');
const languageSelect = document.getElementById('langSelect');
const baseFolderInput = form.querySelector('input[name="baseFolderName"]');
const branchInput = form.querySelector('input[name="branch"]');
const commitMessageInput = form.querySelector('input[name="commitMessage"]');
const originUrlInput = form.querySelector('input[name="originUrl"]');
const submoduleRepoInput = form.querySelector('input[name="submoduleRepo"]');
const submodulePathInput = form.querySelector('input[name="submodulePath"]');
const gitUsernameInput = form.querySelector('input[name="gitUsername"]');
const submodulesContainer = document.getElementById('submodulesContainer');
const addSubmoduleButton = document.getElementById('addSubmodule');
const gitTokenInput = form.querySelector('input[name="gitToken"]');
const tokenToggleButton = document.querySelector('[data-toggle-token]');
const pushInput = form.querySelector('input[name="push"]');
const tabButtons = document.querySelectorAll('[data-tab]');
const guideModal = document.getElementById('guideModal');
const guideCloseButtons = document.querySelectorAll('[data-guide-close]');
const guideCloseButton = guideModal ? guideModal.querySelector('.modal-close') : null;
let autoSubmodulePath = '';
let autoBaseFolder = '';
let currentLang = getDefaultLanguage();
let currentStatus = 'idle';
const MAX_SUBMODULES = 5;
let currentTab = 'setup';

const translations = {
  ja: {
    documentTitle: 'サブモジュール工房 | Git 自動化コンソール',
    appName: 'サブモジュール工房',
    langLabel: 'Language',
    eyebrow: 'Git 自動化コンソール',
    title: 'Git サブモジュールセットアップ',
    subhead:
      'ユーザーのホームディレクトリ配下にフォルダを生成し、指定のリポジトリをクローンしてサブモジュール登録します。',
    'label.baseFolder': 'ベースフォルダ名 (ホーム直下)',
    'placeholder.baseFolder': 'my-workspace',
    'hint.baseFolderExample': '例: <code>my-workspace</code>',
    'hint.baseFolderAuto': '空欄の場合はリポジトリ名から自動生成されます。',
    'label.submodulePath': 'サブモジュール追加先 (ベースフォルダ内の相対パス)',
    'placeholder.submodulePath': 'my-submodule',
    'hint.submodulePathExample': '例: <code>my-submodule</code> (<code>my-workspace</code> 内に作成)',
    'hint.submodulePathAuto': '空欄の場合はリポジトリ名から自動設定されます。',
    'label.submoduleRepo': 'サブモジュールのリポジトリURL',
    'placeholder.submoduleRepo': 'https://github.com/your/repo',
    'label.commitMessage': 'コミットメッセージ',
    'label.branch': 'ブランチ',
    'label.originUrl': 'サブモジュール追加先のリポジトリURL',
    'placeholder.originUrl': 'https://github.com/your/repo',
    'hint.originUrl': '指定すると clone してからサブモジュールを追加します。',
    'label.gitUsername': '認証ユーザー名',
    'placeholder.gitUsername': 'your-username',
    'hint.authStorage': 'メールアドレスは使用できません。',
    'label.gitToken': '認証トークン',
    'placeholder.gitToken': 'ghp_***',
    'hint.gitToken': 'ログには表示せず、設定ファイルにも保存しません。',
    'toggle.initRepo': 'Git リポジトリが無い場合は初期化する',
    'toggle.runCommit': 'コミットまで実行する',
    'toggle.push': 'origin に push する (認証が必要)',
    'action.runButton': 'セットアップ実行',
    'action.showToken': 'トークンを表示',
    'action.hideToken': 'トークンを非表示',
    'action.hint': '処理中はログが下に表示されます。',
    'output.title': '実行ログ',
    'tab.setup': 'セットアップ',
    'tab.guide': '使い方',
    'guide.title': '使い方',
    'guide.close': '使い方を閉じる',
    'guide.content':
      '<ol class="guide-list"><li>サブモジュールのリポジトリURLを入力</li><li>必要ならベースフォルダ名とパスを調整</li><li>push する場合は認証ユーザー名とトークンを入力</li><li>セットアップ実行をクリック</li><li>ログを確認して必要なら再実行</li></ol><p class="guide-note">SSH を使う場合は認証ユーザー名を空欄のままでも動きます。</p><p class="guide-note">トークン作成 (GitHub):</p><ol class="guide-list"><li>GitHub の Settings を開く</li><li>Developer settings -> Personal access tokens を開く</li><li>Tokens (classic) か Fine-grained tokens を作成</li><li>repo 権限を付与して発行</li><li>この画面のトークン欄に入力</li></ol><p class="guide-note">入力は再読込でリセットされます。</p>',
    'status.idle': '待機中',
    'status.running': '実行中',
    'status.success': '完了',
    'status.error': '失敗',
    'log.placeholder': 'ここにログが表示されます。',
    'log.running': 'サーバーでコマンドを実行しています...',
  },
  en: {
    documentTitle: 'Submodule Forge | Git Automation Console',
    appName: 'Submodule Forge',
    langLabel: 'Language',
    eyebrow: 'Git Automation Console',
    title: 'Git Submodule Setup',
    subhead:
      'Generate a folder under the home directory, clone the specified repository, and register it as a submodule.',
    'label.baseFolder': 'Base Folder Name (under home)',
    'placeholder.baseFolder': 'my-workspace',
    'hint.baseFolderExample': 'Example: <code>my-workspace</code>',
    'hint.baseFolderAuto': 'If empty, it will be automatically generated from the repository name.',
    'label.submodulePath': 'Submodule Path (relative to base folder)',
    'placeholder.submodulePath': 'my-submodule',
    'hint.submodulePathExample': 'Example: <code>my-submodule</code> (Created inside <code>my-workspace</code>)',
    'hint.submodulePathAuto': 'If empty, it will be automatically set from the repository name.',
    'label.submoduleRepo': 'Submodule Repository URL',
    'placeholder.submoduleRepo': 'https://github.com/your/repo',
    'label.commitMessage': 'Commit Message',
    'label.branch': 'Branch',
    'label.originUrl': 'Target Repository URL',
    'placeholder.originUrl': 'https://github.com/your/repo',
    'hint.originUrl': 'If specified, clones the repository before adding the submodule.',
    'label.gitUsername': 'Git Username',
    'placeholder.gitUsername': 'your-username',
    'hint.authStorage': 'Email addresses cannot be used.',
    'label.gitToken': 'Git Token',
    'placeholder.gitToken': 'ghp_***',
    'hint.gitToken': 'Not displayed in logs and not saved in configuration files.',
    'toggle.initRepo': "Initialize Git repository if it doesn't exist",
    'toggle.runCommit': 'Run commit',
    'toggle.push': 'Push to origin (Authentication required)',
    'action.runButton': 'Run Setup',
    'action.showToken': 'Show Token',
    'action.hideToken': 'Hide Token',
    'action.hint': 'Execution logs will be displayed below.',
    'output.title': 'Execution Log',
    'tab.setup': 'Setup',
    'tab.guide': 'Guide',
    'guide.title': 'Guide',
    'guide.close': 'Close Guide',
    'guide.content':
      '<ol class="guide-list"><li>Enter the submodule repository URL</li><li>Adjust the base folder name and path if needed</li><li>If you plan to push, enter your auth username and token</li><li>Click Run Setup</li><li>Check the log and re-run if needed</li></ol><p class="guide-note">If using SSH, you can leave the auth username blank.</p><p class="guide-note">Token creation (GitHub):</p><ol class="guide-list"><li>Open GitHub Settings</li><li>Go to Developer settings -> Personal access tokens</li><li>Create a token (classic or fine-grained)</li><li>Grant repo scope and generate the token</li><li>Enter it into the token field on this screen</li></ol><p class="guide-note">Inputs reset on reload.</p>',
    'status.idle': 'Idle',
    'status.running': 'Running',
    'status.success': 'Complete',
    'status.error': 'Failed',
    'log.placeholder': 'Logs will appear here.',
    'log.running': 'Running commands on the server...',
  },
};

function t(key) {
  return translations[currentLang]?.[key] ?? translations.ja?.[key] ?? '';
}

function getDefaultLanguage() {
  // 起動時の優先順位を1.英語、2.日本語とするため、常に 'en' をデフォルトとして返します
  return 'en';
}

function applyTranslations(lang) {
  currentLang = translations[lang] ? lang : 'en';
  document.documentElement.lang = currentLang;
  document.title = t('documentTitle');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = t(el.dataset.i18n);
    if (value) {
      el.textContent = value;
    }
  });

  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const value = t(el.dataset.i18nHtml);
    if (value) {
      el.innerHTML = value;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const value = t(el.dataset.i18nPlaceholder);
    if (value) {
      el.setAttribute('placeholder', value);
    }
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const value = t(el.dataset.i18nAria);
    if (value) {
      el.setAttribute('aria-label', value);
    }
  });

  setStatus(currentStatus);

  const isPlaceholder = Object.values(translations).some(
    (entry) => entry['log.placeholder'] === output.textContent
  );
  if (isPlaceholder) {
    output.textContent = t('log.placeholder');
  }

  updateTokenToggleLabel();
}

function updateTokenToggleLabel() {
  if (!tokenToggleButton || !gitTokenInput) {
    return;
  }
  const isHidden = gitTokenInput.type === 'password';
  const label = t(isHidden ? 'action.showToken' : 'action.hideToken');
  tokenToggleButton.setAttribute('aria-label', label);
  tokenToggleButton.setAttribute('title', label);
  tokenToggleButton.setAttribute('aria-pressed', String(!isHidden));
  tokenToggleButton.classList.toggle('is-visible', !isHidden);
}

function deriveRepoName(repoValue) {
  const trimmed = (repoValue || '').trim();
  if (!trimmed) {
    return '';
  }

  const scpMatch = trimmed.match(/^[^@]+@[^:]+:(.+)$/);
  let pathPart = '';
  if (scpMatch) {
    pathPart = scpMatch[1];
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

function toHalfWidth(value) {
  return value.replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
}

function attachHalfWidth(input) {
  if (!input) {
    return;
  }
  input.addEventListener('input', () => {
    const current = input.value;
    const normalized = toHalfWidth(current);
    if (normalized !== current) {
      const cursor = input.selectionStart;
      input.value = normalized;
      if (cursor !== null) {
        input.setSelectionRange(cursor, cursor);
      }
    }
  });
}

function syncSubmodulePath() {
  if (!submoduleRepoInput || !submodulePathInput) {
    return;
  }
  const repoName = deriveRepoName(submoduleRepoInput.value);
  submodulePathInput.value = repoName;
  autoSubmodulePath = repoName;
}

function deriveBaseFolderName() {
  if (originUrlInput) {
    const fromOrigin = deriveRepoName(originUrlInput.value);
    if (fromOrigin) {
      return fromOrigin;
    }
  }
  if (submoduleRepoInput) {
    return deriveRepoName(submoduleRepoInput.value);
  }
  return '';
}

function syncBaseFolderName() {
  if (!baseFolderInput) {
    return;
  }
  const desired = deriveBaseFolderName();
  baseFolderInput.value = desired;
  autoBaseFolder = desired;
}

function addSubmoduleRow() {
  if (!submodulesContainer) return;
  const extraRows = submodulesContainer.querySelectorAll('.submodule-row-extra').length;
  if (extraRows >= MAX_SUBMODULES - 1) return;

  const div = document.createElement('div');
  div.className = 'submodule-row-extra';
  div.style.display = 'contents';
  div.innerHTML = `
    <div class="field">
      <span data-i18n="label.submoduleRepo"></span>
      <div class="input-row">
        <input type="text" name="submoduleRepo" data-i18n-placeholder="placeholder.submoduleRepo">
        <button type="button" class="token-toggle remove-submodule" style="font-size: 1.5rem;" title="Remove">×</button>
      </div>
    </div>
    <label class="field">
      <span data-i18n="label.submodulePath"></span>
      <input type="text" name="submodulePath" data-i18n-placeholder="placeholder.submodulePath">
      <small data-i18n-html="hint.submodulePathExample"></small>
    </label>
  `;
  submodulesContainer.appendChild(div);

  const repoIn = div.querySelector('input[name="submoduleRepo"]');
  const pathIn = div.querySelector('input[name="submodulePath"]');
  attachHalfWidth(repoIn);
  attachHalfWidth(pathIn);

  repoIn.addEventListener('input', () => {
    const repoName = deriveRepoName(repoIn.value);
    pathIn.value = repoName;
    syncBaseFolderName();
  });

  div.querySelector('.remove-submodule').addEventListener('click', () => {
    div.remove();
    if (addSubmoduleButton) addSubmoduleButton.style.display = 'inline-flex';
  });

  applyTranslations(currentLang);
  if (submodulesContainer.querySelectorAll('.submodule-row-extra').length >= MAX_SUBMODULES - 1) {
    if (addSubmoduleButton) addSubmoduleButton.style.display = 'none';
  }
}

function setActiveTab(tab) {
  currentTab = tab;
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tab;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  if (tab === 'guide') {
    if (guideModal) {
      guideModal.hidden = false;
      document.body.classList.add('modal-open');
      if (guideCloseButton) {
        guideCloseButton.focus();
      }
    }
  } else if (guideModal) {
    guideModal.hidden = true;
    document.body.classList.remove('modal-open');
  }
}

function resetUiState() {
  form.reset();
  if (submodulesContainer) {
    submodulesContainer.querySelectorAll('.submodule-row-extra').forEach(el => el.remove());
  }
  if (addSubmoduleButton) addSubmoduleButton.style.display = 'inline-flex';
  runButton.disabled = false;
  autoSubmodulePath = '';
  autoBaseFolder = '';
  currentStatus = 'idle';
  if (pushInput) {
    pushInput.checked = true;
  }
  if (gitTokenInput) {
    gitTokenInput.type = 'password';
  }
  const initialLang = getDefaultLanguage();
  if (languageSelect) {
    languageSelect.value = initialLang;
  }
  applyTranslations(initialLang);
  output.textContent = t('log.placeholder');
  setStatus('idle');
  syncBaseFolderName();
  syncSubmodulePath();
  updateTokenToggleLabel();
  setActiveTab('setup');
}

function setStatus(state, text) {
  currentStatus = state;
  statusBadge.className = `status ${state}`;
  statusBadge.textContent = text || t(`status.${state}`);
}

function collectFormData() {
  const formData = new FormData(form);
  const data = {};

  // サブモジュール以外の基本フィールドを収集
  formData.forEach((value, key) => {
    if (key !== 'submoduleRepo' && key !== 'submodulePath') {
      data[key] = value;
    }
  });

  // 全てのサブモジュール入力を取得して配列化（最初の一つ目もここに含まれる）
  const submoduleRepos = formData.getAll('submoduleRepo');
  const submodulePaths = formData.getAll('submodulePath');

  data.submodules = submoduleRepos.map((repo, i) => ({
    repo: repo.trim(),
    path: (submodulePaths[i] || '').trim()
  })).filter(s => s.repo !== '');

  // チェックボックスの状態を明示的にセット
  data.initRepo = !!form.initRepo?.checked;
  data.runCommit = !!form.runCommit?.checked;
  data.push = !!form.push?.checked;

  return data;
}

if (submoduleRepoInput && submodulePathInput) {
  syncBaseFolderName();
  syncSubmodulePath();
  submoduleRepoInput.addEventListener('input', () => syncSubmodulePath());
}

if (originUrlInput) {
  originUrlInput.addEventListener('input', () => syncBaseFolderName());
}

if (submoduleRepoInput) {
  submoduleRepoInput.addEventListener('input', () => syncBaseFolderName());
}

[
  baseFolderInput,
  submodulePathInput,
  submoduleRepoInput,
  originUrlInput,
  branchInput,
  commitMessageInput,
  gitUsernameInput,
  gitTokenInput,
].forEach((input) => attachHalfWidth(input));

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveTab(button.dataset.tab || 'setup');
  });
});

if (addSubmoduleButton) {
  addSubmoduleButton.addEventListener('click', (e) => {
    e.preventDefault();
    addSubmoduleRow();
  });
}

if (tokenToggleButton && gitTokenInput) {
  tokenToggleButton.addEventListener('click', () => {
    gitTokenInput.type = gitTokenInput.type === 'password' ? 'text' : 'password';
    updateTokenToggleLabel();
    gitTokenInput.focus();
  });
}

guideCloseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveTab('setup');
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && currentTab === 'guide') {
    setActiveTab('setup');
  }
});

if (languageSelect) {
  languageSelect.addEventListener('change', () => {
    applyTranslations(languageSelect.value);
  });
}

window.addEventListener('pageshow', () => {
  resetUiState();
});

resetUiState();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  runButton.disabled = true;
  setStatus('running');
  output.textContent = t('log.running');

  try {
    const payload = collectFormData();
    const response = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    const logs = result.logs || [];
    if (logs.length === 0 && result.error) {
      logs.push(result.error);
    }

    output.textContent = logs.join('\n\n');

    if (response.ok && result.ok) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  } catch (error) {
    output.textContent = String(error);
    setStatus('error');
  } finally {
    runButton.disabled = false;
  }
});
