import { baseStyles } from './base';

const previewStyles = {
  base: 'pt-2 md:pt-4',
  default: {},
  slots: {
    actions: 'flex shrink-0 items-center gap-4 self-start',
    cardPreview: 'p-6 text-center text-sm font-bold flex items-center justify-center min-w-[120px]',
    componentCard: `rounded-2xl overflow-hidden transition-all duration-300 ${baseStyles.colors.bg.transparent} border-2 ${baseStyles.colors.ring.inverseSurface}/10 shadow-sm hover:${baseStyles.colors.border.primary}/30 flex flex-col items-center justify-center gap-1 p-2`,
    componentCardInner: 'flex flex-col gap-1 w-full',
    componentGrid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
    componentTitle: 'break-words min-w-0',
    componentWrapper: 'flex flex-col gap-2 min-w-0',
    content: 'flex flex-col gap-4 md:gap-6',
    controls: 'flex flex-wrap items-center gap-2 p-1.5 w-fit',
    description: 'max-w-2xl opacity-90',
    divider: `w-[1px] h-11 ${baseStyles.colors.bg.inverseSurface} mx-1 hidden sm:block`,
    groupLabel: 'font-bold uppercase tracking-widest opacity-40',
    groupWrapper: `flex flex-col gap-1 ${baseStyles.colors.bg.inversePrimary}/10 p-2 rounded-2xl shadow-sm`,
    header: 'flex flex-col md:flex-row md:items-start justify-between gap-8',
    headerInfo: 'flex-1 space-y-4 md:space-y-6 pt-2 md:pt-4',
    iconLabel: 'opacity-40',
    iconPreview: baseStyles.colors.text.primary,
    section: 'space-y-4',
    sectionHeader: 'flex items-center gap-3',
    showcaseIcon: 'i-ph-star-fill',
    swatchColor: `w-12 h-12 md:w-16 md:h-16 rounded-xl shadow-sm ring-2 ${baseStyles.colors.ring.inverseSurface} hover:scale-110 hover:shadow-lg transition-transform duration-300 cursor-pointer`,
    swatchDivider: `w-[1px] h-12 md:h-16 ${baseStyles.colors.bg.inversePrimary} mx-1 self-start`,
    swatchItem: 'flex flex-col gap-2',
    swatchLabel: `text-[10px] md:text-xs font-mono ${baseStyles.colors.text.inverseSurface}/60 text-center`,
    swatchesContainer: 'flex flex-wrap gap-3 items-start',
    themesContainer: 'space-y-8 md:space-y-12',
    themesGrid: 'grid gap-12',
    themesSection: 'space-y-8',
    themesTitle: 'uppercase tracking-widest opacity-70',
  },
  variants: {
    cardAlignment: {
      block: '!items-stretch',
      inline: '',
    },
    variantItem: {
      block: 'flex flex-col items-stretch w-full gap-1 min-w-0',
      inline: 'flex flex-col items-center gap-1 min-w-0',
    },
    variantList: {
      block: 'flex flex-col items-stretch w-full gap-2 min-w-0',
      inline: 'flex flex-wrap items-end gap-2 min-w-0',
    },
    wrapperWidth: {
      standard: '',
      wide: 'lg:col-span-2',
    },
  },
} as const;

export { previewStyles };
