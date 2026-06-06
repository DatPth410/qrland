import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { QRTheme } from '../scene/theme';
import { useView } from '../state/useView';

interface ControlsProps {
  themes: QRTheme[];
  themeIndex: number;
  onSelectTheme: (index: number) => void;
  text: string;
  onApplyUrl: (url: string) => void;
  error: string | null;
}

/** Floating, non-blocking UI over the 3D canvas: app title + world pills (top),
 *  and a single quiet card with the payload + view-toggle pill (bottom). The
 *  outer container is `box-none` so taps between the controls fall through to
 *  the canvas (which flips scene ↔ scan). */
export function Controls({
  themes,
  themeIndex,
  onSelectTheme,
  text,
  onApplyUrl,
  error,
}: ControlsProps) {
  const view = useView((s) => s.view);
  const onToggleView = useView((s) => s.toggle);
  // editable payload — re-renders the world a short beat after you stop typing
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]); // keep in sync when a theme loads its sample
  useEffect(() => {
    if (draft.trim() === text) return;
    const id = setTimeout(() => onApplyUrl(draft), 450);
    return () => clearTimeout(id);
  }, [draft, text, onApplyUrl]);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.top} pointerEvents="box-none">
        <Text style={styles.title}>QRLand</Text>
        <View style={styles.pills}>
          {themes.map((t, i) => (
            <Pressable
              key={t.name}
              onPress={() => onSelectTheme(i)}
              style={[styles.pill, i === themeIndex && styles.pillActive]}>
              <Text style={[styles.pillText, i === themeIndex && styles.pillTextActive]}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.bottom}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none">
        <Text style={styles.hint}>
          {view === 'scene'
            ? 'tap the world to flatten it for scanning'
            : 'tap to stand the world back up'}
        </Text>

        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Encodes</Text>
              <TextInput
                style={[styles.input, !!error && styles.inputError]}
                value={draft}
                onChangeText={setDraft}
                placeholder="https://your-link.com"
                placeholderTextColor="rgba(20, 14, 18, 0.32)"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                inputMode="url"
                returnKeyType="go"
                onSubmitEditing={() => onApplyUrl(draft)}
                numberOfLines={1}
              />
            </View>
            <Pressable
              style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
              onPress={onToggleView}
              accessibilityLabel={view === 'scene' ? 'Switch to scan view' : 'Switch to 3D view'}>
              <Text style={styles.toggleText}>{view === 'scene' ? 'Scan' : '3D'}</Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// Ink-on-paper palette: the worlds are bright, so the UI is a soft white card
// with dark, restrained text — it sits over either theme without clashing.
const INK = '#1a1216';
const INK_DIM = 'rgba(20, 14, 18, 0.55)';
const INK_FAINT = 'rgba(20, 14, 18, 0.32)';
const CARD = 'rgba(255, 255, 255, 0.78)';
const CARD_BORDER = 'rgba(20, 14, 18, 0.06)';
const CHIP_BG = 'rgba(255, 255, 255, 0.55)';
const CHIP_BORDER = 'rgba(20, 14, 18, 0.08)';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },

  // top: title + world pills
  top: { paddingTop: 60, paddingHorizontal: 18, gap: 12 },
  title: {
    color: INK,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pills: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: CHIP_BG,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHIP_BORDER,
    padding: 4,
    alignSelf: 'flex-start',
  },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  pillActive: { backgroundColor: INK },
  pillText: { color: INK_DIM, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#ffffff' },

  // bottom: hint + url card with inline toggle. Sits clear above the home indicator.
  bottom: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    gap: 12,
  },
  hint: {
    alignSelf: 'center',
    color: INK_DIM,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    // soft elevation so the card lifts gently off the world behind it
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: INK_FAINT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  input: {
    color: INK,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 2,
    paddingHorizontal: 0,
    // ensure the long URL truncates inside the field rather than pushing the toggle off-screen
    width: '100%',
  },
  inputError: { color: '#c53030' },
  error: {
    color: '#c53030',
    fontSize: 12,
    marginTop: 6,
  },
  toggle: {
    backgroundColor: INK,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  togglePressed: { opacity: 0.78 },
  toggleText: { color: '#ffffff', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
});
