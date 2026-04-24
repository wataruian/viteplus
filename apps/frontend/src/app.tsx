import { Preview } from '@lightproject/design-system/components';
import { logger } from '@lightproject/common/logger';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    logger.info('Frontend Start', {
      platform: globalThis.navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, [logger]);

  return (
    <>
      <Preview />
    </>
  );
};

export default App;
