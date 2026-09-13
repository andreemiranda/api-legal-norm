import React, { useState } from "react";
import { firebaseAuthService, getAdminEmailsList, isEmailAdmin } from "../services/firebaseAuthService";
import { X, Shield, AlertCircle, CheckCircle2, User, KeyRound, Lock, Mail } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMetrics?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenMetrics }) => {
  const adminEmails = getAdminEmailsList();
  const [email, setEmail] = useState(adminEmails[0] || "acrmrochamiranda@gmail.com");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("Administrador Norma Jurídica");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Por favor, informe seu e-mail institucional.");
      setLoading(false);
      return;
    }

    if (!isEmailAdmin(cleanEmail)) {
      setErrorMessage(
        `Acesso Negado: O e-mail "${cleanEmail}" não consta na lista de ADMINISTRADORES autorizados.`
      );
      setLoading(false);
      return;
    }

    try {
      const res = await firebaseAuthService.signInWithAdminEmail(
        cleanEmail,
        password || undefined,
        displayName.trim() || "Administrador"
      );

      if (res.success) {
        setSuccessMessage("Autenticado com sucesso! Redirecionando...");
        setTimeout(() => {
          onClose();
          if (onOpenMetrics) onOpenMetrics();
        }, 500);
      } else {
        setErrorMessage(res.error || "Falha na autenticação.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado ao autenticar.");
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
        className="relative w-full max-w-md bg-slate-900 border border-blue-900/60 rounded-2xl shadow-2xl p-6 text-slate-100 modal-content"
      >
        {/* Close button */}
        <button
          id="auth-modal-close-btn"
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
            <h3 className="font-serif text-lg font-bold text-white">Autenticação Administrativa</h3>
            <p className="text-xs text-slate-400">Norma Jurídica • Firebase Authentication</p>
          </div>
        </div>

        {/* Status messages */}
        {errorMessage && (
          <div
            id="auth-error-alert"
            className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-semibold text-rose-300">Restrição de Acesso:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div
            id="auth-success-alert"
            className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{successMessage}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              E-mail do Administrador (Google / Corporativo)
            </label>
            <input
              id="admin-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none"
              placeholder="ex: acrmrochamiranda@gmail.com"
            />
            {adminEmails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-slate-500">Autorizados:</span>
                {adminEmails.map((adm) => (
                  <button
                    key={adm}
                    type="button"
                    onClick={() => setEmail(adm)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      email.toLowerCase() === adm.toLowerCase()
                        ? "bg-blue-600/30 border-blue-500 text-blue-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {adm}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              Senha de Acesso (Opcional no ambiente local)
            </label>
            <input
              id="admin-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none"
              placeholder="Digite a senha (mínimo 6 caracteres se houver)"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              Nome de Exibição do Administrador
            </label>
            <input
              id="admin-displayname-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none"
              placeholder="ex: Editor Chefe"
            />
          </div>

          <div className="pt-2">
            <button
              id="admin-submit-login-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? "Autenticando..." : "Entrar no Painel Administrativo"}</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            Acesso estritamente restrito aos e-mails configurados na variável <code className="text-blue-400 font-mono">ADMINISTRADORES</code>.
          </p>
        </form>
      </div>
    </div>
  );
};
