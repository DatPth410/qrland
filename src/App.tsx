import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRScene } from './scene/QRScene';
import { Overlay } from './ui/Overlay';
import { generateQR } from './qr/generate';
import { verifyCanvas } from './qr/verify';
import { decodeImageFile } from './qr/decodeImage';
import { themes, defaultTheme } from './scene/themes';
import { useView } from './state/useView';

// ECC H + a forced floor version: enough modules and error-correction blocks
// that the central island/pavilion (a contiguous overwrite of the center) stays
// recoverable. Longer payloads grow the version (finer worlds), never below 11.
const QR_OPTS = { errorCorrectionLevel: 'H', quietZone: 4, minVersion: 11 } as const;

export default function App() {
  // 🎨 the active world — switch between templates live in the UI
  const [theme, setTheme] = useState(defaultTheme);
  const [url, setUrl] = useState(defaultTheme.sampleText ?? 'https://anthropic.com');
  const [error, setError] = useState<string | null>(null);

  const time = useView((s) => s.time);

  const activeTheme = useMemo(() => {
    const isNight = time < 6 || time >= 18;
    if (!isNight) return theme;
    
    // Twilight / Night adjustment
    const nightTheme = { ...theme };
    
    // Dim the sky
    nightTheme.background = '#06080f'; // Dark night sky
    nightTheme.background2 = '#101626'; 
    nightTheme.fog = '#06080f';

    // Dim the sun and ambient
    nightTheme.sunColor = '#5e759e'; // Blueish moonlight
    nightTheme.ambient = (theme.ambient ?? 0.5) * 0.35;
    
    // Dim the pedestal / ground
    nightTheme.groundColor = '#0f1217';

    return nightTheme;
  }, [theme, time]);

  // `url` is only ever set to a value we've already validated, so this can't throw
  const matrix = useMemo(() => generateQR(url, QR_OPTS), [url]);

  // validate a candidate payload, then re-render the world if it encodes
  const applyUrl = useCallback((next: string) => {
    const trimmed = next.trim();
    if (!trimmed) {
      setError('Enter a URL or some text');
      return;
    }
    try {
      generateQR(trimmed, QR_OPTS);
      setError(null);
      setUrl(trimmed);
    } catch {
      setError('Too long to fit a QR code — shorten it');
    }
  }, []);

  // switching worlds loads that world's fitting sample link
  const applyTheme = useCallback((next: typeof theme) => {
    setTheme(next);
    if (next.sampleText) {
      setError(null);
      setUrl(next.sampleText);
    }
  }, []);

  // dev helper: window.__scanCheck() decodes the live canvas (use in scan view)
  useEffect(() => {
    const w = window as unknown as {
      __scanCheck: () => unknown;
      __decodeImageFile: typeof decodeImageFile;
    };
    w.__scanCheck = () => verifyCanvas(document.querySelector('canvas'), matrix.text);
    w.__decodeImageFile = decodeImageFile;
  }, [matrix]);

  return (
    <>
      <QRScene matrix={matrix} theme={activeTheme} />
      <Overlay
        text={matrix.text}
        themes={themes}
        activeTheme={theme}
        onSelectTheme={applyTheme}
        onApplyUrl={applyUrl}
        error={error}
      />
    </>
  );
}
