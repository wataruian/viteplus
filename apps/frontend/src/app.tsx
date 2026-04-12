import { Preview } from '@lightproject/design-system/components';
import { logger } from '@lightproject/common/logger';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    logger.info('Design System Showcase - Production Mode', {
      platform: globalThis.navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return <Preview />;
};

export default App;
