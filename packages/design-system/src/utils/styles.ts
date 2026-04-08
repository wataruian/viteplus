import type { IconsOptions } from 'unocss/preset-icons';
import type { UserShortcuts } from 'unocss';
import type { WebFontsOptions } from 'unocss/preset-web-fonts';

export const cn = (...classes: (string | undefined | null | boolean)[]) =>
  classes.filter(Boolean).join(' ');

export const getSlotClass = (
  useDefault: boolean,
  defaultClass: string,
  slotProps?: { className?: string | undefined },
) => {
  if (!useDefault) {
    return slotProps?.className ?? '';
  }
  return cn(defaultClass, slotProps?.className);
};

export const webFontsOptions: WebFontsOptions = {
  fonts: {
    header: 'Outfit:400,600,700,800',
    mono: 'Fira Code',
    sans: 'Inter:300,400,500,600,700',
  },
};

export const iconsOptions: IconsOptions = {
  scale: 1.2,
  warn: true,
};

export const shortcuts: UserShortcuts = [
  // ['bg-adaptive', 'bg-[var(--primary-adaptive)]'],
  // ['border-adaptive', 'border-[var(--surface-adaptive)]/10'],
  // ['bg-inverse', 'bg-[var(--primary-inverse)]'],
  // ['border-inverse', 'border-[var(--surface-inverse)]'],
  // ['text-adaptive', 'text-[var(--surface-adaptive)]'],
  // ['text-inverse', 'text-[var(--surface-inverse)]'],
  // ['text-muted-adaptive', 'text-[var(--surface-adaptive)]/60'],
  // ['text-muted-inverse', 'text-[var(--surface-inverse)]/60'],
];
