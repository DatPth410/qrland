import type { QRTheme } from '../theme';
import { cycladicTheme } from './cycladic';
import { khueVanCacTheme } from './khuevancac';
import { thapRuaTheme } from './thaprua';

/**
 * The gallery of worlds. Each entry is a self-contained {@link QRTheme} that turns
 * the QR matrix into a scannable 3D scene — add a new file here to add a template.
 */
export const themes: QRTheme[] = [thapRuaTheme, khueVanCacTheme, cycladicTheme];

export const defaultTheme = themes[0];

export { cycladicTheme, khueVanCacTheme, thapRuaTheme };
