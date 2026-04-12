import { Preview } from '@lightproject/design-system/components';
import { layoutStyles } from '@lightproject/design-system/tokens';
import { logger } from '@lightproject/common/logger';
import { useEffect } from 'react';

const App = () => {
  useEffect(() => {
    logger.info('Design System Showcase - Production Mode', {
      platform: globalThis.navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <div className={layoutStyles.variants.type.appRoot}>
      <Preview />
    </div>
  );
};

export default App;
