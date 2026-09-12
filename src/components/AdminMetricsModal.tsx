import React, { useState, useEffect } from "react";
import {
  trafficRouter,
  TrafficRouterState,
  TrafficSource,
  NINE_GB_IN_BYTES,
  TEN_GB_IN_BYTES,
} from "../services/firebaseTrafficRouter";
import { firebaseAuthService, AdminUserState } from "../services/firebaseAuthService";
import staticNewsData from "../data/initialNews.json";
import {
  Shield,
  Database,
  Activity,
  ArrowRightLeft,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Server,
  HardDrive,
  Info,
  ExternalLink,
  X,
  Lock,
} from "lucide-react";

interface AdminMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminMetricsModal: React.FC<AdminMetricsModalProps> = ({ isOpen, onClose }) => {
  const [routerState, setRouterState] = useState<TrafficRouterState>(trafficRouter.getState());
  const [authState, setAuthState] = useState<AdminUserState>(firebaseAuthService.getUserState());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncMessage, setSyncMessage] = useState<string>("");
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"traffic" | "sync" | "auth" | "guide">("traffic");

  useEffect(() => {
    const unsubRouter = trafficRouter.subscribe(setRouterState);
    const unsubAuth = firebaseAuthService.subscribe(setAuthState);
    return () => {
      unsubRouter();
      unsubAuth();
    };
  }, []);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0.00 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(3)} GB`;
  };

  const getPercent = (used: number, limit: number) => {
    return Math.min(100, Math.max(0, (used / limit) * 100));
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setSyncResult(null);
      setSyncProgress(10);
      setSyncMessage("Iniciando espelhamento do acervo...");

      const res = await trafficRouter.mirrorNewsToFirebase(
        staticNewsData as any,
        (progress, msg) => {
          setSyncProgress(progress);
          setSyncMessage(msg);
        }
      );

      if (res.success) {
        setSyncResult(
          `Sucesso: ${res.syncedCount} notícias espelhadas${
            res.mirrored ? " em ambas as instâncias Firebase!" : " na instância ativa."
          }`
        );
      }
    } catch (err: any) {
      setSyncResult(`Erro ao sincronizar: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await firebaseAuthService.signInWithGoogle();
    } catch (err: any) {
      alert(`Erro no login Google: ${err.message || err}`);
    }
  };

  const handleLogout = async () => {
    await firebaseAuthService.signOut();
  };

  const primaryPct = getPercent(routerState.primaryStats.bytesUsed, TEN_GB_IN_BYTES);
  const mirrorPct = getPercent(routerState.mirrorStats.bytesUsed, TEN_GB_IN_BYTES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-blue-900/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-blue-900/40 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Painel de Tráfego, Firebase RTDB & Métricas
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                  Alta Disponibilidade
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoramento do limite de 10GB, rotação com alerta em 9GB e estatísticas com Google Auth
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab("traffic")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === "traffic"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Rotação de Tráfego (10GB)</span>
          </button>

          <button
            onClick={() => setActiveTab("sync")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === "sync"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Acervo Híbrido & Espelhamento</span>
          </button>

          <button
            onClick={() => setActiveTab("auth")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === "auth"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Métricas & Google Auth</span>
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === "guide"
                ? "bg-slate-900 text-amber-400 border-t-2 border-amber-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Configuração no Console</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {/* TAB 1: ROTAÇÃO DE TRÁFEGO */}
          {activeTab === "traffic" && (
            <div className="space-y-6">
              {/* Active Source Banner */}
              <div className="p-4 rounded-xl border border-blue-900/60 bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono uppercase text-blue-400 block mb-1">
                    Fonte Ativa de Leitura de Notícias
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        routerState.activeSource === "primary"
                          ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                          : routerState.activeSource === "mirror"
                          ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
                          : "bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)]"
                      }`}
                    />
                    <h3 className="text-lg font-bold text-white capitalize">
                      {routerState.activeSource === "primary" && "Projeto 1 (Instância Principal)"}
                      {routerState.activeSource === "mirror" && "Projeto 2 (Instância Espelho / Rotação)"}
                      {routerState.activeSource === "static" && "Fallback Estático In-Code (Alta Disponibilidade)"}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {routerState.mode === "automatic"
                      ? "Modo Automático: Redireciona leituras para o Projeto 2 ao atingir 9GB de tráfego no Projeto 1."
                      : "Modo Manual (Sobrescrito para teste de contingência)."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => trafficRouter.resetToAutomatic()}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      routerState.mode === "automatic"
                        ? "bg-emerald-950 border-emerald-700 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    Automático
                  </button>
                  <button
                    onClick={() =>
                      trafficRouter.setManualSource(
                        routerState.activeSource === "primary" ? "mirror" : "primary"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-950/80 border border-blue-700/60 text-blue-300 hover:bg-blue-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Alternar Instância</span>
                  </button>
                </div>
              </div>

              {/* Traffic Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project 1 Stats */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-400" />
                      <h4 className="font-bold text-white text-sm">Projeto 1 • Principal</h4>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        routerState.isPrimaryConfigured
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-amber-950 text-amber-300 border border-amber-800"
                      }`}
                    >
                      {routerState.isPrimaryConfigured ? "Configurado" : "Pendente no .env"}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Consumo Estimado (Mês):</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.primaryStats.bytesUsed)} / 10.00 GB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          primaryPct >= 90
                            ? "bg-red-500"
                            : primaryPct >= 70
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.max(primaryPct, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                      <span>Alerta de Rotação: 9.00 GB</span>
                      <span>{primaryPct.toFixed(1)}% do teto</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-xs">
                    <div>
                      <span className="text-slate-500 block">Requisições:</span>
                      <span className="font-mono text-slate-300">{routerState.primaryStats.requestCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Falhas / 429:</span>
                      <span className="font-mono text-slate-300">{routerState.primaryStats.errorCount}</span>
                    </div>
                  </div>
                </div>

                {/* Project 2 Stats (Mirror) */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-purple-400" />
                      <h4 className="font-bold text-white text-sm">Projeto 2 • Espelho</h4>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        routerState.isMirrorConfigured
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {routerState.isMirrorConfigured ? "Espelho Ativo" : "Opcional no .env"}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Consumo Estimado (Mês):</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.mirrorStats.bytesUsed)} / 10.00 GB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          mirrorPct >= 90
                            ? "bg-red-500"
                            : mirrorPct >= 70
                            ? "bg-amber-500"
                            : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.max(mirrorPct, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                      <span>Alerta de Rotação: 9.00 GB</span>
                      <span>{mirrorPct.toFixed(1)}% do teto</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-xs">
                    <div>
                      <span className="text-slate-500 block">Requisições:</span>
                      <span className="font-mono text-slate-300">{routerState.mirrorStats.requestCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Falhas / 429:</span>
                      <span className="font-mono text-slate-300">{routerState.mirrorStats.errorCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informational Alert */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center gap-2 text-blue-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Princípio de Integridade Absoluta dos Dados</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Nenhuma notícia é removida ou excluída durante a rotação de tráfego. Caso a banda de leitura do
                  Projeto 1 se aproxime de 9GB, a fonte de consulta é instantaneamente alternada para o Projeto 2
                  (ou para o fallback estático in-code). Todo o histórico de notícias mais antigas permanece intacto.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: ACERVO HÍBRIDO & ESPELHAMENTO */}
          {activeTab === "sync" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <HardDrive className="w-4 h-4" />
                    <span className="font-bold text-sm text-white">Acervo Estático In-Code</span>
                  </div>
                  <p className="text-2xl font-bold font-serif text-white">
                    {staticNewsData.length} <span className="text-xs text-slate-400 font-sans">notícias</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Conjunto gravado diretamente no código-fonte. Funciona 100% offline e garante que o portal nunca
                    fique fora do ar, mesmo com banco indisponível.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Database className="w-4 h-4" />
                    <span className="font-bold text-sm text-white">Realtime Database (RTDB)</span>
                  </div>
                  <p className="text-2xl font-bold font-serif text-white">
                    Espelhamento Ativo
                  </p>
                  <p className="text-xs text-slate-400">
                    Armazenamento dinâmico em nuvem. Permite publicação em tempo real sem precisar recompilar o portal.
                  </p>
                </div>
              </div>

              {/* Sync Action Section */}
              <div className="p-5 rounded-xl border border-blue-900/60 bg-blue-950/20 space-y-4">
                <div>
                  <h4 className="font-bold text-white text-base">Espelhar Notícias Estáticas no Firebase</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Copia e sincroniza o lote de {staticNewsData.length} notícias in-code para a árvore <code className="text-blue-300 font-mono">/news</code> no
                    Firebase Realtime Database (em ambas as instâncias configuradas).
                  </p>
                </div>

                {isSyncing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-300">{syncMessage}</span>
                      <span className="font-mono text-white">{syncProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${syncProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {syncResult && (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300">
                    {syncResult}
                  </div>
                )}

                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    isSyncing
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Sincronizando Acervo..." : "Iniciar Espelhamento no Firebase"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MÉTRICAS & GOOGLE AUTH */}
          {activeTab === "auth" && (
            <div className="space-y-6">
              {/* Notice regarding Google Auth role */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-900/60 text-xs space-y-2 text-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Shield className="w-4 h-4" />
                  <span>Uso Exclusivo para Estatísticas e Auditoria Administrativa</span>
                </div>
                <p className="leading-relaxed text-amber-200/90">
                  A autenticação do Google via Firebase Authentication atua <strong>exclusivamente</strong> como uma
                  camada de estatística e controle de acessos no painel. O fluxo de navegação, a leitura de matérias e a
                  experiência dos visitantes permanecem 100% abertas e sem qualquer exigência de cadastro ou login.
                </p>
              </div>

              {/* User Authentication Status */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">Status do Usuário Administrativo</h4>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono ${
                      authState.isAdmin
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {authState.isAdmin ? "Sessão Ativa" : "Visitante Anônimo"}
                  </span>
                </div>

                {authState.isAdmin ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-3">
                      {authState.photoURL ? (
                        <img
                          src={authState.photoURL}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full border border-blue-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500 flex items-center justify-center text-blue-300 font-bold">
                          {authState.displayName?.charAt(0) || "A"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-white">{authState.displayName || "Administrador"}</p>
                        <p className="text-xs text-slate-400 font-mono">{authState.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-950/60 border border-red-800/80 text-red-300 hover:bg-red-900 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Encerrar Sessão</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <p className="text-xs text-slate-400">
                      Conecte-se com sua conta Google para registrar métricas de administração e habilitar sincronização
                      com credenciais verificadas.
                    </p>
                    <button
                      onClick={handleGoogleLogin}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 flex items-center gap-2.5 transition-all shadow-md cursor-pointer"
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
                      <span>Entrar com Google (Painel de Métricas)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GUIA DE CONFIGURAÇÃO MANUAL NO CONSOLE */}
          {activeTab === "guide" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/60 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-300">
                  <ExternalLink className="w-4 h-4" />
                  <span>Passo a Passo Manual no Console do Firebase</span>
                </div>
                <p className="leading-relaxed">
                  A configuração do provedor Google OAuth e dos domínios autorizados exige permissão de proprietário no
                  Firebase Console. Siga os passos abaixo:
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-mono text-[11px]">
                      1
                    </span>
                    <span>Ativar o Provedor Google</span>
                  </div>
                  <p className="text-slate-400 pl-7">
                    No <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Firebase Console</a>,
                    acesse <strong>Criação &gt; Authentication &gt; Guia "Sign-in method"</strong>. Clique em <strong>Google</strong>, marque <strong>Ativar</strong>, defina o e-mail de suporte do projeto e salve.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-mono text-[11px]">
                      2
                    </span>
                    <span>Adicionar Domínios Autorizados</span>
                  </div>
                  <p className="text-slate-400 pl-7">
                    Ainda em Authentication, clique na aba <strong>Settings (Configurações)</strong> &gt; <strong>Authorized domains (Domínios autorizados)</strong> e adicione:
                  </p>
                  <ul className="list-disc list-inside text-slate-300 pl-7 font-mono text-[11px] space-y-0.5">
                    <li>localhost</li>
                    <li>normajuridica.com.br</li>
                    <li>ais-dev-orsqktujlwd4w5oczglz37-124157476255.us-west1.run.app</li>
                    <li>ais-pre-orsqktujlwd4w5oczglz37-124157476255.us-west1.run.app</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-mono text-[11px]">
                      3
                    </span>
                    <span>Criar o Realtime Database</span>
                  </div>
                  <p className="text-slate-400 pl-7">
                    Acesse <strong>Criação &gt; Realtime Database &gt; Criar banco de dados</strong>. Escolha o local (ex: us-central1) e configure as regras de segurança para leitura pública das notícias e escrita de métricas:
                  </p>
                  <pre className="mt-2 p-2 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-300 overflow-x-auto">
{`{
  "rules": {
    "news": { ".read": true, ".write": "auth != null" },
    "access_metrics": { ".read": "auth != null", ".write": true },
    "traffic_stats": { ".read": true, ".write": true }
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>Sistema Seguro Norma Jurídica • Alta Disponibilidade Híbrida</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
