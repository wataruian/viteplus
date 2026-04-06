import { BentoGrid, BentoItem } from './bento-grid';
import { Container, Section } from './layout';

interface Feature {
  title: string;
  description: string;
  icon: string;
  span?: string;
}

interface FeaturesProps {
  title: string;
  features: Feature[];
  subtitle?: string;
}

export const Features = ({ title, subtitle, features }: FeaturesProps) => (
  <Section className='bg-surface-dark/50'>
    <Container>
      <div className='text-center mb-20 animate-reveal'>
        <h2 className='text-4xl md:text-6xl font-black text-white mb-6 font-header leading-tight'>
          {title}
        </h2>
        {Boolean(subtitle) && (
          <p className='text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed'>{subtitle}</p>
        )}
      </div>

      <BentoGrid>
        {features.map((feature, index) => (
          <BentoItem
            key={index}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
            span={feature.span ?? (index % 4 === 0 ? 'md:col-span-2' : 'md:col-span-1')}
            className='animate-reveal'
            style={{ animationDelay: `${0.1 * (index + 1)}s` }}
          />
        ))}
      </BentoGrid>
    </Container>
  </Section>
);
