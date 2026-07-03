const input = document.querySelector('#taskInput');
const submitButton = document.querySelector('#submitButton');
const draftStatus = document.querySelector('#draftStatus');
const publicUrl = document.querySelector('#publicUrl');
const outputBox = document.querySelector('#outputBox');
const historyList = document.querySelector('#historyList');
const drawer = document.querySelector('#fileDrawer');
const drawerTitle = document.querySelector('#drawerTitle');
const drawerClose = document.querySelector('#drawerClose');
const fileList = document.querySelector('#fileList');

let draftTimer = 0;
let latestHistory = [];

init();

function init() {
  input.addEventListener('input', () => {
    window.clearTimeout(draftTimer);
    const text = input.value;
    showDraftStatus('正在同步到 Electron...');
    draftTimer = window.setTimeout(() => sendDraft(text), 120);
  });

  submitButton.addEventListener('click', submitTask);
  drawerClose.addEventListener('click', () => {
    drawer.hidden = true;
  });

  loadConfig();
  refreshHistory();
  refreshState();
  window.setInterval(refreshHistory, 5000);
  window.setInterval(refreshState, 2500);
}

async function loadConfig() {
  try {
    const config = await fetchJSON('/api/config');
    publicUrl.textContent = config.publicUrl || config.nginxUrl || location.href;
  } catch (error) {
    publicUrl.textContent = location.href;
  }
}

async function sendDraft(text) {
  try {
    await postJSON('/api/input', { text });
    showDraftStatus('已同步到 Electron');
  } catch (error) {
    showDraftStatus(`同步失败：${error.message}`);
  }
}

async function submitTask() {
  const text = input.value.trim();
  if (!text) {
    showDraftStatus('请输入任务内容');
    return;
  }

  submitButton.disabled = true;
  showDraftStatus('正在启动协同...');
  try {
    await postJSON('/api/submit', { text });
    input.value = '';
    showDraftStatus('已启动协同');
    await refreshState();
  } catch (error) {
    showDraftStatus(`启动失败：${error.message}`);
  } finally {
    submitButton.disabled = false;
  }
}

async function refreshState() {
  try {
    const state = await fetchJSON('/api/state');
    const latest = state.outputs?.at?.(-1);
    if (!latest) {
      renderOutputEmpty();
      return;
    }
    renderOutput(latest);
  } catch (error) {
    outputBox.innerHTML = `<p class="muted">Electron 未连接：${escapeHTML(error.message)}</p>`;
  }
}

async function refreshHistory() {
  try {
    const payload = await fetchJSON('/api/history');
    latestHistory = payload.items || [];
    renderHistory();
  } catch (error) {
    historyList.innerHTML = `<p class="muted">历史读取失败：${escapeHTML(error.message)}</p>`;
  }
}

function renderOutputEmpty() {
  if (latestHistory[0]) {
    outputBox.innerHTML = `
      <p class="output-title">${escapeHTML(latestHistory[0].title)}</p>
      <div class="output-actions">
        <a href="/preview?root=history&path=${encodeURIComponent(`${latestHistory[0].path}/final-report.md`)}">报告</a>
        <a href="/preview?root=history&path=${encodeURIComponent(`${latestHistory[0].path}/game-preview.html`)}">预览</a>
      </div>
    `;
    return;
  }
  outputBox.innerHTML = '<p class="muted">等待输出结果...</p>';
}

function renderOutput(output) {
  const folder = output.outputFolderPath?.split('/').at(-1) || 'latest';
  outputBox.innerHTML = `
    <p class="output-title">${escapeHTML(output.gamePreviewTitle || folder)}</p>
    <p class="muted">${escapeHTML(output.outputFolderPath || '')}</p>
    <div class="output-actions">
      ${output.outputPath ? `<a href="/preview?root=output&path=${encodeURIComponent(`${folder}/final-report.md`)}">报告</a>` : ''}
      ${output.gamePreviewPath ? `<a href="/preview?root=output&path=${encodeURIComponent(`${folder}/game-preview.html`)}">预览</a>` : ''}
    </div>
  `;
}

function renderHistory() {
  if (latestHistory.length === 0) {
    historyList.innerHTML = '<p class="muted">还没有历史任务。</p>';
    return;
  }

  historyList.innerHTML = '';
  for (const item of latestHistory.slice(0, 30)) {
    const button = document.createElement('button');
    button.className = 'history-item';
    button.type = 'button';
    button.innerHTML = `
      <span>
        <strong>${escapeHTML(item.title)}</strong>
        <small>${formatTime(item.modifiedAt)}</small>
      </span>
      <span>›</span>
    `;
    button.addEventListener('click', () => openFiles(item));
    historyList.append(button);
  }
}

async function openFiles(item) {
  drawer.hidden = false;
  drawerTitle.textContent = item.title;
  fileList.innerHTML = '<p class="muted">读取文件...</p>';
  try {
    const payload = await fetchJSON(`/api/files?root=history&path=${encodeURIComponent(item.path)}`);
    fileList.innerHTML = '';
    for (const file of payload.items || []) {
      const row = document.createElement('div');
      row.className = 'file-item';
      if (file.kind === 'dir') {
        row.innerHTML = `<strong>${escapeHTML(file.name)}</strong><small>文件夹</small>`;
      } else {
        row.innerHTML = `
          <span>
            <strong>${escapeHTML(file.name)}</strong>
            <small>${formatBytes(file.size)}</small>
          </span>
          <span class="file-actions">
            <a href="${file.previewUrl}">预览</a>
            <a href="/raw?root=history&path=${encodeURIComponent(file.path)}">下载</a>
          </span>
        `;
      }
      fileList.append(row);
    }
  } catch (error) {
    fileList.innerHTML = `<p class="muted">读取失败：${escapeHTML(error.message)}</p>`;
  }
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function postJSON(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function showDraftStatus(text) {
  draftStatus.textContent = text;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
