import { useTheme } from './context';

const ThemeSelector = () => {
  const { setTheme, theme } = useTheme();

  return (
    <button
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={
        'rounded-lg border border-neutral-200 bg-neutral-100 p-2.5 transition-all duration-200 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700'
      }
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      type='button'
    >
      {theme === 'dark' ? (
        <svg
          className='h-5 w-5 text-amber-300'
          fill='currentColor'
          viewBox='0 0 20 20'
        >
          <title>Sun icon</title>
          <path
            clipRule='evenodd'
            d='M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z'
            fillRule='evenodd'
          />
        </svg>
      ) : (
        <svg
          className='h-5 w-5 text-neutral-700'
          fill='currentColor'
          viewBox='0 0 20 20'
        >
          <title>Moon icon</title>
          <path d='M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z' />
        </svg>
      )}
    </button>
  );
};

export { ThemeSelector };

// import { useEffect, useState } from 'react';

// const getInitialTheme = () => {
//   return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
// };

// export const ThemeSelector = () => {
//   const [theme, setTheme] = useState(getInitialTheme());

//   const toggleTheme = () => {
//     const newTheme = theme === 'dark' ? 'light' : 'dark';
//     setTheme(newTheme);
//     document.documentElement.classList.toggle('dark', newTheme === 'dark');
//   };

//   // Sync with external changes to theme
//   useEffect(() => {
//     setTheme(getInitialTheme());
//   }, []);

//   return (
//     <button
//       aria-label='Toggle Dark Mode'
//       className='w-10 h-10 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 transition-colors duration-300 border border-neutral-300 dark:border-neutral-600 hover:shadow-lg active:scale-95'
//       onClick={toggleTheme}
//     >
//       {theme === 'dark' ? (
//         // Sun icon
//         <svg
//           className='w-6 h-6 text-yellow-400'
//           fill='none'
//           stroke='currentColor'
//           viewBox='0 0 24 24'
//           xmlns='http://www.w3.org/2000/svg'
//         >
//           <path
//             d='M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05L5.636 5.636m12.728 0l-1.414 1.414M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z'
//             strokeLinecap='round'
//             strokeLinejoin='round'
//             strokeWidth={2}
//           />
//         </svg>
//       ) : (
//         // Moon icon
//         <svg
//           className='w-6 h-6 text-gray-800'
//           fill='currentColor'
//           stroke='currentColor'
//           viewBox='0 0 24 24'
//           xmlns='http://www.w3.org/2000/svg'
//         >
//           <path
//             d='M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'
//             strokeLinecap='round'
//             strokeLinejoin='round'
//             strokeWidth={2}
//           />
//         </svg>
//       )}
//     </button>
//   );
// };
