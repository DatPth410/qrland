import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { FiberCanvas } from '../lib/fiber-canvas';
import { Scene } from '../scene/Scene';
import { Controls } from './Controls';
import { generateQR } from '../qr/generate';
import { themes, defaultTheme } from '../scene/themes';
import { useView } from '../state/useView';

// ECC H + a forced floor version: enough modules and error-correction blocks that
// the building themes' central structures stay recoverable. (Same as the web app.)
const QR_OPTS = { errorCorrectionLevel: 'H', quietZone: 4, minVersion: 11 } as const;

export function QRApp() {
  const [themeIndex, setThemeIndex] = useState(0);
  const [url, setUrl] = useState(defaultTheme.sampleText ?? 'https://anthropic.com');
  const [error, setError] = useState<string | null>(null);
  const toggle = useView((s) => s.toggle);
  const theme = themes[themeIndex];
  // `url` is only ever set to a value we've already validated, so this can't throw
  const matrix = useMemo(() => generateQR(url, QR_OPTS), [url]);

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

  const selectTheme = useCallback((index: number) => {
    setThemeIndex(index);
    const next = themes[index];
    if (next.sampleText) {
      setError(null);
      setUrl(next.sampleText);
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style="dark" />
      <Pressable style={styles.fill} onPress={toggle}>
        <FiberCanvas style={styles.fill}>
          <Scene matrix={matrix} theme={theme} />
        </FiberCanvas>
      </Pressable>
      <Controls
        themes={themes}
        themeIndex={themeIndex}
        onSelectTheme={selectTheme}
        text={matrix.text}
        onApplyUrl={applyUrl}
        error={error}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
