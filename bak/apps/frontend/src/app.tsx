import { useState } from 'react';

import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import './app.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href='https://vite.dev' rel='noopener' target='_blank'>
          <img
            alt='Vite logo'
            className='logo'
            height={60}
            src={viteLogo}
            width={60}
          />
        </a>
        <a href='https://react.dev' rel='noopener' target='_blank'>
          <img
            alt='React logo'
            className='logo react'
            height={60}
            src={reactLogo}
            width={60}
          />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className='card'>
        <button onClick={() => setCount(count => count + 1)} type='button'>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className='read-the-docs'>
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
