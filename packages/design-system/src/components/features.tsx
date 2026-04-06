import { Container, Section } from './layout';

interface Feature {
  title: string;
  description: string;
  icon: string;
  span?: string;
}

interface FeaturesProps {
  title: string;
  subtitle: string;
  features: Feature[];
}

export const Features = ({ title, subtitle, features }: FeaturesProps) => (
  <Section className='bg-surface-dark/50'>
    <Container>
      <div className='text-center mb-20 animate-reveal'>
        <h2 className='text-4xl md:text-5xl font-black text-white mb-6 font-header tracking-tight'>
          {title}
        </h2>
        <p className='text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed'>{subtitle}</p>
      </div>

      <div className='bento-grid'>
        {features.map((feature, idx) => (
          <div
            key={idx}
            className={`bento-item p-10 flex flex-col justify-end group border-white/5 hover:border-primary-500/30 transition-all duration-500 ${
              feature.span ?? ''
            }`}
          >
            <div className='absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

            <div className='relative z-10'>
              <div className='w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:bg-primary-500/10 group-hover:scale-110 transition-all duration-500'>
                <span
                  className={`${feature.icon} text-3xl text-primary-400 group-hover:text-primary-300`}
                ></span>
              </div>
              <h3 className='text-2xl font-bold text-white mb-4 group-hover:text-primary-300 transition-colors'>
                {feature.title}
              </h3>
              <p className='text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors'>
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Container>
  </Section>
);
