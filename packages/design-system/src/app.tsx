import { Preview } from './components/preview';
import { ModeProvider } from './context/mode-provider';
import { ThemeProvider } from './context/theme-provider';

const App = () => (
  <ThemeProvider>
    <ModeProvider>
      <Preview showDefault={true} />
    </ModeProvider>
  </ThemeProvider>
);

export default App;
