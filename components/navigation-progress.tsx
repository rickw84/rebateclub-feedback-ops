"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

type NavigationProgressContextValue = {
  beginNavigation: () => void;
  isNavigating: boolean;
};

const NavigationProgressContext = createContext<NavigationProgressContextValue | null>(null);

const SCROLL_KEY = "rebateclub-pending-scroll-y";
const MIN_VISIBLE_MS = 450;

export function NavigationProgressProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const previousUrlRef = useRef<string | null>(null);
  const navigationStartRef = useRef<number | null>(null);

  const currentUrl = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if (previousUrlRef.current === null) {
      previousUrlRef.current = currentUrl;
      return;
    }

    if (previousUrlRef.current !== currentUrl) {
      const savedScroll = sessionStorage.getItem(SCROLL_KEY);
      const finishNavigation = () => {
        if (savedScroll) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: Number(savedScroll),
              behavior: "auto"
            });
            sessionStorage.removeItem(SCROLL_KEY);
          });
        }

        previousUrlRef.current = currentUrl;
        navigationStartRef.current = null;
        setIsNavigating(false);
      };

      const elapsed = navigationStartRef.current ? Date.now() - navigationStartRef.current : MIN_VISIBLE_MS;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

      if (remaining > 0) {
        window.setTimeout(finishNavigation, remaining);
      } else {
        finishNavigation();
      }
    }
  }, [currentUrl]);

  const value = useMemo<NavigationProgressContextValue>(
    () => ({
      beginNavigation: () => {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        navigationStartRef.current = Date.now();
        setIsNavigating(true);
      },
      isNavigating
    }),
    [isNavigating]
  );

  return (
    <NavigationProgressContext.Provider value={value}>
      {children}
      {isNavigating ? (
        <div className="page-loading-shell" aria-busy="true" aria-live="polite">
          <div className="page-loading-card">
            <div className="global-spinner" />
            <div className="page-loading-copy">
              <strong>Loading...</strong>
              <span>Please wait while the page updates.</span>
            </div>
          </div>
        </div>
      ) : null}
    </NavigationProgressContext.Provider>
  );
}

export function useNavigationProgress() {
  const context = useContext(NavigationProgressContext);
  if (!context) {
    throw new Error("useNavigationProgress must be used within NavigationProgressProvider");
  }

  return context;
}
