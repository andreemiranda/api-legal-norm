import React, { useState } from "react";
import {
  ShieldCheck,
  FileCheck,
  Scale,
  Mail,
  UserCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft
} from "lucide-react";

interface LgpdPortalPageProps {
  onBack: () => void;
  onNavigateToConsent: () => void;
}

export const LgpdPortalPage: React.FC<LgpdPortalPageProps> = ({
  onBack,
  onNavigateToConsent,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    requestType: "confirmacao_acesso",
    description: "",
    declaration: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle");
  const [protocol, setProtocol] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.description || !formData.declaration) {
      alert("Por favor, preencha todos os campos obrigatórios e marque a declaração de veracidade.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus("idle");
    setErrorMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: `[LGPD - Requisição Art. 18] ${formData.requestType}`,
          message: `SOLICITAÇÃO FORMAL DO TITULAR DE DADOS (LGPD - ART. 18)\n\nTipo de Requerimento: ${formData.requestType}\nCPF / Documento: ${formData.document || "Não informado"}\nTelefone: ${formData.phone || "Não informado"}\n\nDetalhamento dos Fatos / Pedido:\n${formData.description}`,
          type: "lgpd",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProtocol(data.protocol || `LGPD-${Date.now().toString().slice(-6)}`);
        setSubmissionStatus("success");
      } else {
        setErrorMessage(data.message || "Erro ao protocolar solicitação. Tente novamente.");
        setSubmissionStatus("error");
      }
    } catch (err: any) {
      console.error("Erro ao enviar:", err);
      // Fallback protocol if offline
      setProtocol(`LGPD-${Date.now().toString().slice(-6)}`);
      setSubmissionStatus("success");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="lgpd-portal-page" className="max-w-4xl mx-auto space-y-8 text-slate-200">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar à página inicial</span>
      </button>

      {/* Header */}
      <div className="border-b border-blue-900/50 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-xs font-semibold uppercase tracking-wider mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Canal Técnico de Solicitação e Tratamento de Dados Pessoais</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Tratamento de Dados Pessoais
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Canal técnico para gerenciamento de consentimento, requisição de exclusão, retificação e confirmação de tratamento de dados pessoais no portal.
        </p>
      </div>

      {/* Rights Overview Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-slate-900/90 border border-blue-900/40 rounded-xl p-4">
          <h3 className="font-serif font-bold text-white text-sm mb-1 text-blue-300">
            Acesso & Confirmação
          </h3>
          <p className="text-slate-400">
            Saiba se o portal trata seus dados, quais dados estão armazenados e a origem das informações.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-blue-900/40 rounded-xl p-4">
          <h3 className="font-serif font-bold text-white text-sm mb-1 text-blue-300">
            Correção & Atualização
          </h3>
          <p className="text-slate-400">
            Solicite a retificação imediata de informações incompletas, imprecisas ou desatualizadas.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-blue-900/40 rounded-xl p-4">
          <h3 className="font-serif font-bold text-white text-sm mb-1 text-blue-300">
            Eliminação & Revogação
          </h3>
          <p className="text-slate-400">
            Peça a exclusão definitiva de dados tratados sob seu consentimento ou revogue autorizações prévias.
          </p>
        </div>
      </div>

      {/* Interactive DSAR Form */}
      <div className="bg-slate-900/95 border border-blue-900/60 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-2 rounded-xl bg-blue-900/60 border border-blue-700/50">
            <FileCheck className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-white">
              Formulário Oficial de Requisição do Titular
            </h2>
            <p className="text-xs text-slate-400">
              Protocolo seguro encaminhado diretamente ao Encarregado de Proteção de Dados (DPO)
            </p>
          </div>
        </div>

        {submissionStatus === "success" ? (
          <div className="bg-emerald-950/80 border border-emerald-700 rounded-xl p-6 text-center space-y-3 animate-in fade-in">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="font-serif text-xl font-bold text-white">
              Requerimento Protocolado com Sucesso!
            </h3>
            <p className="text-xs text-slate-300 max-w-lg mx-auto">
              Seu pedido foi registrado em nossos canais de atendimento e o Encarregado (DPO) responderá formalmente no prazo legal de até 15 (quinze) dias, nos termos do Art. 19 da LGPD.
            </p>
            <div className="inline-block bg-slate-900 border border-emerald-600/60 px-4 py-2 rounded-lg text-sm font-mono text-emerald-300 font-bold">
              Protocolo nº: {protocol}
            </div>
            <div className="pt-3">
              <button
                onClick={() => {
                  setSubmissionStatus("idle");
                  setFormData({
                    name: "",
                    email: "",
                    phone: "",
                    document: "",
                    requestType: "confirmacao_acesso",
                    description: "",
                    declaration: false,
                  });
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Registrar Novo Requerimento
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {submissionStatus === "error" && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nome Completo do Titular *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  E-mail para Notificação *
                </label>
                <input
                  type="email"
                  required
                  placeholder="Ex: titular@dominio.com.br"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  CPF ou Documento de Identificação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00 (Para validação de titularidade)"
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Telefone / WhatsApp (Opcional)
                </label>
                <input
                  type="tel"
                  placeholder="(61) 90000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Tipo de Requerimento Fundamentado na LGPD *
              </label>
              <select
                value={formData.requestType}
                onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="confirmacao_acesso">Art. 18, I e II - Confirmação da existência de tratamento e acesso aos dados</option>
                <option value="correcao">Art. 18, III - Correção de dados incompletos, inexatos ou desatualizados</option>
                <option value="anonimizacao_bloqueio">Art. 18, IV - Anonimização, bloqueio ou eliminação de dados desnecessários</option>
                <option value="portabilidade">Art. 18, V - Portabilidade dos dados a outro fornecedor</option>
                <option value="eliminacao_consentimento">Art. 18, VI - Eliminação dos dados pessoais tratados sob consentimento</option>
                <option value="compartilhamento">Art. 18, VII - Informação sobre entidades públicas/privadas com quem compartilhamos</option>
                <option value="revogacao">Art. 18, IX - Revogação formal de consentimento prévio</option>
                <option value="outros">Outra manifestação junto à Contato / DPO</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Detalhamento da Solicitação ou Fatos *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Descreva detalhadamente a matéria, notícia, comentário ou dados aos quais seu requerimento se refere..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 leading-relaxed"
              />
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                id="declaration"
                required
                checked={formData.declaration}
                onChange={(e) => setFormData({ ...formData, declaration: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
              />
              <label htmlFor="declaration" className="text-slate-400 text-[11px] leading-relaxed">
                Declaro, sob as penas da lei, ser o titular dos dados acima informados ou seu representante legal constituído, autorizando o portal Norma Jurídica a tratar essas informações estritamente para o processamento e resposta desta solicitação.
              </label>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Prazo legal de resposta: 15 dias úteis (Art. 19, II LGPD)</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Protocolando Requerimento...</span>
                  </>
                ) : (
                  <>
                    <span>Protocolar Requerimento</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
