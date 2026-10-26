import { Button, Icon, Preview } from '@lightproject/design-system/components';

const PreviewPage = () => (
  <>
    <Button href='/' intent='secondary' size='sm' className='fixed top-4 left-4 z-50 gap-2'>
      <Icon name='i-ph-house-bold' />
      Home
    </Button>
    <Preview showDefault />
  </>
);

export default PreviewPage;
