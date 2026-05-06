import { useId, useState } from 'react';

const Sample = () => {
  const inputId = useId();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');

  const handleClick = () => {
    setMessage('Success!');
  };

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <h2 className='mb-4 font-semibold text-2xl text-gray-800'>
        Sample Component
      </h2>
      <div className='space-y-4'>
        <div>
          <label className='block text-gray-700' htmlFor={inputId}>
            Sample
          </label>
          <input
            className='w-full rounded border p-2'
            id={inputId}
            onChange={e => setText(e.target.value)}
            placeholder='Enter to chain'
            type='text'
            value={text}
          />
        </div>
        <button
          className='rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600'
          onClick={handleClick}
          type='button'
        >
          Test
        </button>
        {message && <p className='mt-2 text-gray-600'>{message}</p>}
      </div>
    </div>
  );
};

export default Sample;
