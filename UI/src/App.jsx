import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AppRouter } from './routes/AppRouter';
import { useThemeStore } from './store/themeStore';
import './styles/globals.css';

export default function App() {
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, []);

  return (
    <>
      <AppRouter />
      <Toaster
        position="top-center"
        containerStyle={{
          top: 16,
        }}
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 13,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 10,
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#fff' },
          },
        }}
      />
    </>
  );
}
