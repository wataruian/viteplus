const animation = {
  counts: {
    gradient: 'infinite',
    marquee: 'infinite',
    'marquee-reverse': 'infinite',
  },
  durations: {
    gradient: '3s',
    marquee: 'var(--duration)',
    'marquee-reverse': 'var(--duration)',
  },
  keyframes: {
    gradient:
      '{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}',
    marquee:
      '{from{transform:translateX(0);}to{transform:translateX(calc(-100% - var(--gap, 0px)));}}',
    'marquee-reverse':
      '{from{transform:translateX(calc(-100% - var(--gap, 0px)));}to{transform:translateX(0);}}',
  },
  timingFns: {
    gradient: 'ease',
    marquee: 'linear',
    'marquee-reverse': 'linear',
  },
};

export { animation };
