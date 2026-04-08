import { Header, Preview } from '@lightproject/design-system';
import { logger } from '@lightproject/common';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    logger.info('Design System Showcase - Debug Mode', {
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <div className='min-h-screen font-sans'>
      <Header />
      <Preview />
    </div>
  );
};

export default App;
