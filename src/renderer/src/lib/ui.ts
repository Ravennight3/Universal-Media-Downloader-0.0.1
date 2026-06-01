/**
 * Centralized design tokens for the monochrome theme. Each token carries its
 * light base + `dark:` overrides, so the whole UI flips cleanly when the `dark`
 * class is toggled on <html>. Keeping them here (one source of truth) is what
 * lets every view stay consistent in both Light and premium Dark modes.
 */

/** Join class fragments, dropping falsy ones. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const ui = {
  // Surfaces
  card: 'rounded-2xl border border-zinc-200/80 bg-white/70 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/40',
  row: 'rounded-xl border border-zinc-200/80 bg-white/60 dark:border-zinc-800/70 dark:bg-zinc-900/30',
  field:
    'rounded-xl border border-zinc-300 bg-white/80 backdrop-blur transition-colors focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:focus-within:border-zinc-600',

  // Buttons / controls
  chip: 'rounded-full border border-zinc-300 bg-zinc-100 text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700/70 dark:bg-zinc-800/40 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-700/50 dark:hover:text-white',
  btnPrimary:
    'bg-zinc-900 text-zinc-50 transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
  btnSecondary:
    'rounded-lg border border-zinc-300 bg-zinc-100 text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700/70 dark:bg-zinc-800/40 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-700/50 dark:hover:text-white',
  iconBtn:
    'flex items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-200',
  iconBtnActive: 'bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',

  // Segmented control (theme / language selectors)
  segTrack:
    'inline-flex rounded-lg border border-zinc-200 bg-zinc-100/70 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/40',
  segBase: 'rounded-md px-3 py-1 text-xs font-medium transition-colors',
  segActive: 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900',
  segIdle: 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',

  // Progress bar
  track: 'h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800',
  fill: 'h-full rounded-full bg-zinc-900 dark:bg-zinc-100',

  // Text
  muted: 'text-zinc-500',
  subtle: 'text-zinc-400 dark:text-zinc-600',
  heading: 'text-zinc-900 dark:text-zinc-100'
}
