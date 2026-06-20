import { useEffect, useRef, useState } from 'react';
import { useView } from '../state/useView';
import { verifyCanvas } from '../qr/verify';
import { decodeImageFile } from '../qr/decodeImage';
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
  // on mobile the URL / upload / time controls collapse behind a toggle so the
  // island gets the whole screen — open is forced on at desktop widths via CSS
  const [expanded, setExpanded] = useState(false);

  // upload-a-QR-image state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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

  // decode a QR image the user picked or dropped, then apply its payload
  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const { text: decoded, error: decodeError } = await decodeImageFile(file);
    setUploading(false);
    if (decoded) {
      setDraft(decoded);
      onApplyUrl(decoded);
    } else {
      setUploadError(decodeError ?? 'Couldn’t read that QR code.');
    }
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
      <div
        className={`panel title ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="title-head">
          <h1>QRLand</h1>
          <div className="head-actions">
            <span className={`${dotClass} head-status`} title={statusText} aria-hidden />
            <button
              type="button"
              className="collapse-toggle"
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide controls' : 'Show controls'}
              onClick={() => setExpanded((v) => !v)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 5.5L8 10.5L13 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
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
        <div className={`title-collapsible ${expanded ? 'open' : ''}`}>
        <label className="url-field">
          <span className="url-label">Encodes</span>
          <input
            className={`url-input ${error ? 'invalid' : ''}`}
            value={draft}
            spellCheck={false}
            autoComplete="off"
            placeholder="https://your-link.com"
            onChange={(e) => {
              setDraft(e.target.value);
              if (uploadError) setUploadError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyUrl(draft);
            }}
          />
          {error && <span className="url-error">{error}</span>}
        </label>

        <div className="upload-row">
          <input
            ref={fileRef}
            className="upload-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = ''; // let the same file be re-picked
            }}
          />
          <button
            type="button"
            className="upload-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Reading…' : 'Upload QR image — or drop one here'}
          </button>
          {uploadError && <span className="url-error">{uploadError}</span>}
        </div>
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
