import { Header, Preview } from '@lightproject/design-system/components';
import { logger } from '@lightproject/common/logger';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    logger.info('Design System Showcase - Debug Mode', {
      timestamp: new Date().toISOString(),
      ua: globalThis.navigator.userAgent,
    });
  }, []);

  return (
    <div className=''>
      <Header />
      <Preview />
    </div>
  );
};

export default App;
