import React from "react";
import { ShieldCheck, Lock, FileText, Scale, UserCheck, Mail, ArrowLeft } from "lucide-react";

interface LegalPageProps {
  onBack: () => void;
  onNavigateToLgpd: () => void;
  onNavigateToConsent: () => void;
}

export const PrivacyPolicyPage: React.FC<LegalPageProps> = ({
  onBack,
  onNavigateToLgpd,
  onNavigateToConsent,
}) => {
  return (
    <div id="privacy-policy-page" className="max-w-4xl mx-auto space-y-8 text-slate-200">
      {/* Back button */}
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
          <span>Em Conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Política de Privacidade e Proteção de Dados Pessoais
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Última atualização: 7 de setembro de 2026 • Versão 2.4 (Norma Jurídica)
        </p>
      </div>

      {/* Summary Box */}
      <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-5 text-xs text-slate-300 space-y-2">
        <h3 className="font-serif text-sm font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400" />
          <span>Compromisso Fundamental com a Privacidade</span>
        </h3>
        <p className="leading-relaxed">
          O portal <strong>Norma Jurídica</strong> valoriza a transparência e a segurança de seus leitores. Esta Política estabelece como coletamos, tratamos, armazenamos e protegemos seus dados pessoais ao acessar nosso portal jornalístico, utilizar nossos serviços de consulta de clima e interagir com formulários institucionais.
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <button
            onClick={onNavigateToLgpd}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
          >
            Acessar Portal do Titular (Art. 18 LGPD)
          </button>
          <button
            onClick={onNavigateToConsent}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-blue-300 border border-blue-800/60 transition-colors"
          >
            Gerenciar Consentimento de Cookies
          </button>
        </div>
      </div>

      {/* Legal Content */}
      <div className="space-y-6 text-sm leading-relaxed text-slate-300">
        <section className="space-y-3">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">
            1. Controlador dos Dados e Contato do Encarregado (DPO)
          </h2>
          <p>
            O portal <strong>Norma Jurídica</strong> atua como Controlador no tratamento de dados pessoais coletados neste site.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li><strong>Entidade:</strong> Portal Norma Jurídica de Comunicação e Informação Jurídica</li>
            <li><strong>Sede Redacional:</strong> Brasília - Distrito Federal, Brasil</li>
            <li><strong>Canal Oficial de Contato:</strong> <code className="text-blue-300">contato@normajuridica.com.br</code></li>
            <li><strong>Encarregado de Proteção de Dados (DPO):</strong> Setor de Conformidade Regulatória e Direitos Digitais</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">
            2. Dados Coletados e Finalidades do Tratamento
          </h2>
          <p>Coletamos exclusivamente os dados necessários para o funcionamento e aprimoramento do portal:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
              <h4 className="font-bold text-white mb-1.5">Dados Fornecidos pelo Usuário</h4>
              <p className="text-slate-400">
                Nome, e-mail, telefone e teor de mensagens enviadas voluntariamente pelo formulário de contato, canal de contato ou requisição de direitos de titular.
              </p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
              <h4 className="font-bold text-white mb-1.5">Dados Técnicos e Geográficos</h4>
              <p className="text-slate-400">
                Endereço IP, geolocalização aproximada para previsão do tempo da cidade do usuário, identificadores de cookies de navegação e estatísticas de leitura.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">
            3. Bases Legais para o Tratamento (Art. 7º da LGPD)
          </h2>
          <p>Todo tratamento de dados pessoais no portal Norma Jurídica está estritamente fundamentado nas seguintes hipóteses legais:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li><strong>Consentimento (Art. 7º, I):</strong> Para cookies não essenciais (marketing, publicidade programática Google AdSense e métricas analíticas).</li>
            <li><strong>Legítimo Interesse (Art. 7º, IX):</strong> Para aprimoramento da estabilidade do sistema, segurança contra ataques DDoS e mensuração agregada de audiência editorial.</li>
            <li><strong>Cumprimento de Obrigação Legal (Art. 7º, II):</strong> Guarda de registros de acesso a aplicações de internet em observância ao Marco Civil da Internet (Lei nº 12.965/2014, Art. 15).</li>
            <li><strong>Atividade Jornalística (Art. 4º, II, a):</strong> Tratamento de dados para fins exclusivamente jornalísticos e artísticos com garantia de liberdade de imprensa e sigilo de fonte constitucional.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">
            4. Direitos do Titular de Dados Pessoais (Art. 18 da LGPD)
          </h2>
          <p>
            Em conformidade com o artigo 18 da Lei Geral de Proteção de Dados, você tem o direito de requerer a qualquer momento:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Confirmação da existência de tratamento de seus dados;</li>
            <li>Acesso aos dados coletados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
            <li>Eliminação dos dados pessoais tratados com o seu consentimento;</li>
            <li>Informação sobre as entidades públicas e privadas com as quais o controlador realizou uso compartilhado de dados;</li>
            <li>Revogação do consentimento concedido anteriormente.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">
            5. Compartilhamento e Publicidade (Google AdSense)
          </h2>
          <p>
            O portal utiliza espaços de monetização fornecidos pelo Google AdSense. Caso você tenha consentido com cookies de marketing, o Google pode utilizar cookies para veicular anúncios com base nas suas visitas a este e a outros sites na internet. Você pode desativar ou personalizar anúncios a qualquer momento através do nosso Gerenciador de Consentimento ou das configurações do Google Ads.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">
            6. Segurança da Informação
          </h2>
          <p>
            Adotamos medidas técnicas e administrativas aptas a proteger os dados pessoais contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda ou alteração, incluindo criptografia TLS/HTTPS de ponta a ponta e servidores seguros.
          </p>
        </section>
      </div>
    </div>
  );
};
