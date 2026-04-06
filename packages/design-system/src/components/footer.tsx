import { Container } from './layout';
import { Logo } from './logo';

interface FooterLink {
  href: string;
  label: string;
}

interface SocialLink {
  href: string;
  icon: string;
}

interface FooterProps {
  links?: FooterLink[];
  socials?: SocialLink[];
  copyright?: string;
}

export const Footer = ({ links, socials, copyright }: FooterProps) => (
  <footer className='py-20 border-t border-white/5 bg-surface-dark relative overflow-hidden'>
    <div className='absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/5 blur-[100px] rounded-full animate-pulse-slow'></div>

    <Container className='flex flex-col md:flex-row justify-between items-center gap-12 relative z-10'>
      <div className='flex flex-col items-center md:items-start gap-4'>
        <Logo className='opacity-80 grayscale hover:grayscale-0 transition-all duration-500' />
        <p className='text-slate-500 text-sm max-w-xs text-center md:text-left'>
          Scale your engineering with the next generation of web toolchains.
        </p>
      </div>

      <div className='flex flex-col items-center md:items-end gap-6'>
        <div className='flex gap-12 text-slate-400'>
          {(
            links ?? [
              { href: '#', label: 'Privacy' },
              { href: '#', label: 'Terms' },
              { href: '#', label: 'Cloud' },
            ]
          ).map((link, index) => (
            <a
              key={index}
              href={link.href}
              className='hover:text-white transition-colors duration-200 font-medium text-sm'
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className='flex gap-6 text-slate-400'>
          {(
            socials ?? [
              { href: '#', icon: 'i-ph-twitter-logo-fill' },
              { href: '#', icon: 'i-ph-discord-logo-fill' },
              { href: '#', icon: 'i-ph-github-logo-fill' },
            ]
          ).map((social, index) => (
            <a
              key={index}
              href={social.href}
              className='hover:text-white transition-all duration-300 hover:scale-125'
            >
              <div className={social.icon}></div>
            </a>
          ))}
        </div>

        <p className='text-slate-600 text-xs mt-4'>
          {copyright ?? `© ${new Date().getFullYear()} Light Project. All rights reserved.`}
        </p>
      </div>
    </Container>
  </footer>
);
