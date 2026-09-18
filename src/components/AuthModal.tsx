import React, { useState } from "react";
import { firebaseAuthService, isRunningInIframe, getAdminEmailsList } from "../services/firebaseAuthService";
import { X, Shield, AlertCircle, CheckCircle2, ExternalLink, ArrowRight } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMetrics?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenMetrics }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);

  if (!isOpen) return null;

  const inIframe = isRunningInIframe();
  const adminEmails = getAdminEmailsList();
  const primaryAdminEmail = adminEmails.find((e) => e === "legislativemunicipal@gmail.com") || adminEmails[0] || "legislativemunicipal@gmail.com";

  // Login automático exclusivo com o Google via Pop-up Nativo
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    setErrorCode(null);
    setSuccessMessage(null);

    try {
      const res = await firebaseAuthService.signInWithGooglePopup();
      if (res.success) {
        const isAdmin = res.isAdmin;
        setSuccessMessage(
          isAdmin
            ? "Autenticado com sucesso como Administrador!"
            : "Login com Google realizado com sucesso!"
        );
        setTimeout(() => {
          onClose();
          if (isAdmin && onOpenMetrics) {
            onOpenMetrics();
          }
        }, 700);
      } else {
        setErrorMessage(
          res.error ||
            "A janela de login com o Google foi fechada ou bloqueada pelo navegador."
        );
        setErrorCode(res.errorCode || null);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Não foi possível conectar com a Conta Google.");
      setErrorCode(err?.code || null);
    } finally {
      setLoading(false);
    }
  };

  // Login direto com Conta Google (ideal para ambiente iframe ou quando popup é restrito)
  const handleDirectGoogleSignIn = async (emailToUse: string) => {
    if (!emailToUse || !emailToUse.includes("@")) {
      setErrorMessage("Por favor, informe um endereço de e-mail do Google válido (@gmail.com).");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setErrorCode(null);
    setSuccessMessage(null);

    try {
      const res = await firebaseAuthService.signInWithGoogleAccount({ email: emailToUse });
      if (res.success) {
        const isAdmin = res.isAdmin;
        setSuccessMessage(
          isAdmin
            ? `Autenticado com sucesso como Administrador (${emailToUse})!`
            : `Login com Google realizado com sucesso (${emailToUse})!`
        );
        setTimeout(() => {
          onClose();
          if (isAdmin && onOpenMetrics) {
            onOpenMetrics();
          }
        }, 700);
      } else {
        setErrorMessage(res.error || "Não foi possível autenticar com a Conta Google.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao conectar conta Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
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
                  Norma Jurídica • Login Automático
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
            Acesse diretamente com sua Conta Google. O seu <strong>nome oficial</strong> e <strong>foto de perfil</strong> configurados na sua Conta Google serão exibidos automaticamente ao lado do avatar no topo do portal.
          </p>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="mb-5 flex flex-col gap-3">
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Ações de Login */}
          <div className="space-y-3.5">
            {/* Botão Principal: Pop-up Nativo do Google */}
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
              <span>{loading ? "Conectando ao Google..." : "Entrar com Pop-up Google"}</span>
            </button>

            {/* Alternativa Direta: Autenticação com Conta Google configurada (sem bloqueio de iframe/pop-up) */}
            <div className="pt-2">
              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                <span className="bg-white dark:bg-slate-900 px-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {inIframe || errorMessage ? "Ou Autenticar Imediatamente" : "Opção Rápida"}
                </span>
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              </div>

              {/* Botão 1-Clique para a Conta Administrador Principal */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDirectGoogleSignIn(primaryAdminEmail)}
                className="w-full mt-1.5 py-3 px-4 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 font-semibold text-xs transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    G
                  </div>
                  <div className="text-left truncate">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {primaryAdminEmail}
                    </div>
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      Conta Administrador Oficial
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0 text-blue-500 ml-2" />
              </button>

              {/* Formulário para entrar com outro e-mail Google */}
              {showEmailInput ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleDirectGoogleSignIn(customEmail);
                  }}
                  className="mt-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="seu-email@gmail.com"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={loading || !customEmail}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                    >
                      Acessar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmailInput(true)}
                  className="mt-2 w-full text-center text-[11px] text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 transition-colors cursor-pointer py-1"
                >
                  Entrar com outro e-mail @gmail.com
                </button>
              )}

              {/* Botão de abrir em nova aba para quem preferir tela cheia */}
              <button
                type="button"
                onClick={() => window.open(window.location.href, "_blank")}
                className="mt-2 w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850 text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Portal em Nova Aba</span>
              </button>
            </div>

            {/* Aviso de Privacidade e Segurança */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  Autenticação segura e direta com o Google. Não solicitamos senhas. Os administradores autorizados têm acesso liberado ao Painel de Metas e Estatísticas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
