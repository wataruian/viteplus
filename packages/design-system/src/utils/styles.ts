import type { UserShortcuts } from 'unocss';

const cn = (...classes: (boolean | null | string | undefined)[]) =>
  classes.filter(Boolean).join(' ');

const getSlotClass = (
  useDefault: boolean,
  defaultClass: string,
  slotProps?: { className?: string | undefined },
) => {
  if (!useDefault) {
    return slotProps?.className ?? '';
  }
  return cn(defaultClass, slotProps?.className);
};

const shortcuts: UserShortcuts = [
  // ── Background tokens ──────────────────────────────────────────────────────
  // We use the theme mapping defined in unocss.ts (adaptive-bg, etc.)
  ['bg-adaptive', 'bg-adaptive-bg'],
  ['bg-adaptive-alt', 'bg-adaptive-bg-alt'],
  ['bg-inverse', 'bg-inverse'],

  // ── Text tokens ────────────────────────────────────────────────────────────
  ['text-adaptive', 'text-adaptive-text'],
  ['text-muted', 'text-adaptive-muted'],
  ['text-inverse', 'text-inverse'],

  // ── Border tokens ──────────────────────────────────────────────────────────
  ['border-adaptive', 'border-adaptive-border'],

  // ── Utility shortcuts ──────────────────────────────────────────────────────
  ['glass-border', 'border border-white/10 backdrop-blur-md bg-white/[0.03]'],
  [
    'glass-nav',
    'sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-black/70 border-b border-adaptive',
  ],
];

export { cn, getSlotClass, shortcuts };
