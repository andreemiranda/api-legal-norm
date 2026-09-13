import React, { useState } from "react";
import {
  firebaseAuthService,
  isEmailAdmin,
} from "../services/firebaseAuthService";
import {
  X,
  Shield,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  User,
  ArrowRight,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMetrics?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenMetrics }) => {
  const [authMethod, setAuthMethod] = useState<"google" | "admin_password">("google");

  // Google Login State
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [showGoogleAccountPicker, setShowGoogleAccountPicker] = useState(false);

  // Admin Password Login State
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Google Sign-In Flow (Both for Readers and Admins)
  const handleGoogleSignInClick = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Try native popup if available
    const nativeRes = await firebaseAuthService.signInWithGooglePopup();
    if (nativeRes.success) {
      const isAdmin = nativeRes.isAdmin;
      setSuccessMessage(
        isAdmin
          ? "Bem-vindo(a), Administrador(a)! Acesso autorizado."
          : "Login realizado com sucesso com sua Conta Google!"
      );
      setTimeout(() => {
        onClose();
        if (isAdmin && onOpenMetrics) {
          onOpenMetrics();
        }
      }, 700);
      setLoading(false);
      return;
    }

    // If popup requires user interaction or fallback
    setShowGoogleAccountPicker(true);
    setLoading(false);
  };

  const handleConfirmGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const cleanEmail = googleEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Por favor, insira um e-mail válido da sua Conta Google.");
      setLoading(false);
      return;
    }

    try {
      const res = await firebaseAuthService.signInWithGoogleAccount({
        email: cleanEmail,
        displayName: googleName.trim() || undefined,
      });

      if (res.success) {
        setSuccessMessage(
          res.isAdmin
            ? "Autenticado como Administrador com a Conta Google!"
            : "Conectado com sucesso com sua Conta Google!"
        );
        setTimeout(() => {
          onClose();
          if (res.isAdmin && onOpenMetrics) {
            onOpenMetrics();
          }
        }, 700);
      } else {
        setErrorMessage(res.error || "Não foi possível concluir o login.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Falha ao autenticar com o Google.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Admin Password Flow
  const handleAdminPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = adminEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Informe o e-mail de administrador.");
      setLoading(false);
      return;
    }

    if (!adminPassword) {
      setErrorMessage("Informe a senha de administrador.");
      setLoading(false);
      return;
    }

    try {
      const res = await firebaseAuthService.signInWithAdminPassword(
        cleanEmail,
        adminPassword,
        adminName.trim() || undefined
      );

      if (res.success) {
        setSuccessMessage("Autenticação administrativa concluída com sucesso!");
        setTimeout(() => {
          onClose();
          if (onOpenMetrics) {
            onOpenMetrics();
          }
        }, 700);
      } else {
        setErrorMessage(res.error || "Acesso recusado. Verifique os dados.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao autenticar com senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="auth-modal-box"
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-blue-900/60 rounded-3xl shadow-2xl p-6 sm:p-8 text-slate-800 dark:text-slate-100 modal-content transition-all"
      >
        {/* Close Button */}
        <button
          id="auth-modal-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Branding Header - Google Classic Minimalist Aesthetic */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-3 shadow-inner">
            <GoogleLogoIcon className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {showGoogleAccountPicker
              ? "Escolha uma conta Google"
              : authMethod === "google"
              ? "Fazer login com o Google"
              : "Acesso Administrativo"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {showGoogleAccountPicker
              ? "para continuar no portal Norma Jurídica"
              : authMethod === "google"
              ? "Acesse com sua Conta Google como leitor ou administrador"
              : "Digite seu e-mail e senha de administrador autorizados"}
          </p>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div
            id="auth-error-alert"
            className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-semibold text-rose-800 dark:text-rose-300">Não foi possível entrar:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div
            id="auth-success-alert"
            className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-200 flex items-start gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">{successMessage}</p>
          </div>
        )}

        {/* 1. MAIN GOOGLE LOGIN VIEW */}
        {authMethod === "google" && !showGoogleAccountPicker && (
          <div className="space-y-5">
            {/* Classic Google Button */}
            <button
              id="google-sign-in-btn"
              type="button"
              onClick={handleGoogleSignInClick}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm border border-slate-300 shadow-sm hover:shadow active:scale-[0.99] transition-all cursor-pointer dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-750"
            >
              <GoogleLogoIcon className="w-5 h-5" />
              <span>{loading ? "Conectando ao Google..." : "Continuar com o Google"}</span>
            </button>

            <div className="text-center text-[11px] text-slate-400">
              Disponível para leitores e administradores do portal.
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                ou
              </span>
            </div>

            {/* Toggle to Admin Password */}
            <button
              id="toggle-admin-password-btn"
              type="button"
              onClick={() => {
                setAuthMethod("admin_password");
                setErrorMessage(null);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-500" />
              <span>Entrar com Senha de Administrador</span>
            </button>
          </div>
        )}

        {/* 2. GOOGLE ACCOUNT SELECTION MODAL FORM (Classic Google Style) */}
        {authMethod === "google" && showGoogleAccountPicker && (
          <form onSubmit={handleConfirmGoogleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                E-mail da sua Conta Google
              </label>
              <input
                id="google-email-input"
                type="email"
                required
                autoFocus
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                placeholder="nome@gmail.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                Nome Completo (opcional)
              </label>
              <input
                id="google-name-input"
                type="text"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                placeholder="Seu Nome"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowGoogleAccountPicker(false);
                  setErrorMessage(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-60"
              >
                <span>{loading ? "Acessando..." : "Confirmar e Entrar"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* 3. ADMIN PASSWORD LOGIN VIEW */}
        {authMethod === "admin_password" && (
          <form onSubmit={handleAdminPasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                E-mail do Administrador
              </label>
              <input
                id="admin-email-input"
                type="email"
                required
                autoFocus
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="administrador@dominio.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-500" />
                Senha de Administrador
              </label>
              <input
                id="admin-password-input"
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Digite sua senha de administrador"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                Nome de Identificação (opcional)
              </label>
              <input
                id="admin-displayname-input"
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="ex: Editor Chefe"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod("google");
                  setErrorMessage(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Voltar para o Google
              </button>
              <button
                id="admin-submit-login-btn"
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{loading ? "Verificando..." : "Entrar como Administrador"}</span>
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center">
          O Painel de Metas & Tráfego é exclusivo para administradores autorizados.
        </div>
      </div>
    </div>
  );
};

// Official 4-color Google "G" SVG Component
function GoogleLogoIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
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
  );
}
