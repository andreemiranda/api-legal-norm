import React, { useState, useEffect } from "react";
import {
  trafficRouter,
  TrafficRouterState,
  TOTAL_STORAGE_LIMIT_BYTES,
  TOTAL_TRAFFIC_LIMIT_BYTES,
  PER_DB_STORAGE_THRESHOLD,
  PER_DB_TRAFFIC_THRESHOLD,
} from "../services/firebaseTrafficRouter";
import {
  firebaseAuthService,
  AdminUserState,
  getAdminEmailsList,
} from "../services/firebaseAuthService";
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
  X,
  Lock,
  Layers,
  FileText,
  Mail,
  Zap,
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
  const [activeTab, setActiveTab] = useState<"traffic" | "storage" | "sobrescricao" | "auth">("traffic");

  // Direct login states for admin gate (Exclusive Google Auth)
  const [googleEmailInput, setGoogleEmailInput] = useState("");
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

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

  const handleSyncAndSobrescricao = async () => {
    try {
      setIsSyncing(true);
      setSyncResult(null);
      setSyncProgress(15);
      setSyncMessage("Obtendo notícias atuais dos bancos Realtime...");

      const { news } = await trafficRouter.fetchNews();
      setSyncProgress(40);
      setSyncMessage(`Indexando ${news.length} artigos e avaliando limites de 1,9 GB / 20 GB...`);

      const res = await trafficRouter.mirrorNewsToFirebase(news, (progress, msg) => {
        setSyncProgress(progress);
        setSyncMessage(msg);
      });

      if (res.success) {
        setSyncResult(
          `Sucesso: ${res.syncedCount} notícias sincronizadas com destino "${res.targetUsed}"! Limites de 1,9 GB e 20 GB protegidos com sobrescrição automática ativa.`
        );
      } else if (res.warning) {
        setSyncResult(res.warning);
      }
    } catch (err: any) {
      setSyncResult(`Erro ao sincronizar: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSobrescricaoTest = async () => {
    try {
      setIsSyncing(true);
      setSyncResult(null);
      setSyncMessage("Executando sobrescrição controlada de registros mais antigos...");
      const res = await trafficRouter.executeStorageSobrescricao("primary", 20);
      setSyncResult(
        `Sobrescrição executada com êxito: ${res.prunedCount} registros antigos rotacionados liberando ${formatBytes(res.bytesFreed)} para novas notícias.`
      );
    } catch (err: any) {
      setSyncResult(`Erro na sobrescrição: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleGateLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      const nativeRes = await firebaseAuthService.signInWithGooglePopup();
      if (nativeRes.success) {
        if (!nativeRes.isAdmin) {
          setLoginError("Esta Conta Google não possui privilégios de administrador.");
        }
      } else {
        setShowDirectInput(true);
      }
    } catch (err: any) {
      setLoginError(err.message || "Falha ao conectar com o Google.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleConfirmGoogleAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await firebaseAuthService.signInWithGoogleAccount({
        email: googleEmailInput.trim().toLowerCase(),
      });
      if (res.success) {
        if (!res.isAdmin) {
          setLoginError("Esta Conta Google não está na lista de administradores autorizados.");
        }
      } else {
        setLoginError(res.error || "Não foi possível validar a Conta Google.");
      }
    } catch (err: any) {
      setLoginError(err.message || "Erro ao conectar.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await firebaseAuthService.signOut();
  };

  const primaryTrafficPct = getPercent(routerState.primaryTraffic.bytesUsed, PER_DB_TRAFFIC_THRESHOLD);
  const mirrorTrafficPct = getPercent(routerState.mirrorTraffic.bytesUsed, PER_DB_TRAFFIC_THRESHOLD);
  const totalTrafficUsed = routerState.primaryTraffic.bytesUsed + routerState.mirrorTraffic.bytesUsed;
  const combinedTrafficPct = getPercent(totalTrafficUsed, TOTAL_TRAFFIC_LIMIT_BYTES);

  const primaryStoragePct = getPercent(routerState.primaryStorage.bytesUsed, PER_DB_STORAGE_THRESHOLD);
  const mirrorStoragePct = getPercent(routerState.mirrorStorage.bytesUsed, PER_DB_STORAGE_THRESHOLD);
  const totalStorageUsed = routerState.primaryStorage.bytesUsed + routerState.mirrorStorage.bytesUsed;
  const combinedStoragePct = getPercent(totalStorageUsed, TOTAL_STORAGE_LIMIT_BYTES);

  // GATE 1: Se o usuário NÃO for administrador autenticado, exibe a tela de login restrito via Google
  if (!authState.isAuthenticated || !authState.isAdmin) {
    return (
      <div
        id="admin-metrics-gate"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      >
        <div className="relative w-full max-w-md bg-slate-900 border border-blue-900/60 rounded-3xl shadow-2xl p-6 sm:p-8 text-slate-100 modal-content">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-950/70 border border-blue-500/50 flex items-center justify-center text-blue-400 mb-3 shadow-lg">
            <Lock className="w-6 h-6" />
          </div>

          <h3 className="font-serif text-lg font-bold text-white text-center mb-1">
            Página de Métricas Restrita
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed text-center mb-5">
            A visualização das métricas, estatísticas de tráfego e limites é restrita exclusivamente aos administradores contidos na lista de administradores autorizados.
          </p>

          {/* Caso esteja conectado mas o e-mail não seja administrador */}
          {authState.isAuthenticated && !authState.isAdmin && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Conta Sem Permissão de Administrador</span>
              </div>
              <p className="leading-relaxed">
                Você está conectado com o e-mail <strong className="text-white">{authState.email}</strong>, que <strong>não consta</strong> na lista de administradores autorizados. Por segurança, a página de métricas não está acessível.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await firebaseAuthService.signOut();
                    setShowDirectInput(false);
                    setLoginError(null);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-colors cursor-pointer text-center"
                >
                  Conectar com Outra Conta Google
                </button>
              </div>
            </div>
          )}

          {loginError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Botão de Entrada Exclusivo com Conta Google */}
          {(!authState.isAuthenticated || showDirectInput) && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleGateLogin}
                disabled={loginLoading}
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs border border-slate-300 shadow-md transition-all cursor-pointer flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                <span>{loginLoading ? "Autenticando..." : "Entrar com o Google"}</span>
              </button>

              {showDirectInput && (
                <form onSubmit={handleConfirmGoogleAdminEmail} className="pt-3 border-t border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-400" />
                      E-mail da sua Conta Google de Administrador
                    </label>
                    <input
                      type="email"
                      required
                      value={googleEmailInput}
                      onChange={(e) => setGoogleEmailInput(e.target.value)}
                      placeholder="administrador@gmail.com"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Validar Permissão de Administrador</span>
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Acesso restrito via Conta Google</span>
            <button
              type="button"
              onClick={onClose}
              className="text-blue-400 hover:underline cursor-pointer"
            >
              Voltar ao Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // USUÁRIO ADMINISTRADOR AUTENTICADO: Exibe o Painel Completo
  return (
    <div
      id="admin-metrics-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-blue-900/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] modal-content">
        {/* Header */}
        <div className="p-5 border-b border-blue-900/40 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Painel de Metas, Tráfego & Sobrescrição
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                  Limites: 1,9 GB / 20 GB
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Operação exclusiva via Realtime Database (legal-norm2 & legal-norm3) com Sobrescrição Automática Ativa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-2 pt-2 text-xs">
          <button
            onClick={() => setActiveTab("traffic")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "traffic"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Tráfego (20 GB)</span>
          </button>

          <button
            onClick={() => setActiveTab("storage")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "storage"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Espaço (1,9 GB)</span>
          </button>

          <button
            onClick={() => setActiveTab("sobrescricao")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "sobrescricao"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Motor de Sobrescrição</span>
          </button>

          <button
            onClick={() => setActiveTab("auth")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-t-xl transition-colors cursor-pointer ${
              activeTab === "auth"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Administradores ({getAdminEmailsList().length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {/* TAB 1: TRÁFEGO MENSAL (20GB) */}
          {activeTab === "traffic" && (
            <div className="space-y-6">
              {/* Active Source Banner */}
              <div className="p-4 rounded-2xl border border-blue-900/60 bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono uppercase text-blue-400 block mb-1">
                    Fonte Ativa de Leitura (Ciclo: {routerState.monthCycle})
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        routerState.activeReadSource === "primary"
                          ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                          : routerState.activeReadSource === "mirror"
                          ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
                          : "bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)]"
                      }`}
                    />
                    <h3 className="text-base font-bold text-white capitalize">
                      {routerState.activeReadSource === "primary" && "Banco 1 • legal-norm2 (Realtime Database)"}
                      {routerState.activeReadSource === "mirror" && "Banco 2 • legal-norm3 (Realtime Database)"}
                      {routerState.activeReadSource === "api" && "API Proxy Restrita (Proteção de Tráfego)"}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Rotação automática em ~9,8 GB por banco. Ao atingir o teto de 20 GB, a sobrescrição de tráfego mantém as requisições ativas.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => trafficRouter.resetToAutomatic()}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
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
                        routerState.activeReadSource === "primary" ? "mirror" : "primary"
                      )
                    }
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-950/80 border border-blue-700/60 text-blue-300 hover:bg-blue-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Alternar Banco</span>
                  </button>
                </div>
              </div>

              {/* Combined Progress */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-white">Capacidade Global de Tráfego Mensal (2 Bancos)</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {formatBytes(totalTrafficUsed)} / 20.00 GB
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-500"
                    style={{ width: `${Math.max(combinedTrafficPct, 2)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Sobrescrição de tráfego opera nas proximidades do limite de 20 GB sem queda de serviço.
                </p>
              </div>

              {/* Individual Traffic Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-400" />
                      <h4 className="font-bold text-white text-sm">Banco 1 • legal-norm2</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ~10 GB Limite
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Tráfego Utilizado:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.primaryTraffic.bytesUsed)} / 10.00 GB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${Math.max(primaryTrafficPct, 2)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Requisições atendidas: <span className="font-mono text-white">{routerState.primaryTraffic.requestCount}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-purple-400" />
                      <h4 className="font-bold text-white text-sm">Banco 2 • legal-norm3</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      ~10 GB Limite
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Tráfego Utilizado:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.mirrorTraffic.bytesUsed)} / 10.00 GB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-500"
                        style={{ width: `${Math.max(mirrorTrafficPct, 2)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Requisições atendidas: <span className="font-mono text-white">{routerState.mirrorTraffic.requestCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ARMAZENAMENTO & CAPACIDADE (1,9 GB) */}
          {activeTab === "storage" && (
            <div className="space-y-6">
              {/* Storage Target Banner */}
              <div className="p-4 rounded-2xl border border-blue-900/60 bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono uppercase text-blue-400 block mb-1">
                    Alvo Ativo de Gravação (Teto: ~950 MB por Banco)
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        routerState.activeWriteTarget === "sobrescricao_both_active"
                          ? "bg-amber-400 animate-pulse"
                          : routerState.activeWriteTarget === "primary"
                          ? "bg-emerald-400"
                          : "bg-purple-400"
                      }`}
                    />
                    <h3 className="text-base font-bold text-white">
                      {routerState.activeWriteTarget === "primary" && "Gravando em Banco 1 (legal-norm2)"}
                      {routerState.activeWriteTarget === "mirror" && "Gravando em Banco 2 (legal-norm3)"}
                      {routerState.activeWriteTarget === "sobrescricao_both_active" && "Sobrescrição Automática Ativa em Ambos (~1,9 GB)"}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Se o Banco 1 atingir 950 MB, novas gravações passam para o Banco 2. Se ambos encherem, o mecanismo de sobrescrição (FIFO) substitui artigos antigos por novos automaticamente.
                  </p>
                </div>
              </div>

              {/* Combined Storage Bar */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-white">Espaço Total Ocupado nos Bancos Realtime</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {formatBytes(totalStorageUsed)} / 1.93 GB (Teto: 1,90 GB)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${Math.max(combinedStoragePct, 2)}%` }}
                  />
                </div>
              </div>

              {/* Individual Storage Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-blue-400" />
                      <h4 className="font-bold text-white text-sm">Banco 1 • Armazenamento</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      950 MB Teto
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Espaço:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.primaryStorage.bytesUsed)} / 950 MB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(primaryStoragePct, 2)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Notícias armazenadas: <span className="font-mono text-white">{routerState.primaryStorage.articleCount}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-purple-400" />
                      <h4 className="font-bold text-white text-sm">Banco 2 • Armazenamento</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      950 MB Teto
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Espaço:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.mirrorStorage.bytesUsed)} / 950 MB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-500"
                        style={{ width: `${Math.max(mirrorStoragePct, 2)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Notícias armazenadas: <span className="font-mono text-white">{routerState.mirrorStorage.articleCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MOTOR DE SOBRESCRIÇÃO (1,9 GB & 20 GB) */}
          {activeTab === "sobrescricao" && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl border border-blue-900/60 bg-blue-950/20 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Mecanismo de Sobrescrição Automática</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Conforme solicitado, o site opera exclusivamente conectado aos dois bancos Realtime Database sem JSON estático. Para manter a estabilidade no limite de ~1,9 GB de espaço e ~20 GB de tráfego, o sistema executa sobrescrição automática (FIFO) eliminando as notícias e métricas mais antigas quando o limite se aproxima, mantendo o acervo sempre atualizado.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <span className="text-slate-400 block mb-1">Sobrescrições de Espaço:</span>
                    <span className="font-mono text-white font-bold text-base">
                      {routerState.sobrescricao.storageSobrescricaoCount} ciclos
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <span className="text-slate-400 block mb-1">Sobrescrições de Tráfego:</span>
                    <span className="font-mono text-white font-bold text-base">
                      {routerState.sobrescricao.trafficSobrescricaoCount} ciclos
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <span className="text-slate-400 block mb-1">Artigos Rotacionados:</span>
                    <span className="font-mono text-emerald-400 font-bold text-base">
                      {routerState.sobrescricao.prunedArticlesCount} itens
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="font-bold text-white text-sm">Ações Manuais de Sincronização e Sobrescrição</h4>

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
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300">
                    {syncResult}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSyncAndSobrescricao}
                    disabled={isSyncing}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>Sincronizar Notícias e Avaliar Sobrescrição</span>
                  </button>

                  <button
                    onClick={handleManualSobrescricaoTest}
                    disabled={isSyncing}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Executar Ciclo de Sobrescrição (Liberar Espaço)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADMINISTRADORES */}
          {activeTab === "auth" && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">Sessão Administrativa Google</h4>
                    <p className="text-xs text-slate-400">Autenticado com Conta Google</p>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Administrador Verificado
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    {authState.photoURL ? (
                      <img
                        src={authState.photoURL}
                        alt={authState.displayName || "Administrador"}
                        className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-md"
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
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-950/60 border border-red-800/80 text-red-300 hover:bg-red-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Encerrar Sessão</span>
                  </button>
                </div>
              </div>

              {/* List of configured administrators */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  E-mails de Administradores Autorizados
                </h4>
                <div className="space-y-2 pt-1">
                  {getAdminEmailsList().map((adm, i) => (
                    <div
                      key={adm}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-900/60 text-blue-300 flex items-center justify-center text-[10px] font-mono">
                          {i + 1}
                        </span>
                        <span className="font-mono text-white">{adm}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                        Autorizado
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
