import { useEffect, useState } from 'react';
import { useView } from '../state/useView';
import { verifyCanvas } from '../qr/verify';

interface OverlayProps {
  text: string;
  themeName: string;
  onApplyUrl: (url: string) => void;
  error: string | null;
}

export function Overlay({ text, themeName, onApplyUrl, error }: OverlayProps) {
  const view = useView((s) => s.view);
  const toggle = useView((s) => s.toggle);
  const setView = useView((s) => s.setView);
  const scan = useView((s) => s.scan);
  const setScan = useView((s) => s.setScan);
  const [checking, setChecking] = useState(false);

  // editable payload — re-renders the island a short beat after you stop typing
  const [draft, setDraft] = useState(text);
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
        <h1>QRLand · {themeName}</h1>
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
