import type { QRTheme } from '../theme';
import { khueVanCacTheme } from './khuevancac';
import { cycladicTheme } from './cycladic';

/**
 * The gallery of worlds. Each entry is a self-contained {@link QRTheme} that turns
 * the QR matrix into a scannable 3D scene.
 */
export const themes: QRTheme[] = [khueVanCacTheme, cycladicTheme];

export const defaultTheme = themes[0];

export { khueVanCacTheme, cycladicTheme };
