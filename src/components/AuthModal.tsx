import React, { useState, useEffect, useRef } from "react";
import { firebaseAuthService } from "../services/firebaseAuthService";
import { X, Shield, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMetrics?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenMetrics }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Initialize official Google Identity Services button if available
  useEffect(() => {
    if (!isOpen) return;

    const initGis = () => {
      const g = (window as any)?.google;
      if (g?.accounts?.id && googleBtnContainerRef.current) {
        try {
          g.accounts.id.initialize({
            client_id: "878021514659-girlu7mhvr9n0r7jqt0k7grrk0eossoq.apps.googleusercontent.com",
            callback: async (response: any) => {
              if (response?.credential) {
                setLoading(true);
                setErrorMessage(null);
                try {
                  // Decode JWT to extract user details
                  const base64Url = response.credential.split(".")[1];
                  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                  const jsonPayload = decodeURIComponent(
                    atob(base64)
                      .split("")
                      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                      .join("")
                  );
                  const profile = JSON.parse(jsonPayload);
                  
                  const accountRes = await firebaseAuthService.signInWithGoogleAccount({
                    email: profile.email,
                    displayName: profile.name,
                    photoURL: profile.picture,
                  });

                  // Also link to Firebase credential
                  firebaseAuthService.signInWithGoogleCredential(response.credential).catch(() => {});

                  if (accountRes.success) {
                    setSuccessMessage(
                      accountRes.isAdmin
                        ? "Autenticado com sucesso como Administrador!"
                        : "Login com o Google realizado com sucesso!"
                    );
                    setTimeout(() => {
                      onClose();
                      if (accountRes.isAdmin && onOpenMetrics) onOpenMetrics();
                    }, 500);
                  }
                } catch {
                  setErrorMessage("Não foi possível autenticar a Conta Google.");
                } finally {
                  setLoading(false);
                }
              }
            },
            auto_select: false,
          });

          googleBtnContainerRef.current.innerHTML = "";
          g.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "signin_with",
            shape: "pill",
            logo_alignment: "left",
          });
        } catch (e) {
          console.warn("GIS setup notice:", e);
        }
      }
    };

    const timer = setTimeout(initGis, 150);
    return () => clearTimeout(timer);
  }, [isOpen, onClose, onOpenMetrics]);

  if (!isOpen) return null;

  // Single exclusive Google Sign-In action - 100% automatic without any manual email typing
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await firebaseAuthService.signInWithGoogle();
      if (res.success) {
        const isAdmin = res.isAdmin;
        setSuccessMessage(
          isAdmin
            ? "Autenticado com sucesso como Administrador!"
            : "Login com o Google realizado com sucesso!"
        );
        setTimeout(() => {
          onClose();
          if (isAdmin && onOpenMetrics) {
            onOpenMetrics();
          }
        }, 500);
      } else {
        setErrorMessage(res.error || "Não foi possível conectar com o Google. Tente novamente.");
      }
    } catch {
      setErrorMessage("Erro ao autenticar com o Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="auth-modal-content"
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-blue-900/60 rounded-3xl shadow-2xl overflow-hidden transition-all text-slate-900 dark:text-slate-100"
      >
        {/* Accent bar with Google colors */}
        <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-red-500 via-amber-400 to-green-500" />

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Entrar com o Google
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Norma Jurídica • Acesso Oficial
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            Acesse diretamente com sua Conta Google. Seu avatar e nome do Google serão exibidos no canto superior direito do portal.
          </p>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Exclusive Google Sign-In Actions */}
          <div className="space-y-4">
            {/* Google Identity Services official rendered button container */}
            <div ref={googleBtnContainerRef} className="flex justify-center empty:hidden min-h-[44px]" />

            {/* Custom Google button */}
            <button
              id="google-sign-in-action-btn"
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-3.5 px-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>{loading ? "Conectando ao Google..." : "Entrar com o Google"}</span>
            </button>

            {/* Privacy note */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  Autenticação exclusiva via Conta Google. Administradores autorizados têm acesso completo ao Painel de Métricas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
