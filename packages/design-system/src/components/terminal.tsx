import { useEffect, useState } from 'react';
import { Noise } from './noise';

interface TerminalProps {
  commands: { command: string; output: string[] }[];
}

export const Terminal = ({ commands }: TerminalProps) => {
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [displayedCommand, setDisplayedCommand] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (currentCommandIndex >= commands.length) {
      return () => {};
    }

    const { command } = commands[currentCommandIndex];
    let charIndex = 0;
    setIsTyping(true);
    setShowOutput(false);
    setDisplayedCommand('');

    const typingInterval = globalThis.setInterval(() => {
      if (charIndex < command.length) {
        setDisplayedCommand((prev) => prev + command[charIndex]);
        charIndex += 1;
      } else {
        globalThis.clearInterval(typingInterval);
        setIsTyping(false);
        globalThis.setTimeout(() => {
          setShowOutput(true);
          globalThis.setTimeout(() => {
            if (currentCommandIndex < commands.length - 1) {
              setCurrentCommandIndex((prev) => prev + 1);
            } else {
              globalThis.setTimeout(() => {
                setCurrentCommandIndex(0);
              }, 4000);
            }
          }, 3000);
        }, 800);
      }
    }, 60);

    return () => {
      globalThis.clearInterval(typingInterval);
    };
  }, [currentCommandIndex, commands]);

  return (
    <div className='glass-card p-0 overflow-hidden border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-3xl mx-auto w-full font-mono text-sm relative group'>
      <Noise className='opacity-[0.02]' />
      <div className='bg-white/5 border-b border-white/10 px-4 py-3 flex items-center justify-between'>
        <div className='flex gap-2'>
          <div className='w-3 h-3 rounded-full bg-red-500/30' />
          <div className='w-3 h-3 rounded-full bg-yellow-500/30' />
          <div className='w-3 h-3 rounded-full bg-green-500/30' />
        </div>
        <div className='text-slate-500 text-[10px] uppercase tracking-widest font-bold opacity-60'>
          bash — 80x24
        </div>
        <div className='w-12' />
      </div>

      <div className='p-8 min-h-[360px] bg-black/40 backdrop-blur-sm'>
        {commands.slice(0, currentCommandIndex).map((cmd, idx) => (
          <div key={idx} className='mb-6 opacity-60'>
            <div className='flex items-center gap-2 text-primary'>
              <span className='font-bold opacity-50'>➜</span>
              <span className='text-white/40'>~</span>
              <span className='font-bold text-primary'>{cmd.command}</span>
            </div>
            <div className='mt-2 pl-6 text-slate-400 space-y-1 border-l border-white/5'>
              {cmd.output.map((line, lineIdx) => (
                <div key={lineIdx} className='flex items-center gap-2'>
                  {line.includes('✔') && (
                    <span className='i-ph-check-circle-fill text-accent text-xs' />
                  )}
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className='mb-6'>
          <div className='flex items-center gap-2'>
            <span className='font-bold text-primary'>➜</span>
            <span className='text-white/40'>~</span>
            <span className='font-bold text-white'>{displayedCommand}</span>
            <span
              className={`w-2 h-4 bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)] ${isTyping ? 'opacity-100' : 'animate-pulse'}`}
            />
          </div>

          {showOutput && (
            <div className='mt-3 pl-6 text-slate-300 animate-slide-up space-y-1 border-l border-primary/30'>
              {commands[currentCommandIndex].output.map((line, lineIdx) => (
                <div key={lineIdx} className='flex items-center gap-2'>
                  {line.includes('✔') && (
                    <span className='i-ph-check-circle-fill text-accent text-xs' />
                  )}
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
