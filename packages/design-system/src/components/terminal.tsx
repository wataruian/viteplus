import { useEffect, useState } from 'react';

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
              // Loop back with a delay
              globalThis.setTimeout(() => {
                setCurrentCommandIndex(0);
              }, 3000);
            }
          }, 2000);
        }, 500);
      }
    }, 100);

    return () => {
      globalThis.clearInterval(typingInterval);
    };
  }, [currentCommandIndex, commands]);

  return (
    <div className='glass-card p-0 overflow-hidden border-premium shadow-2xl max-w-3xl mx-auto w-full font-mono text-sm group'>
      <div className='bg-white/5 border-b border-white/10 px-4 py-3 flex items-center gap-2'>
        <div className='flex gap-1.5'>
          <div className='w-3 h-3 rounded-full bg-red-500/50'></div>
          <div className='w-3 h-3 rounded-full bg-yellow-500/50'></div>
          <div className='w-3 h-3 rounded-full bg-green-500/50'></div>
        </div>
        <div className='text-slate-500 text-xs ml-2 flex items-center gap-2'>
          <span className='i-ph-terminal-window-duotone w-4 h-4'></span>
          zsh — Light Project — 80x24
        </div>
      </div>

      <div className='p-6 min-h-[320px] bg-black/20'>
        {commands.slice(0, currentCommandIndex).map((cmd, idx) => (
          <div key={idx} className='mb-4'>
            <div className='flex items-center gap-2 text-primary-400'>
              <span className='font-bold'>$</span>
              <span>{cmd.command}</span>
            </div>
            <div className='mt-1 text-slate-400 opacity-80'>
              {cmd.output.map((line, lineIdx) => (
                <div key={lineIdx}>{line}</div>
              ))}
            </div>
          </div>
        ))}

        <div className='flex items-center gap-2 text-primary-400'>
          <span className='font-bold'>$</span>
          <span>{displayedCommand}</span>
          {isTyping && <span className='w-2 h-5 bg-primary-500 animate-pulse'></span>}
        </div>

        {showOutput && (
          <div className='mt-1 text-slate-300 animate-fade-in'>
            {commands[currentCommandIndex].output.map((line, lineIdx) => (
              <div key={lineIdx} className='flex items-center gap-2'>
                {line.startsWith('✔') ? (
                  <span className='text-accent-400'>{line}</span>
                ) : (
                  <span>{line}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
