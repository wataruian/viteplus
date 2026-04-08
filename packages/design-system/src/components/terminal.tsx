import { type HTMLAttributes, type ReactNode, useEffect, useState } from 'react';
import { Noise, type NoiseProps } from './noise';
import { getSlotClass } from '../utils/styles';

export interface TerminalProps {
  commands?: { command: string; output: string[] }[] | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
  useDefault?: boolean | undefined;
  props?: HTMLAttributes<HTMLDivElement> | undefined;
  noiseProps?: NoiseProps | undefined;
  headerProps?: HTMLAttributes<HTMLDivElement> | undefined;
  dotContainerProps?: HTMLAttributes<HTMLDivElement> | undefined;
  redDotProps?: HTMLAttributes<HTMLDivElement> | undefined;
  yellowDotProps?: HTMLAttributes<HTMLDivElement> | undefined;
  greenDotProps?: HTMLAttributes<HTMLDivElement> | undefined;
  titleProps?: HTMLAttributes<HTMLDivElement> | undefined;
  bodyProps?: HTMLAttributes<HTMLDivElement> | undefined;
  commandWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  commandPromptProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  commandTextProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  cursorProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  outputWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  outputLineProps?: HTMLAttributes<HTMLDivElement> | undefined;
  headerSpacerProps?: HTMLAttributes<HTMLDivElement> | undefined;
  commandLineWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  commandLinePromptProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  commandLineDirProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  historyOutputWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  successIconProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  activeCommandLineWrapperProps?: HTMLAttributes<HTMLDivElement> | undefined;
  activeCommandLineDirProps?: HTMLAttributes<HTMLSpanElement> | undefined;
  historyCommandTextProps?: HTMLAttributes<HTMLSpanElement> | undefined;
}

export const defaultInternalClasses = {
  activeCommandLineDir: 'text-white/40',
  activeCommandLineWrapper: 'flex items-center gap-2',
  body: 'p-8 min-h-[360px] bg-black/40 backdrop-blur-sm',
  commandLineDir: 'text-white/40',
  commandLinePrompt: 'font-bold opacity-50',
  commandLineWrapper: 'flex items-center gap-2 text-primary',
  commandPrompt: 'font-bold text-primary',
  commandText: 'font-bold text-white',
  commandWrapper: 'mb-6',
  commandWrapperInactive: 'opacity-60',
  cursor: 'w-2 h-4 bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]',
  cursorActive: 'opacity-100',
  cursorTyping: 'animate-pulse',
  directorySymbol: '~',
  dotContainer: 'flex gap-2',
  greenDot: 'w-3 h-3 rounded-full bg-green-500/30',
  header: 'bg-white/5 border-b border-white/10 px-4 py-3 flex items-center justify-between',
  headerSpacer: 'w-12',
  historyCommandText: 'font-bold text-primary',
  historyOutputWrapper: 'mt-2 pl-6 text-slate-400 space-y-1 border-l border-white/5',
  noise: 'opacity-[0.02]',
  outputLine: 'flex items-center gap-2',
  outputWrapper: 'mt-3 pl-6 text-slate-300 animate-slide-up space-y-1 border-l border-primary/30',
  promptSymbol: '➜',
  redDot: 'w-3 h-3 rounded-full bg-red-500/30',
  successIcon: 'i-ph-check-circle-fill text-accent text-xs',
  title: 'text-slate-500 text-[10px] uppercase tracking-widest font-bold opacity-60',
  titleText: 'bash — 80x24',
  yellowDot: 'w-3 h-3 rounded-full bg-yellow-500/30',
};

export const defaultClasses =
  'p-0 overflow-hidden border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-3xl mx-auto w-full font-mono text-sm relative';

