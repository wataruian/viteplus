import { Button, type ButtonProps } from './button';
import { Container, type ContainerProps } from './layout';
import type { HTMLAttributes, ReactNode } from 'react';
import { Logo, type LogoProps } from './logo';
import { ThemeSwitcher } from './theme-switcher';
import { getSlotClass } from '../utils/styles';

export interface HeaderProps {
  children?: ReactNode;
  className?: string;
  containerProps?: ContainerProps;
  githubButtonProps?: ButtonProps;
  githubHref?: string;
  githubIconProps?: HTMLAttributes<HTMLDivElement>;
  githubText?: string;
  leftSectionProps?: HTMLAttributes<HTMLDivElement>;
  logoProps?: LogoProps;
  logoWrapperProps?: HTMLAttributes<HTMLDivElement>;
  navLinkProps?: HTMLAttributes<HTMLAnchorElement>;
  navLinks?: { href: string; label: string }[];
  navWrapperProps?: HTMLAttributes<HTMLDivElement>;
  rightSectionProps?: HTMLAttributes<HTMLDivElement>;
  startButtonProps?: ButtonProps;
  startHref?: string;
  startText?: string;
  props?: HTMLAttributes<HTMLElement>;
  themeSwitcherWrapperProps?: HTMLAttributes<HTMLDivElement>;
  useDefault?: boolean;
}

export const defaultInternalClasses = {
  container: 'w-full flex items-center justify-between gap-4',
  githubButton:
    'hidden md:flex border border-black/20 dark:border-white/20 transition-all active:scale-90',
  githubButtonProps: { size: 'sm', variant: 'ghost' } as ButtonProps,
  githubHref: '#',
  githubIcon: 'i-ph-github-logo-fill mr-2',
  githubText: 'GitHub',
  leftSection: 'flex items-center gap-8',
  logoWrapper: '',
  navLink: 'nav-link',
  navLinks: [
    { href: '#features', label: 'Features' },
    { href: '#docs', label: 'Docs' },
    { href: '#pricing', label: 'Pricing' },
  ],
  navWrapper: 'hidden lg:flex items-center gap-8',
  rightSection: 'flex items-center gap-4',
  startButton: 'px-6 border border-black/20 dark:border-white/20 transition-all active:scale-90',
  startButtonProps: { size: 'sm', variant: 'premium' } as ButtonProps,
  startHref: '#',
  startText: 'Get Started',
  themeSwitcherWrapper: 'hidden sm:block',
};

export const defaultClasses =
  'h-20 flex items-center sticky top-0 z-50 bg-white dark:bg-[#050505] border-b border-black/10 dark:border-white/10 transition-all duration-300';

export const Header = ({
  children,
  className = '',
  containerProps,
  githubButtonProps,
  githubHref,
  githubIconProps,
  githubText,
  leftSectionProps,
  logoProps,
  logoWrapperProps,
  navLinkProps,
  navLinks,
  navWrapperProps,
  rightSectionProps,
  startButtonProps,
  startHref,
  startText,
  themeSwitcherWrapperProps,
  props: rootProps,
  useDefault = true,
}: HeaderProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <header {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <Container
          {...containerProps}
          className={getSlotClass(useDefault, defaultInternalClasses.container, containerProps)}
        >
          <div
            {...leftSectionProps}
            className={getSlotClass(
              useDefault,
              defaultInternalClasses.leftSection,
              leftSectionProps,
            )}
          >
            <div
              {...logoWrapperProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.logoWrapper,
                logoWrapperProps,
              )}
            >
              <Logo {...logoProps} useDefault={useDefault} />
            </div>
            <div
              {...navWrapperProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.navWrapper,
                navWrapperProps,
              )}
            >
              {children ??
                (navLinks ?? defaultInternalClasses.navLinks).map((link, index) => (
                  <a
                    key={index}
                    href={link.href}
                    {...navLinkProps}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.navLink,
                      navLinkProps,
                    )}
                  >
                    {link.label}
                  </a>
                ))}
            </div>
          </div>
          <div
            {...rightSectionProps}
            className={getSlotClass(
              useDefault,
              defaultInternalClasses.rightSection,
              rightSectionProps,
            )}
          >
            <div
              {...themeSwitcherWrapperProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.themeSwitcherWrapper,
                themeSwitcherWrapperProps,
              )}
            >
              <ThemeSwitcher />
            </div>
            <Button
              useDefault={useDefault}
              href={githubHref ?? defaultInternalClasses.githubHref}
              {...defaultInternalClasses.githubButtonProps}
              {...githubButtonProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.githubButton,
                githubButtonProps,
              )}
            >
              <div
                {...githubIconProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.githubIcon,
                  githubIconProps,
                )}
              ></div>
              {githubText ?? defaultInternalClasses.githubText}
            </Button>
            <Button
              useDefault={useDefault}
              href={startHref ?? defaultInternalClasses.startHref}
              {...defaultInternalClasses.startButtonProps}
              {...startButtonProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.startButton,
                startButtonProps,
              )}
            >
              {startText ?? defaultInternalClasses.startText}
            </Button>
          </div>
        </Container>
      ) : (
        children
      )}
    </header>
  );
};
