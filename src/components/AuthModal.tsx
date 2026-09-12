import React, { useState } from "react";
import { firebaseAuthService } from "../services/firebaseAuthService";
import { X, LogIn, Shield, AlertCircle, CheckCircle2, User, KeyRound } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMetrics?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenMetrics }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("legislativemunicipal@gmail.com");
  const [adminName, setAdminName] = useState("Editor Chefe");
  const [activeTab, setActiveTab] = useState<"google" | "admin">("google");

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await firebaseAuthService.signInWithGoogle();
      if (res.success) {
        onClose();
        if (onOpenMetrics) onOpenMetrics();
      } else {
        setErrorMessage(res.error || "Erro ao autenticar com Google.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminDirectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim()) return;
    firebaseAuthService.signInAsAdmin(adminEmail.trim(), adminName.trim() || "Administrador");
    onClose();
    if (onOpenMetrics) onOpenMetrics();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-blue-900/60 rounded-2xl shadow-2xl p-6 text-slate-100">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-white">Identificação & Acesso</h3>
            <p className="text-xs text-slate-400">Norma Jurídica • Painel Administrativo</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl mb-5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("google");
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              activeTab === "google"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Conta Google
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("admin");
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              activeTab === "admin"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Credenciais de Redação
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-semibold text-amber-300">Aviso de Acesso:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {activeTab === "google" ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Conecte-se com sua conta Google autorizada para desbloquear métricas de tráfego, rotatividade Firebase RTDB (10GB) e auditoria técnica.
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-3 transition-all shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? "Conectando ao Google..." : "Entrar com Google"}</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdminDirectLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                E-mail do Administrador
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none"
                placeholder="ex: legislativemunicipal@gmail.com"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Nome para Exibição
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none"
                placeholder="ex: Editor Chefe"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Autenticar Sessão Administrativa</span>
            </button>
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Leitores acessam livremente</span>
          <span className="text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            100% Gratuito
          </span>
        </div>
      </div>
    </div>
  );
};