export const Terminal = ({
  commands = [],
  className = '',
  useDefault = true,
  children,
  noiseProps,
  headerProps,
  dotContainerProps,
  redDotProps,
  yellowDotProps,
  greenDotProps,
  titleProps,
  bodyProps,
  commandWrapperProps,
  commandPromptProps,
  commandTextProps,
  cursorProps,
  outputWrapperProps,
  outputLineProps,
  headerSpacerProps,
  commandLineWrapperProps,
  commandLinePromptProps,
  commandLineDirProps,
  historyOutputWrapperProps,
  successIconProps,
  activeCommandLineWrapperProps,
  activeCommandLineDirProps,
  historyCommandTextProps,
  props: rootProps,
}: TerminalProps) => {
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [displayedCommand, setDisplayedCommand] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (commands.length === 0 || currentCommandIndex >= commands.length) {
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

  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <div {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          <Noise
            {...noiseProps}
            className={getSlotClass(useDefault, defaultInternalClasses.noise, noiseProps)}
          />
          <div
            {...headerProps}
            className={getSlotClass(useDefault, defaultInternalClasses.header, headerProps)}
          >
            <div
              {...dotContainerProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.dotContainer,
                dotContainerProps,
              )}
            >
              <div
                {...redDotProps}
                className={getSlotClass(useDefault, defaultInternalClasses.redDot, redDotProps)}
              />
              <div
                {...yellowDotProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.yellowDot,
                  yellowDotProps,
                )}
              />
              <div
                {...greenDotProps}
                className={getSlotClass(useDefault, defaultInternalClasses.greenDot, greenDotProps)}
              />
            </div>
            <div
              {...titleProps}
              className={getSlotClass(useDefault, defaultInternalClasses.title, titleProps)}
            >
              {defaultInternalClasses.titleText}
            </div>
            <div
              {...headerSpacerProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.headerSpacer,
                headerSpacerProps,
              )}
            />
          </div>

          <div
            {...bodyProps}
            className={getSlotClass(useDefault, defaultInternalClasses.body, bodyProps)}
          >
            {commands.slice(0, currentCommandIndex).map((cmd, idx) => (
              <div
                key={idx}
                {...commandWrapperProps}
                className={getSlotClass(
                  useDefault,
                  `${defaultInternalClasses.commandWrapper} ${defaultInternalClasses.commandWrapperInactive}`,
                  commandWrapperProps,
                )}
              >
                <div
                  {...commandLineWrapperProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.commandLineWrapper,
                    commandLineWrapperProps,
                  )}
                >
                  <span
                    {...commandLinePromptProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.commandLinePrompt,
                      commandLinePromptProps,
                    )}
                  >
                    {defaultInternalClasses.promptSymbol}
                  </span>
                  <span
                    {...commandLineDirProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.commandLineDir,
                      commandLineDirProps,
                    )}
                  >
                    {defaultInternalClasses.directorySymbol}
                  </span>
                  <span
                    {...historyCommandTextProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.historyCommandText,
                      historyCommandTextProps,
                    )}
                  >
                    {cmd.command}
                  </span>
                </div>
                <div
                  {...historyOutputWrapperProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.historyOutputWrapper,
                    historyOutputWrapperProps,
                  )}
                >
                  {cmd.output.map((line, lineIdx) => (
                    <div
                      key={lineIdx}
                      {...outputLineProps}
                      className={getSlotClass(
                        useDefault,
                        defaultInternalClasses.outputLine,
                        outputLineProps,
                      )}
                    >
                      {line.includes('✔') && (
                        <span
                          {...successIconProps}
                          className={getSlotClass(
                            useDefault,
                            defaultInternalClasses.successIcon,
                            successIconProps,
                          )}
                        />
                      )}
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {commands.length > 0 && (
              <div
                {...commandWrapperProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.commandWrapper,
                  commandWrapperProps,
                )}
              >
                <div
                  {...activeCommandLineWrapperProps}
                  className={getSlotClass(
                    useDefault,
                    defaultInternalClasses.activeCommandLineWrapper,
                    activeCommandLineWrapperProps,
                  )}
                >
                  <span
                    {...commandPromptProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.commandPrompt,
                      commandPromptProps,
                    )}
                  >
                    {defaultInternalClasses.promptSymbol}
                  </span>
                  <span
                    {...activeCommandLineDirProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.activeCommandLineDir,
                      activeCommandLineDirProps,
                    )}
                  >
                    {defaultInternalClasses.directorySymbol}
                  </span>
                  <span
                    {...commandTextProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.commandText,
                      commandTextProps,
                    )}
                  >
                    {displayedCommand}
                  </span>
                  <span
                    {...cursorProps}
                    className={getSlotClass(
                      useDefault,
                      `${defaultInternalClasses.cursor} ${
                        isTyping
                          ? defaultInternalClasses.cursorActive
                          : defaultInternalClasses.cursorTyping
                      }`,
                      cursorProps,
                    )}
                  />
                </div>

                {showOutput && (
                  <div
                    {...outputWrapperProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.outputWrapper,
                      outputWrapperProps,
                    )}
                  >
                    {commands[currentCommandIndex].output.map((line, lineIdx) => (
                      <div
                        key={lineIdx}
                        {...outputLineProps}
                        className={getSlotClass(
                          useDefault,
                          defaultInternalClasses.outputLine,
                          outputLineProps,
                        )}
                      >
                        {line.includes('✔') && (
                          <span
                            {...successIconProps}
                            className={getSlotClass(
                              useDefault,
                              defaultInternalClasses.successIcon,
                              successIconProps,
                            )}
                          />
                        )}
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
};
