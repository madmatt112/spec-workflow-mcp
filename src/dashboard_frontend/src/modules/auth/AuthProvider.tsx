import React, { useEffect, useState } from 'react';
import { installUnauthorizedHandler, hasSeenUnauthorized, UNAUTHORIZED_EVENT } from './unauthorized';
import { LoginPanel } from './LoginPanel';

// Patch fetch before the app renders so a 401 anywhere raises the event below.
installUnauthorizedHandler();

/**
 * Shows the login panel over the shell on the first 401 (controller-design.md
 * §17). It listens for the single unauthorized event and also catches a 401
 * that fired before the listener attached. No other UI change.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (hasSeenUnauthorized()) setNeedsLogin(true);
    const onUnauthorized = () => setNeedsLogin(true);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  return (
    <>
      {children}
      {needsLogin && <LoginPanel />}
    </>
  );
}
