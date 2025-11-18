import React, { createContext, useContext, useEffect, useState } from 'react';
import { getTelegramWebApp, getTelegramUser, TelegramUser, TelegramWebApp } from '@/lib/telegram';

interface TelegramContextType {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  isReady: boolean;
}

const TelegramContext = createContext<TelegramContextType>({
  webApp: null,
  user: null,
  isReady: false,
});

export const useTelegram = () => useContext(TelegramContext);

export const TelegramProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initTelegram = () => {
      const tg = getTelegramWebApp();
      if (tg) {
        tg.ready();
        tg.expand();
        setWebApp(tg);
        setUser(getTelegramUser());
      }
      setIsReady(true);
    };

    if (document.readyState === 'complete') {
      initTelegram();
    } else {
      window.addEventListener('load', initTelegram);
      return () => window.removeEventListener('load', initTelegram);
    }
  }, []);

  return (
    <TelegramContext.Provider value={{ webApp, user, isReady }}>
      {children}
    </TelegramContext.Provider>
  );
};
