import { useEffect, useState } from 'react';
import { useView } from '../state/useView';
import { verifyCanvas } from '../qr/verify';
import type { QRTheme } from '../scene/theme';

interface OverlayProps {
  text: string;
  themes: QRTheme[];
  activeTheme: QRTheme;
  onSelectTheme: (theme: QRTheme) => void;
  onApplyUrl: (url: string) => void;
  error: string | null;
}

export function Overlay({
  text,
  themes,
  activeTheme,
  onSelectTheme,
  onApplyUrl,
  error,
}: OverlayProps) {
  const view = useView((s) => s.view);
  const toggle = useView((s) => s.toggle);
  const setView = useView((s) => s.setView);
  const scan = useView((s) => s.scan);
  const setScan = useView((s) => s.setScan);
  const [checking, setChecking] = useState(false);

  // editable payload — re-renders the island a short beat after you stop typing
  const [draft, setDraft] = useState(text);
  // keep the field in sync when the payload changes from OUTSIDE the input
  // (e.g. switching template loads that world's sample link) — without this the
  // stale draft re-applies after the debounce and reverts the URL.
  useEffect(() => {
    setDraft(text);
  }, [text]);
  useEffect(() => {
    if (draft.trim() === text) return;
    const id = window.setTimeout(() => onApplyUrl(draft), 450);
    return () => window.clearTimeout(id);
  }, [draft, text, onApplyUrl]);

  // flip to top-down scan view, then poll-decode the canvas until it reads
  const checkScan = () => {
    setChecking(true);
    setView('scan');
    let tries = 0;
    const attempt = () => {
      const result = verifyCanvas(document.querySelector('canvas'), text);
      if (result.ok || tries++ > 12) {
        setScan(result);
        setChecking(false);
      } else {
        window.setTimeout(attempt, 250);
      }
    };
    window.setTimeout(attempt, 900);
  };

  const dotClass = scan ? (scan.ok ? 'dot ok' : 'dot bad') : 'dot';
  const statusText = checking
    ? 'Checking…'
    : scan
      ? scan.ok
        ? 'Scannable ✓'
        : scan.decoded
          ? 'Decoded (mismatch)'
          : 'Not detected'
      : 'Not checked';

  return (
    <div className="overlay">
      <div className="panel title">
        <h1>QRLand</h1>
        <div className="theme-switch" role="tablist" aria-label="Template">
          {themes.map((t) => (
            <button
              key={t.name}
              role="tab"
              aria-selected={t === activeTheme}
              className={`theme-tab ${t === activeTheme ? 'active' : ''}`}
              onClick={() => onSelectTheme(t)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <label className="url-field">
          <span className="url-label">Encodes</span>
          <input
            className={`url-input ${error ? 'invalid' : ''}`}
            value={draft}
            spellCheck={false}
            autoComplete="off"
            placeholder="https://your-link.com"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyUrl(draft);
            }}
          />
          {error && <span className="url-error">{error}</span>}
        </label>
        <label className="url-field" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-dim, #888)' }}>
            <span>Time of Day</span>
            <span>
              {Math.floor(useView((s) => s.time)).toString().padStart(2, '0')}:
              {Math.floor((useView((s) => s.time) % 1) * 60).toString().padStart(2, '0')}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="23.99"
            step="0.1"
            value={useView((s) => s.time)}
            onChange={(e) => useView.getState().setTime(parseFloat(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </label>
      </div>

      <div className="status panel" style={{ padding: '8px 12px' }}>
        <span className={dotClass} />
        <span>{statusText}</span>
      </div>

      <div className="hint">tap / drag the island · click below to switch view</div>

      <div className="toolbar">
        <button className="btn primary" onClick={toggle}>
          {view === 'scene' ? 'Top-down (scan)' : 'Isometric view'}
        </button>
        <button className="btn" onClick={checkScan} disabled={checking}>
          Check scannability
        </button>
      </div>
    </div>
  );
}
