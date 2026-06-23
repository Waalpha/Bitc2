import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';


// Monkey-patch HTMLVideoElement.prototype.play to handle the "play() request was interrupted" error gracefully
const originalPlay = HTMLVideoElement.prototype.play;
HTMLVideoElement.prototype.play = function() {
  const result = originalPlay.apply(this, arguments as any);
  if (result !== undefined && typeof result.catch === 'function') {
    return result.catch((error: any) => {
      if (error && (error.name === 'AbortError' || error.message?.includes('interrupted'))) {
        console.warn('Silent suppression of HTMLVideoElement.play() AbortError:', error.message);
      } else {
        throw error;
      }
    });
  }
  return result;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
