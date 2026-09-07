import React from "react";
import { FileText, Scale, ShieldAlert, ArrowLeft } from "lucide-react";

interface TermsPageProps {
  onBack: () => void;
  onNavigateToContact: () => void;
}

export const TermsOfUsePage: React.FC<TermsPageProps> = ({ onBack, onNavigateToContact }) => {
  return (
    <div id="terms-of-use-page" className="max-w-4xl mx-auto space-y-8 text-slate-200">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar à página inicial</span>
      </button>

      <div className="border-b border-blue-900/50 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60 text-xs font-semibold uppercase tracking-wider mb-3">
          <FileText className="w-4 h-4 text-blue-400" />
          <span>Regulamento Editorial e Condições de Uso</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Termos e Condições de Uso do Portal
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Vigência a partir de 7 de setembro de 2026 • Norma Jurídica Digital
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-slate-300">
        <section className="space-y-2">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">1. Aceitação dos Termos</h2>
          <p>
            Ao navegar ou interagir com o portal <strong>Norma Jurídica</strong>, você declara ter lido, compreendido e aceitado expressamente os presentes Termos de Uso e nossa Política de Privacidade.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">2. Natureza Informativa e Ausência de Consultoria Jurídica</h2>
          <p>
            O portal Norma Jurídica é um veículo de comunicação jornalística e divulgação de atos normativos, pareceres, ementas e jurisprudência dos tribunais superiores (STF, STJ, TST, TSE, STM, TRFs e TJ’s). O conteúdo disponibilizado possui caráter exclusivamente informativo e acadêmico, não constituindo parecer jurídico, aconselhamento legal ou substituição à contratação de advogado devidamente inscrito na Ordem dos Advogados do Brasil (OAB).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">3. Propriedade Intelectual e Citação de Fontes</h2>
          <p>
            Todo o layout, código-fonte, marcas, logotipos e textos autorais pertencem ao portal Norma Jurídica. As matérias originárias de agências públicas, órgãos estatais ou veículos parceiros devidamente indicados no rodapé de cada publicação respeitam os limites da legislação autoral vigente (Lei nº 9.610/1998). É permitida a reprodução parcial com atribuição expressa do crédito ao portal Norma Jurídica e inclusão de hiperlink direto.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">4. Conduta do Usuário e Interação</h2>
          <p>
            É expressamente vedado aos usuários utilizar o portal para enviar comunicações caluniosas, difamatórias, injuriosas ou com incitação ao ódio, bem como tentar contornar sistemas de segurança, injetar código malicioso ou extrair dados em massa sem autorização por escrito.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">5. Limitação de Responsabilidade</h2>
          <p>
            Embora nossa equipe envide os melhores esforços para garantir a precisão e a atualidade de todas as notícias e súmulas publicadas, o portal não responde por prejuízos decorrentes de atos praticados com base exclusivamente nas matérias jornalísticas veiculadas.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-bold text-white text-blue-300">6. Foro e Legislação Aplicável</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial o Marco Civil da Internet (Lei nº 12.965/2014) e a LGPD (Lei nº 13.709/2018). Fica eleito o Foro da Circunscrição Judiciária de Brasília - DF para dirimir eventuais controvérsias.
          </p>
        </section>
      </div>
    </div>
  );
};
