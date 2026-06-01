import type { Strings } from '../i18n/translations'

/**
 * Maps an engine quality label (e.g. "2160p", "Audio Only") to a friendly
 * display label. The original engine label is still what we send back for the
 * download, so this is purely cosmetic.
 */
export function displayQuality(label: string, t: Strings): string {
  if (label === 'Audio Only') return t.audioLabel
  if (label === '2160p') return '4K'
  return label
}
