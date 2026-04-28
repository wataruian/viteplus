type ColorKey = keyof ReturnType<typeof createColorMap>;

const createColorMap = <P extends string>(prefix: P) =>
  ({
    accent: `${prefix}-accent`,
    adaptiveAccent: `${prefix}-adaptive-accent`,
    adaptiveDanger: `${prefix}-adaptive-danger`,
    adaptiveInfo: `${prefix}-adaptive-info`,
    adaptivePrimary: `${prefix}-adaptive-primary`,
    adaptiveSuccess: `${prefix}-adaptive-success`,
    adaptiveSurface: `${prefix}-adaptive-surface`,
    adaptiveWarning: `${prefix}-adaptive-warning`,
    danger: `${prefix}-danger`,
    info: `${prefix}-info`,
    inverseAccent: `${prefix}-inverse-accent`,
    inverseDanger: `${prefix}-inverse-danger`,
    inverseInfo: `${prefix}-inverse-info`,
    inversePrimary: `${prefix}-inverse-primary`,
    inverseSuccess: `${prefix}-inverse-success`,
    inverseSurface: `${prefix}-inverse-surface`,
    inverseWarning: `${prefix}-inverse-warning`,
    primary: `${prefix}-primary`,
    success: `${prefix}-success`,
    transparent: `${prefix}-transparent`,
    warning: `${prefix}-warning`,
  }) as const;

const baseStyles = {
  colors: {
    bg: createColorMap('bg'),
    border: createColorMap('border'),
    ring: createColorMap('ring'),
    shadow: createColorMap('shadow'),
    text: createColorMap('text'),
  },
} as const;

const intentSoft = (color: ColorKey) =>
  `${baseStyles.colors.bg[color]}/15 ${baseStyles.colors.text[color]}`;

const intentSolid = (color: ColorKey) =>
  `${baseStyles.colors.bg[color]} text-white shadow-lg ${baseStyles.colors.shadow[color]}/20 hover:${baseStyles.colors.bg[color]}/90`;

const intentInput = (color: 'danger' | 'success') =>
  `${baseStyles.colors.border[color]}/50 focus:${baseStyles.colors.ring[color]}/20 focus:${baseStyles.colors.border[color]}/50`;

const errorBoundaryVariant = (color: 'danger' | 'warning', icon: string) =>
  ({
    base: `${baseStyles.colors.bg[color]}/10`,
    container: 'flex flex-col items-center gap-6',
    content: 'space-y-2',
    description: `${baseStyles.colors.text.inverseSurface}/60 text-lg leading-relaxed max-w-lg`,
    icon: `${icon} text-6xl ${baseStyles.colors.text[color]}/80`,
    title: `${baseStyles.colors.text[color]} font-black text-3xl tracking-tight`,
  }) as const;

export type { ColorKey };
export { baseStyles, createColorMap, errorBoundaryVariant, intentInput, intentSoft, intentSolid };
