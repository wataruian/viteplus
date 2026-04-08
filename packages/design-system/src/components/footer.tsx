import { Container, type ContainerProps } from './layout';
import type { HTMLAttributes, ReactNode } from 'react';
import { Logo, type LogoProps } from './logo';
import { getSlotClass } from '../utils/styles';

interface FooterLink {
  href: string;
  label: string;
}

interface SocialLink {
  href: string;
  label?: string;
  icon: string;
}

export interface FooterProps {
  brandWrapperProps?: HTMLAttributes<HTMLDivElement>;
  children?: ReactNode;
  className?: string;
  containerProps?: ContainerProps;
  copyright?: string;
  copyrightProps?: HTMLAttributes<HTMLParagraphElement>;
  glowProps?: HTMLAttributes<HTMLDivElement>;
  linkProps?: HTMLAttributes<HTMLAnchorElement>;
  links?: FooterLink[];
  linksWrapperProps?: HTMLAttributes<HTMLDivElement>;
  logoProps?: LogoProps;
  logoTextTop?: string;
  logoTextBottom?: string;
  rightWrapperProps?: HTMLAttributes<HTMLDivElement>;
  props?: HTMLAttributes<HTMLElement>;
  socialLinkProps?: HTMLAttributes<HTMLAnchorElement>;
  socials?: SocialLink[];
  socialsWrapperProps?: HTMLAttributes<HTMLDivElement>;
  taglineProps?: HTMLAttributes<HTMLParagraphElement>;
  taglineText?: string;
  useDefault?: boolean;
}

export const defaultInternalClasses = {
  brandWrapper: 'flex flex-col items-center md:items-start gap-4',
  container: 'flex flex-col md:flex-row justify-between items-center gap-12 relative z-10',
  copyright: 'text-slate-600 text-xs mt-4',
  copyrightText: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
  glow: 'absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/5 blur-[100px] rounded-full',
  link: 'hover:text-white transition-colors duration-200 font-medium text-sm',
  links: [
    { href: '#', label: 'Privacy' },
    { href: '#', label: 'Terms' },
    { href: '#', label: 'Cloud' },
  ],
  linksWrapper: 'flex gap-12 text-slate-400',
  logo: 'opacity-80 grayscale hover:grayscale-0 transition-all duration-500',
  rightWrapper: 'flex flex-col items-center md:items-end gap-6',
  socialLink: 'hover:text-white transition-all duration-300 hover:scale-125',
  socials: [
    { href: '#', icon: 'i-ph-twitter-logo-fill', label: 'Twitter' },
    { href: '#', icon: 'i-ph-discord-logo-fill', label: 'Discord' },
    { href: '#', icon: 'i-ph-github-logo-fill', label: 'GitHub' },
  ],
  socialsWrapper: 'flex gap-6 text-slate-400',
  tagline: 'text-slate-500 text-sm max-w-xs text-center md:text-left',
  taglineText: 'Building the future with modern tech.',
};

export const defaultClasses = 'py-20 border-t border-white/5 relative overflow-hidden';

export const Footer = ({
  brandWrapperProps,
  children,
  className = '',
  containerProps,
  copyright,
  copyrightProps,
  glowProps,
  linkProps,
  links,
  linksWrapperProps,
  logoProps,
  logoTextTop,
  logoTextBottom,
  rightWrapperProps,
  socialLinkProps,
  socials,
  socialsWrapperProps,
  taglineProps,
  taglineText,
  props: rootProps,
  useDefault = true,
}: FooterProps) => {
  const finalClassName = useDefault ? `${defaultClasses} ${className}` : className;

  return (
    <footer {...rootProps} className={getSlotClass(useDefault, finalClassName, rootProps)}>
      {useDefault ? (
        <>
          <div
            {...glowProps}
            className={getSlotClass(useDefault, defaultInternalClasses.glow, glowProps)}
          ></div>

          <Container
            {...containerProps}
            className={getSlotClass(useDefault, defaultInternalClasses.container, containerProps)}
          >
            <div
              {...brandWrapperProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.brandWrapper,
                brandWrapperProps,
              )}
            >
              <Logo
                {...logoProps}
                className={getSlotClass(useDefault, defaultInternalClasses.logo, logoProps)}
                textTop={logoTextTop}
                textBottom={logoTextBottom}
              />
              <p
                {...taglineProps}
                className={getSlotClass(useDefault, defaultInternalClasses.tagline, taglineProps)}
              >
                {taglineText ?? defaultInternalClasses.taglineText}
              </p>
            </div>

            <div
              {...rightWrapperProps}
              className={getSlotClass(
                useDefault,
                defaultInternalClasses.rightWrapper,
                rightWrapperProps,
              )}
            >
              <div
                {...linksWrapperProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.linksWrapper,
                  linksWrapperProps,
                )}
              >
                {(links ?? defaultInternalClasses.links).map((link, index) => (
                  <a
                    key={index}
                    href={link.href}
                    {...linkProps}
                    className={getSlotClass(useDefault, defaultInternalClasses.link, linkProps)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <div
                {...socialsWrapperProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.socialsWrapper,
                  socialsWrapperProps,
                )}
              >
                {(socials ?? defaultInternalClasses.socials).map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    {...socialLinkProps}
                    aria-label={social.label}
                    className={getSlotClass(
                      useDefault,
                      defaultInternalClasses.socialLink,
                      socialLinkProps,
                    )}
                  >
                    <div className={social.icon}></div>
                  </a>
                ))}
              </div>

              <p
                {...copyrightProps}
                className={getSlotClass(
                  useDefault,
                  defaultInternalClasses.copyright,
                  copyrightProps,
                )}
              >
                {copyright ?? defaultInternalClasses.copyrightText}
              </p>
            </div>
          </Container>
          {children}
        </>
      ) : (
        children
      )}
    </footer>
  );
};
