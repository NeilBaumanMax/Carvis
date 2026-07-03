import type { HistoryItem, OutputItem } from '../types';
import { assetPath } from '../assets';
import { PixelButton } from './PixelButton';

type RightPanelProps = {
  input: string;
  running: boolean;
  outputLogs: string[];
  currentOutput?: OutputItem;
  history: HistoryItem[];
  onInputChange: (value: string) => void;
  onStart: () => void;
  onOpenPath: (path: string | undefined) => void;
};

const historyIconAssets: Record<string, string> = {
  leaf: assetPath('assets/ui/leaf-icon.png'),
  sprout: assetPath('assets/ui/leaf-icon.png'),
  globe: assetPath('assets/ui/status-sending.png'),
  doc: assetPath('assets/ui/mail-paper.png'),
  star: assetPath('assets/ui/status-thinking.png'),
  question: assetPath('assets/ui/status-reworking.png'),
};

function getHistoryIconAsset(icon: string) {
  return historyIconAssets[icon] ?? assetPath('assets/ui/leaf-icon.png');
}

export function RightPanel({
  input,
  running,
  outputLogs,
  currentOutput,
  history,
  onInputChange,
  onStart,
  onOpenPath,
}: RightPanelProps) {
  return (
    <aside className="right-panel">
      <section className="panel-box input-box">
        <h2>输入任务</h2>
        <div className="input-row">
          <input
            value={input}
            disabled={running}
            placeholder="请输入任务内容..."
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onStart();
            }}
          />
          <div className="input-actions">
            <PixelButton disabled={running} onClick={onStart} aria-label="开始协同">
              {running ? '协同中...' : '开始协同'}
            </PixelButton>
          </div>
        </div>
      </section>
      <section className="panel-box output-box" data-output-target="true">
        <h2>输出结果</h2>
        <div className="output-log">
          {currentOutput ? (
            <div className="current-output">
              <div className="output-head">
                <strong>{currentOutput.title}</strong>
                <PixelButton onClick={() => onOpenPath(currentOutput.folderPath)} aria-label="打开本次输出位置">
                  打开位置
                </PixelButton>
              </div>
              <p className="output-folder">{currentOutput.folderPath}</p>
              <div className="output-file-list">
                {currentOutput.files.map((file) => (
                  <button
                    className="output-file"
                    disabled={!file.path}
                    key={`${file.label}-${file.path ?? 'missing'}`}
                    onClick={() => onOpenPath(file.path)}
                    type="button"
                  >
                    <span>{file.label}</span>
                    {file.size !== undefined ? <small>{formatBytes(file.size)}</small> : null}
                  </button>
                ))}
              </div>
              {currentOutput.previewText ? <pre className="output-preview">{currentOutput.previewText}</pre> : null}
            </div>
          ) : outputLogs.length === 0 ? (
            <p className="muted">等待技术员 Agent 输出结果...</p>
          ) : (
            outputLogs.map((log, index) => (
              <p className="log-line" key={`${log}-${index}`}>
                {log}
              </p>
            ))
          )}
        </div>
      </section>
      <section className="panel-box history-box">
        <h2>历史任务</h2>
        <div className="history-list">
          {history.length === 0 ? <p className="muted">还没有历史输出文件夹。</p> : null}
          {history.map((item, index) => (
            <button
              className="history-item"
              disabled={!item.path}
              key={`${item.title}-${index}`}
              onClick={() => onOpenPath(item.path)}
              type="button"
            >
              <img
                className="history-icon"
                src={getHistoryIconAsset(item.icon)}
                alt=""
                draggable={false}
              />
              <span className="history-title">
                {item.title}
                {item.subtitle ? <small>{item.subtitle}</small> : null}
              </span>
              <time>{item.time}</time>
              <span className="history-arrow">›</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
