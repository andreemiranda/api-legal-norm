import React, { useState, useEffect } from "react";
import {
  trafficRouter,
  TrafficRouterState,
  TrafficSource,
  TEN_GB_IN_BYTES,
  NINE_POINT_FIVE_GB_IN_BYTES,
  ONE_GB_IN_BYTES,
  NINE_FIFTY_MB_IN_BYTES,
} from "../services/firebaseTrafficRouter";
import {
  firebaseAuthService,
  AdminUserState,
  getAdminEmailsList,
  isEmailAdmin,
} from "../services/firebaseAuthService";
import { getSiteDomain } from "../utils/domain";
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
  X,
  Lock,
  Layers,
  FileText,
  KeyRound,
  Mail,
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
  const [activeTab, setActiveTab] = useState<"traffic" | "storage" | "sync" | "auth">("traffic");

  // Direct login form for unauthorized gate
  const [loginEmail, setLoginEmail] = useState(getAdminEmailsList()[0] || "acrmrochamiranda@gmail.com");
  const [loginPassword, setLoginPassword] = useState("");
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

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setSyncResult(null);
      setSyncProgress(10);
      setSyncMessage("Iniciando espelhamento e indexação de notícias...");

      const res = await trafficRouter.mirrorNewsToFirebase(
        staticNewsData as any,
        (progress, msg) => {
          setSyncProgress(progress);
          setSyncMessage(msg);
        }
      );

      if (res.success) {
        setSyncResult(
          `Sucesso: ${res.syncedCount} notícias espelhadas com destino "${res.targetUsed}"! Índice atualizado com integridade garantida.`
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

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await firebaseAuthService.signInWithAdminEmail(
        loginEmail,
        loginPassword || undefined,
        "Administrador Autorizado"
      );
      if (!res.success) {
        setLoginError(res.error || "Falha na autenticação administrativa.");
      }
    } catch (err: any) {
      setLoginError(err.message || "Erro inesperado.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await firebaseAuthService.signOut();
  };

  const primaryTrafficPct = getPercent(routerState.primaryTraffic.bytesUsed, TEN_GB_IN_BYTES);
  const mirrorTrafficPct = getPercent(routerState.mirrorTraffic.bytesUsed, TEN_GB_IN_BYTES);
  const totalTrafficUsed = routerState.primaryTraffic.bytesUsed + routerState.mirrorTraffic.bytesUsed;
  const combinedTrafficLimit = 2 * TEN_GB_IN_BYTES; // ~20GB total
  const combinedTrafficPct = getPercent(totalTrafficUsed, combinedTrafficLimit);

  const primaryStoragePct = getPercent(routerState.primaryStorage.bytesUsed, ONE_GB_IN_BYTES);
  const mirrorStoragePct = getPercent(routerState.mirrorStorage.bytesUsed, ONE_GB_IN_BYTES);
  const totalStorageUsed = routerState.primaryStorage.bytesUsed + routerState.mirrorStorage.bytesUsed;
  const combinedStorageLimit = 2 * ONE_GB_IN_BYTES; // ~2GB total
  const combinedStoragePct = getPercent(totalStorageUsed, combinedStorageLimit);

  // GATE 1: Se o usuário NÃO for administrador (ou não autenticado), exibe a tela de login restrito aos administradores
  if (!authState.isAuthenticated || !authState.isAdmin) {
    return (
      <div
        id="admin-metrics-gate"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      >
        <div className="relative w-full max-w-md bg-slate-900 border border-blue-900/60 rounded-2xl shadow-2xl p-6 text-slate-100 modal-content">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-950/70 border border-blue-500/50 flex items-center justify-center text-blue-400 mb-3 shadow-lg">
            <Lock className="w-6 h-6" />
          </div>

          <h3 className="font-serif text-lg font-bold text-white text-center mb-1">
            Acesso Restrito a Administradores
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed text-center mb-4">
            A página de Meta & Tráfego é restrita exclusivamente aos administradores configurados na variável{" "}
            <code className="text-blue-400 font-mono font-semibold">ADMINISTRADORES</code>.
          </p>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
              <p className="font-semibold text-rose-300 mb-0.5">Restrição de Acesso:</p>
              <p>{loginError}</p>
            </div>
          )}

          <form onSubmit={handleDirectLogin} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                E-mail do Administrador
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none"
                placeholder="ex: acrmrochamiranda@gmail.com"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                Senha (Opcional)
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 focus:border-blue-500 text-white outline-none"
                placeholder="Senha de acesso"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loginLoading ? "Verificando permissões..." : "Acessar Painel de Tráfego"}</span>
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center">
            E-mails autorizados no sistema:{" "}
            <span className="text-slate-300 font-mono">
              {getAdminEmailsList().join(", ") || "Configurados em ADMINISTRADORES"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // USUÁRIO ADMINISTRADOR AUTENTICADO: Exibe o Painel Completo de Tráfego e Metas
  return (
    <div
      id="admin-metrics-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-blue-900/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] modal-content">
        {/* Modal Header */}
        <div className="p-5 border-b border-blue-900/40 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Painel de Metas, Tráfego & Armazenamento
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                  Rotação 19GB / 1900MB
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Capacidade combinada dos 2 Projetos Firebase (Spark) com integridade absoluta de dados
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
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 gap-2 pt-2 text-xs">
          <button
            onClick={() => setActiveTab("traffic")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === "traffic"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Tráfego Mensal (19GB)</span>
          </button>

          <button
            onClick={() => setActiveTab("storage")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === "storage"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Armazenamento (1900MB)</span>
          </button>

          <button
            onClick={() => setActiveTab("sync")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-t-lg transition-colors cursor-pointer ${
              activeTab === "sync"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Índice & Espelhamento</span>
          </button>

          <button
            onClick={() => setActiveTab("auth")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-t-lg transition-colors cursor-pointer ${
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
          {/* TAB 1: ROTAÇÃO DE TRÁFEGO (19GB) */}
          {activeTab === "traffic" && (
            <div className="space-y-6">
              {/* Active Source Banner */}
              <div className="p-4 rounded-xl border border-blue-900/60 bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono uppercase text-blue-400 block mb-1">
                    Fonte Ativa de Leitura de Notícias (Ciclo: {routerState.monthCycle})
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
                      {routerState.activeReadSource === "primary" && "Banco 1 • legal-norm2 (Instância Principal)"}
                      {routerState.activeReadSource === "mirror" && "Banco 2 • legal-norm3 (Instância Espelho)"}
                      {routerState.activeReadSource === "static" && "Fallback Estático In-Code (Alta Disponibilidade)"}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {routerState.mode === "automatic"
                      ? "Rotação Automática: Ao atingir 9.5GB no Banco 1, as leituras alternam para o Banco 2 (10GB)."
                      : "Modo Manual Ativado."}
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
                        routerState.activeReadSource === "primary" ? "mirror" : "primary"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-950/80 border border-blue-700/60 text-blue-300 hover:bg-blue-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Alternar Leitura</span>
                  </button>
                </div>
              </div>

              {/* Combined Progress */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-white">Capacidade Total Combinada de Tráfego Mensal</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {formatBytes(totalTrafficUsed)} / 20.00 GB (Teto de Rotação: 19.00 GB)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-500"
                    style={{ width: `${Math.max(combinedTrafficPct, 2)}%` }}
                  />
                </div>
              </div>

              {/* Individual Traffic Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Banco 1 Traffic */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-400" />
                      <h4 className="font-bold text-white text-sm">Banco 1 • legal-norm2</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      10GB Limite
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Tráfego de Download:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.primaryTraffic.bytesUsed)} / 10.00 GB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          primaryTrafficPct >= 95 ? "bg-red-500" : primaryTrafficPct >= 70 ? "bg-amber-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.max(primaryTrafficPct, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>Rotação em: 9.50 GB</span>
                      <span>{primaryTrafficPct.toFixed(1)}% utilizado</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Leituras Realizadas:</span>
                      <span className="font-mono text-slate-300">{routerState.primaryTraffic.requestCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Falhas / 429:</span>
                      <span className="font-mono text-slate-300">{routerState.primaryTraffic.errorCount}</span>
                    </div>
                  </div>
                </div>

                {/* Banco 2 Traffic */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-purple-400" />
                      <h4 className="font-bold text-white text-sm">Banco 2 • legal-norm3</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      10GB Limite
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Tráfego de Download:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.mirrorTraffic.bytesUsed)} / 10.00 GB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          mirrorTrafficPct >= 95 ? "bg-red-500" : mirrorTrafficPct >= 70 ? "bg-amber-500" : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.max(mirrorTrafficPct, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>Rotação em: 9.50 GB</span>
                      <span>{mirrorTrafficPct.toFixed(1)}% utilizado</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Leituras Realizadas:</span>
                      <span className="font-mono text-slate-300">{routerState.mirrorTraffic.requestCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Falhas / 429:</span>
                      <span className="font-mono text-slate-300">{routerState.mirrorTraffic.errorCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ARMAZENAMENTO & ROTAÇÃO DE ESPAÇO (1900MB) */}
          {activeTab === "storage" && (
            <div className="space-y-6">
              {/* Storage Target Banner */}
              <div className="p-4 rounded-xl border border-blue-900/60 bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono uppercase text-blue-400 block mb-1">
                    Alvo Ativo de Novas Gravações (Teto 950MB por Banco)
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        routerState.activeWriteTarget === "warning_both_full"
                          ? "bg-red-500 animate-pulse"
                          : routerState.activeWriteTarget === "primary"
                          ? "bg-emerald-400"
                          : "bg-purple-400"
                      }`}
                    />
                    <h3 className="text-base font-bold text-white">
                      {routerState.activeWriteTarget === "primary" && "Gravando em Banco 1 (legal-norm2)"}
                      {routerState.activeWriteTarget === "mirror" && "Gravando em Banco 2 (legal-norm3 - Rotação Ativa)"}
                      {routerState.activeWriteTarget === "warning_both_full" && "Capacidade Máxima Atingida em Ambos (1900MB)"}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Quando o Banco 1 atinge 950MB, novas notícias são gravadas no Banco 2. Nenhuma notícia é sobrescrita ou excluída.
                  </p>
                </div>
              </div>

              {/* Combined Storage Bar */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-white">Capacidade Combinada de Espaço (2 Bancos Spark)</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {formatBytes(totalStorageUsed)} / 2.00 GB (Teto Seguro de Rotação: 1900 MB)
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
                {/* Banco 1 Storage */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-blue-400" />
                      <h4 className="font-bold text-white text-sm">Banco 1 • Armazenamento</h4>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        routerState.primaryStorage.isNearLimit
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {routerState.primaryStorage.isNearLimit ? "Teto 950MB Atingido" : "Disponível"}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Espaço Ocupado:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.primaryStorage.bytesUsed)} / 1024 MB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          primaryStoragePct >= 92 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(primaryStoragePct, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>Rotação de gravação em 950 MB</span>
                      <span>{primaryStoragePct.toFixed(1)}% do limite</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 text-xs">
                    <span className="text-slate-500 block text-[11px]">Notícias Gravadas:</span>
                    <span className="font-mono text-slate-300">{routerState.primaryStorage.articleCount} itens</span>
                  </div>
                </div>

                {/* Banco 2 Storage */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-purple-400" />
                      <h4 className="font-bold text-white text-sm">Banco 2 • Armazenamento</h4>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        routerState.mirrorStorage.isNearLimit
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {routerState.mirrorStorage.isNearLimit ? "Teto 950MB Atingido" : "Disponível"}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Espaço Ocupado:</span>
                      <span className="font-mono text-white font-semibold">
                        {formatBytes(routerState.mirrorStorage.bytesUsed)} / 1024 MB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          mirrorStoragePct >= 92 ? "bg-amber-500" : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.max(mirrorStoragePct, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>Rotação de gravação em 950 MB</span>
                      <span>{mirrorStoragePct.toFixed(1)}% do limite</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 text-xs">
                    <span className="text-slate-500 block text-[11px]">Notícias Gravadas:</span>
                    <span className="font-mono text-slate-300">{routerState.mirrorStorage.articleCount} itens</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ÍNDICE & ESPELHAMENTO */}
          {activeTab === "sync" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-500 block">Acervo In-Code</span>
                  <p className="text-2xl font-bold font-serif text-white">{staticNewsData.length}</p>
                  <p className="text-[11px] text-slate-400">Notícias estáticas de contingência imediata.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-500 block">Índice Catálogo</span>
                  <p className="text-2xl font-bold font-serif text-emerald-400">{routerState.indexEntriesCount}</p>
                  <p className="text-[11px] text-slate-400">Notícias mapeadas com localização exata.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-500 block">Total Catalogado</span>
                  <p className="text-2xl font-bold font-serif text-blue-400">{routerState.totalArticlesCount}</p>
                  <p className="text-[11px] text-slate-400">100% de preservação garantida.</p>
                </div>
              </div>

              {/* Sync Action */}
              <div className="p-5 rounded-xl border border-blue-900/60 bg-blue-950/20 space-y-4">
                <div>
                  <h4 className="font-bold text-white text-base">Espelhar Acervo nos Bancos Firebase</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Grava o acervo no banco ativo respeitando o teto de 950MB e atualiza o índice catalográfico leve.
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
                  <span>{isSyncing ? "Sincronizando..." : "Executar Espelhamento e Indexação"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: ADMINISTRADORES AUTORIZADOS */}
          {activeTab === "auth" && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">Sessão Administrativa Atual</h4>
                    <p className="text-xs text-slate-400">Autenticado via Firebase Authentication nativo</p>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Administrador Verificado
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500 flex items-center justify-center text-blue-300 font-bold">
                      {authState.displayName?.charAt(0) || "A"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{authState.displayName || "Administrador"}</p>
                      <p className="text-xs text-slate-400 font-mono">{authState.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-950/60 border border-red-800/80 text-red-300 hover:bg-red-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Encerrar Sessão</span>
                  </button>
                </div>
              </div>

              {/* List of configured administrators from variable */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  E-mails com Permissão de Administrador (<code className="text-blue-400 font-mono">ADMINISTRADORES</code>)
                </h4>
                <p className="text-xs text-slate-400">
                  Somente os endereços abaixo podem visualizar esta tela de métricas e tráfego:
                </p>

                <div className="space-y-2 pt-1">
                  {getAdminEmailsList().map((adm, i) => (
                    <div
                      key={adm}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
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
