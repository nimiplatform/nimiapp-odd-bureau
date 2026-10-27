import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { NimiNavigationLeaveGuard } from '@nimiplatform/kit/core/navigation';
import { NimiNavigationProvider } from '@nimiplatform/kit/ui/app-chrome';
import { createOddBureauNavigation, type OddBureauDestination } from '../../odd-bureau/navigation.js';
import { language } from '../../odd-bureau/i18n.js';

type LeaveGuard = NimiNavigationLeaveGuard<OddBureauDestination>;
type NavigationOwner = {
  navigation: ReturnType<typeof createOddBureauNavigation>;
  locale: 'en' | 'zh';
  ready: boolean;
  setReady: (ready: boolean) => void;
  sidebarAvailable: boolean;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  setLeaveGuard: (guard: LeaveGuard) => () => void;
};
const Context = createContext<NavigationOwner | null>(null);
export function useAppNavigation(): NavigationOwner {
  const owner = useContext(Context);
  if (!owner) throw new Error('Odd Bureau navigation owner is missing.');
  return owner;
}
export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const leaveGuard = useRef<LeaveGuard | null>(null);
  const [navigation] = useState(() => createOddBureauNavigation(context => leaveGuard.current?.(context) ?? 'allow'));
  const [ready, updateReady] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const lifetime = useRef(0);
  useEffect(() => {
    const generation = ++lifetime.current;
    return () => {
      navigation.reset({ id: 'home' });
      queueMicrotask(() => { if (lifetime.current === generation) navigation.dispose(); });
    };
  }, [navigation]);
  const setReady = useCallback((value: boolean) => {
    if (!value) navigation.reset({ id: 'home' });
    updateReady(value);
  }, [navigation]);
  const setLeaveGuard = useCallback((guard: LeaveGuard) => {
    leaveGuard.current = guard;
    return () => { if (leaveGuard.current === guard) leaveGuard.current = null; };
  }, []);
  return <Context.Provider value={{ navigation, locale: language, ready, setReady, sidebarAvailable: false, sidebarVisible, setSidebarVisible, setLeaveGuard }}>
    <NimiNavigationProvider controller={navigation}>{children}</NimiNavigationProvider>
  </Context.Provider>;
}
