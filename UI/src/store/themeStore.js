import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'light', // 'light' | 'dark'
      themeColor: '#3B82F6', // Primary Brand Color
      topBarColor: 'default',
      sidebarColor: 'default',
      sidebarBgImage: '',

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: next });
        document.documentElement.classList.toggle('dark', next === 'dark');
      },

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },

      setThemeColor: (color) => {
        set({ themeColor: color });
        document.documentElement.style.setProperty('--color-primary-500', color);
        document.documentElement.style.setProperty('--color-brand', color);
      },

      setTopBarColor: (color) => {
        set({ topBarColor: color });
        if (color === 'default') {
          document.documentElement.style.removeProperty('--header-bg');
        } else {
          document.documentElement.style.setProperty('--header-bg', color);
        }
      },

      setSidebarColor: (color) => {
        set({ sidebarColor: color });
        if (color === 'default') {
          document.documentElement.style.removeProperty('--sidebar-bg');
        } else {
          document.documentElement.style.setProperty('--sidebar-bg', color);
        }
      },

      setSidebarBgImage: (url) => {
        set({ sidebarBgImage: url });
        if (!url) {
          document.documentElement.style.removeProperty('--sidebar-bg-image');
        } else {
          document.documentElement.style.setProperty('--sidebar-bg-image', `url(${url})`);
        }
      },

      resetCustomizer: () => {
        set({
          theme: 'light',
          themeColor: '#3B82F6',
          topBarColor: 'default',
          sidebarColor: 'default',
          sidebarBgImage: '',
        });
        document.documentElement.classList.toggle('dark', false);
        document.documentElement.style.removeProperty('--color-primary-500');
        document.documentElement.style.removeProperty('--color-brand');
        document.documentElement.style.removeProperty('--header-bg');
        document.documentElement.style.removeProperty('--sidebar-bg');
        document.documentElement.style.removeProperty('--sidebar-bg-image');
      },

      initTheme: () => {
        const state = get();
        document.documentElement.classList.toggle('dark', state.theme === 'dark');
        
        if (state.themeColor && state.themeColor !== '#3B82F6') {
          document.documentElement.style.setProperty('--color-primary-500', state.themeColor);
          document.documentElement.style.setProperty('--color-brand', state.themeColor);
        }
        if (state.topBarColor && state.topBarColor !== 'default') {
          document.documentElement.style.setProperty('--header-bg', state.topBarColor);
        }
        if (state.sidebarColor && state.sidebarColor !== 'default') {
          document.documentElement.style.setProperty('--sidebar-bg', state.sidebarColor);
        }
        if (state.sidebarBgImage) {
          document.documentElement.style.setProperty('--sidebar-bg-image', `url(${state.sidebarBgImage})`);
        }
      },
    }),
    { name: 'agnohire-theme' }
  )
);
