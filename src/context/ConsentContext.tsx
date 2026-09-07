import React, { createContext, useContext, useState, useEffect } from "react";
import { CookieConsentSettings } from "../types";

interface ConsentContextType {
  consent: CookieConsentSettings;
  updateConsent: (settings: Partial<CookieConsentSettings>) => void;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
}

const DEFAULT_CONSENT: CookieConsentSettings = {
  necessary: true,
  analytics: true,
  marketing: true,
  functional: true,
  answered: false,
  timestamp: new Date().toISOString(),
  consentId: "LGPD-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
};

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

export const ConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consent, setConsent] = useState<CookieConsentSettings>(() => {
    try {
      const stored = localStorage.getItem("norma_juridica_consent");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return DEFAULT_CONSENT;
  });

  const [showBanner, setShowBanner] = useState<boolean>(!consent.answered);

  useEffect(() => {
    try {
      localStorage.setItem("norma_juridica_consent", JSON.stringify(consent));
    } catch {
      // ignore
    }
  }, [consent]);

  const updateConsent = (settings: Partial<CookieConsentSettings>) => {
    setConsent(prev => ({
      ...prev,
      ...settings,
      necessary: true, // Always required
      answered: true,
      timestamp: new Date().toISOString(),
    }));
    setShowBanner(false);
  };

  const acceptAll = () => {
    updateConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    });
  };

  const rejectNonEssential = () => {
    updateConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    });
  };

  return (
    <ConsentContext.Provider
      value={{
        consent,
        updateConsent,
        acceptAll,
        rejectNonEssential,
        showBanner,
        setShowBanner,
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
};

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return context;
}
