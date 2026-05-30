import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRScene } from './scene/QRScene';
import { Overlay } from './ui/Overlay';
import { generateQR } from './qr/generate';
import { verifyCanvas } from './qr/verify';
import { cycladicTheme } from './scene/themes/cycladic';

// 🔗 The URL the QR code encodes by default — editable live in the UI.
const DEFAULT_URL = 'https://reactiive.io/demos/cherry-blossom-qrcode';

// 🎨 The active world.
const theme = cycladicTheme;

// ECC H + a forced floor version: enough modules and error-correction blocks
// that the central island/church (a contiguous overwrite of the center) stays
// recoverable. Longer payloads grow the version (finer islands), never below 8.
const QR_OPTS = { errorCorrectionLevel: 'H', quietZone: 4, minVersion: 11 } as const;

export default function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [error, setError] = useState<string | null>(null);

  // `url` is only ever set to a value we've already validated, so this can't throw
  const matrix = useMemo(() => generateQR(url, QR_OPTS), [url]);

  // validate a candidate payload, then re-render the island if it encodes
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

  // dev helper: window.__scanCheck() decodes the live canvas (use in scan view)
  useEffect(() => {
    (window as unknown as { __scanCheck: () => unknown }).__scanCheck = () =>
      verifyCanvas(document.querySelector('canvas'), matrix.text);
  }, [matrix]);

  return (
    <>
      <QRScene matrix={matrix} theme={theme} />
      <Overlay text={matrix.text} themeName={theme.name} onApplyUrl={applyUrl} error={error} />
    </>
  );
}
