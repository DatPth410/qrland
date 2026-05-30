import { useEffect, useMemo } from 'react';
import { QRScene } from './scene/QRScene';
import { Overlay } from './ui/Overlay';
import { generateQR } from './qr/generate';
import { verifyCanvas } from './qr/verify';
import { cycladicTheme } from './scene/themes/cycladic';

// 🔗 The URL the QR code encodes — swap this for your link.
const QR_URL = 'https://reactiive.io/demos/cherry-blossom-qrcode';

// 🎨 The active world.
const theme = cycladicTheme;

export default function App() {
  // ECC H + a forced higher version: more modules and more error-correction
  // blocks, so the bigger central island/church (a contiguous overwrite of the
  // center) interleaves across blocks and still recovers.
  const matrix = useMemo(
    () => generateQR(QR_URL, { errorCorrectionLevel: 'H', quietZone: 4, version: 8 }),
    [],
  );

  // dev helper: window.__scanCheck() decodes the live canvas (use in flat view)
  useEffect(() => {
    (window as unknown as { __scanCheck: () => unknown }).__scanCheck = () =>
      verifyCanvas(document.querySelector('canvas'), matrix.text);
  }, [matrix]);

  return (
    <>
      <QRScene matrix={matrix} theme={theme} />
      <Overlay text={matrix.text} themeName={theme.name} />
    </>
  );
}
