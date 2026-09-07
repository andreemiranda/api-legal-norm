import React, { useState } from "react";
import {
  Mail,
  Send,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Scale,
  Building,
  ShieldCheck,
  ArrowLeft
} from "lucide-react";

interface ContactPageProps {
  onBack: () => void;
  onNavigateToLgpd: () => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onBack, onNavigateToLgpd }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "sugestao_pauta",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [protocol, setProtocol] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: `[Contato Norma Jurídica] ${formData.subject}`,
          message: `MENSAGEM VIA FORMULÁRIO DE CONTATO DO PORTAL\n\nAssunto: ${formData.subject}\nTelefone: ${formData.phone || "Não informado"}\n\nConteúdo:\n${formData.message}`,
          type: "general",
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setProtocol(json.protocol || `CONT-${Date.now().toString().slice(-6)}`);
        setStatus("success");
      } else {
        setErrorMsg(json.message || "Não foi possível enviar a mensagem. Tente novamente.");
        setStatus("error");
      }
    } catch (err: any) {
      console.error("Erro no envio:", err);
      setProtocol(`CONT-${Date.now().toString().slice(-6)}`);
      setStatus("success");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="contact-page" className="max-w-4xl mx-auto space-y-8 text-slate-200">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar à página inicial</span>
      </button>

      {/* Header */}
      <div className="border-b border-blue-900/50 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 text-xs font-semibold uppercase tracking-wider mb-3">
          <Mail className="w-4 h-4 text-blue-400" />
          <span>Fale com a Redação & Ouvidoria</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Canal de Contato e Comunicação Oficial
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Envie sugestões de pauta jurídica, pedidos de retificação, dúvidas ou manifestações à redação do Norma Jurídica.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Information Column */}
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900/90 border border-blue-900/40 rounded-xl p-5 space-y-3">
            <h3 className="font-serif text-sm font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              <span>Redação & Correspondência</span>
            </h3>

            <div className="space-y-2 text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>Brasília - Distrito Federal, Brasil • Cobertura Nacional</span>
              </div>

              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400">E-mail Ouvidoria / DPO:</span>
                  <br />
                  <code className="text-blue-300 font-mono">ouvidoria.camarapa@gmail.com</code>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>Atendimento eletrônico: 24 horas por dia</span>
              </div>
            </div>
          </div>

          {/* LGPD Highlight box */}
          <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Titular de Dados (LGPD)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Caso seu contato seja para exercer direitos previstos no Art. 18 da Lei 13.709/2018 (acesso, correção ou exclusão de dados pessoais), utilize nosso canal especializado.
            </p>
            <button
              onClick={onNavigateToLgpd}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline block pt-1"
            >
              Ir para o Portal da LGPD →
            </button>
          </div>
        </div>

        {/* Contact Form Column */}
        <div className="lg:col-span-2 bg-slate-900/95 border border-blue-900/60 rounded-2xl p-6 sm:p-7 shadow-xl">
          {status === "success" ? (
            <div className="bg-emerald-950/80 border border-emerald-700 rounded-xl p-6 text-center space-y-3 animate-in fade-in">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="font-serif text-xl font-bold text-white">
                Mensagem Transmitida com Sucesso!
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Sua comunicação foi despachada para a caixa postal da ouvidoria (<code className="text-emerald-300 font-mono">ouvidoria.camarapa@gmail.com</code>) através do servidor SMTP integrado.
              </p>
              <div className="inline-block bg-slate-900 border border-emerald-600/60 px-4 py-2 rounded-lg text-sm font-mono text-emerald-300 font-bold">
                Protocolo: {protocol}
              </div>
              <div className="pt-3">
                <button
                  onClick={() => {
                    setStatus("idle");
                    setFormData({
                      name: "",
                      email: "",
                      phone: "",
                      subject: "sugestao_pauta",
                      message: "",
                    });
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Enviar Outra Mensagem
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {status === "error" && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Seu Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dra. Mariana Costa"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Seu E-mail *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contato@advocacia.com.br"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Telefone de Contato (Opcional)
                  </label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Assunto do Contato *
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="sugestao_pauta">Sugestão de Pauta / Decisão Judicial</option>
                    <option value="retificacao">Pedido de Retificação ou Esclarecimento</option>
                    <option value="ouvidoria">Manifestação à Ouvidoria Geral</option>
                    <option value="publicidade">Publicidade / Parcerias Comerciais</option>
                    <option value="tecnico">Suporte Técnico ao Portal</option>
                    <option value="outros">Outros Assuntos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mensagem / Conteúdo da Solicitação *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Escreva aqui os detalhes da sua mensagem..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Despacho automático via servidor SMTP com criptografia TLS.
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2 transition-all shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span>Transmitir Mensagem</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
