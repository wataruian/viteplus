import type { UserShortcuts } from 'unocss';
import { colors } from '../tokens/colors';

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
  ['bg-adaptive', `bg-[${colors.semantic.bg}]`],
  ['bg-adaptive-alt', `bg-[${colors.semantic.bgAlt}]`],
  ['bg-inverse', `bg-[${colors.semantic.inverse}]`],

  // ── Text tokens ────────────────────────────────────────────────────────────
  ['text-adaptive', `text-[${colors.semantic.contentPrimary}]`],
  ['text-muted', `text-[${colors.semantic.contentMuted}]`],
  ['text-inverse', `text-[${colors.semantic.inverse}]`],

  // ── Border tokens ──────────────────────────────────────────────────────────
  ['border-adaptive', `border-[${colors.semantic.border}]`],

  // ── Utility shortcuts ──────────────────────────────────────────────────────
  ['glass-border', 'border border-white/10 backdrop-blur-md bg-white/[0.03]'],
  [
    'glass-nav',
    'sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-black/70 border-b border-adaptive',
  ],
];

export { cn, getSlotClass, shortcuts };
