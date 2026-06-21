"use client";

import { useState } from "react";
import type { Role } from "@/lib/auth/users";
import { findTemplate } from "@/lib/whatsapp-templates";
import ChatPanel, { type ActiveConv } from "@/components/ChatPanel";

type ContactId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface ScriptsPanelProps { user: { role: Role } }

interface Script { title: string; tag: string; text: string; strat: string }
interface Contact {
  title: string; sub: string; phase: string;
  vars: string[]; scripts: Script[]; reactions: string[];
}

const CONTACTS: Contact[] = [
  {
    title: "Contato 1 — Boas-vindas do Pós-Vendas",
    sub: "1 a 3 dias após a retirada da moto 0km",
    phase: "Fase 1",
    vars: ["nome", "consultor"],
    scripts: [
      {
        title: "Opção 1", tag: "Humanizado / Relacional",
        strat: "Substitui tom burocrático por parceria",
        text: `Olá, {nome}! Tudo bem?
Aqui é o {consultor} da Caiobá Honda.
Passando aqui para dar os parabéns mais uma vez pela conquista da sua Honda 0km! Ficamos muito felizes em fazer parte da realização desse sonho. 🏍️

Salva este nosso número na sua agenda, tá? Esse aqui é o seu canal direto e oficial com a gente. É por aqui que você vai poder tirar dúvidas e agendar as suas revisões com facilidade. 🔧

Nos próximos dias, nosso time vai te dar um toque bem rápido só para saber como estão sendo esses primeiros dias com a moto e fazer uma breve pesquisa de qualidade.

Aproveite muito a sua moto nova e conte com a gente!`,
      },
      {
        title: "Opção 2", tag: "Direto / Prático",
        strat: "Vai direto ao ponto, pedido sutil de indicação",
        text: `Olá, {nome}! Tudo certo?
Aqui é a equipe de Pós-Vendas da Caiobá Honda.
Parabéns pela sua Honda 0km! Que ela te traga muitas alegrias e rotas incríveis! 🚀

Te chamamos aqui para te passar dois avisos rápidos:
1️⃣ Este número é o nosso canal oficial! Quando precisar agendar a sua 1ª revisão ou tiver qualquer dúvida, é só nos mandar um "Oi" por aqui.
2️⃣ Em breve entraremos em contato para uma rápida pesquisa de qualidade, pois sua opinião é fundamental para nós.

Obrigado por escolher a Caiobá! E se tiver algum amigo ou parente querendo realizar o mesmo sonho, já sabe com quem falar, né? 😉 Tamo junto!`,
      },
    ],
    reactions: ["É muito caro", "Não tenho tempo agora", "Vou pensar"],
  },
  {
    title: "Contato 2 — O Convite Estratégico (Coffee Break)",
    sub: "20 dias após a retirada da moto",
    phase: "Fase 1",
    vars: ["nome", "consultor", "km"],
    scripts: [
      {
        title: "Script 1", tag: "Ajuste sob medida",
        strat: "Traz o cliente para a loja com benefício claro, captura Km de forma natural",
        text: `Olá, {nome}! Tudo bem?
Aqui é o {consultor} da Caiobá Honda. Já faz uns dias que você tirou sua moto nova com a gente, como ela está se comportando? 🏍️

Estou te chamando para fazer um convite super especial! Neste sábado, teremos um Café da Manhã Exclusivo aqui na loja para os nossos novos clientes. Além do café, nossa equipe técnica vai fazer ajustes personalizados nos comandos da sua moto para deixá-la exatamente na medida da sua altura e do seu estilo de pilotagem.

Isso vai deixar o seu dia a dia muito mais confortável e seguro! 🔧

Posso confirmar a sua presença? Ah, e para eu já deixar a sua ficha separada para o pessoal da oficina, quantos quilômetros a sua moto está marcando no painel hoje?`,
      },
      {
        title: "Script 2", tag: "Clube de vantagens",
        strat: "Foco em quem valoriza segurança e aprendizado",
        text: `Olá, {nome}! Tudo certo? Aqui é a equipe de Pós-Vendas da Caiobá Honda. 🚀

Queremos elevar a sua experiência com a sua Honda 0km para outro nível!

Por isso, gostaríamos de te convidar para o nosso Coffee Break Especial neste final de semana. ☕

Vai rolar um bate-papo super bacana com dicas de pilotagem segura, e nossos mecânicos farão ajustes finos e personalizados na sua moto para garantir que ela esteja 100% adaptada ao seu corpo.

Você consegue dar uma passadinha aqui para tomar esse café com a gente? 😉`,
      },
      {
        title: "Script 3", tag: "Áudio 25s + texto",
        strat: "Áudio transmite entusiasmo, aumenta taxa de resposta",
        text: `(Áudio de 25 segundos)
"{nome}, bom dia, tudo bem? Te mandei esse áudio para fazer um convite especial. Já faz uns 20 dias que você pegou a moto, então a gente quer te convidar pra um café da manhã aqui na Caiobá. A ideia é a gente dar uma olhada na ergonomia da sua moto, ajustar a altura dos manetes, freio e retrovisor pra sua altura exata. Me dá um toque aqui se você consegue vir e pfv."

(Mensagem de texto logo abaixo)
"Te mandei um áudio com um convite super bacana para você vir tomar um café com a gente e ajustar sua moto! ☕👆"`,
      },
    ],
    reactions: ["Não tenho tempo", "Não vou poder ir", "O que é o Coffee Break?"],
  },
  {
    title: "Contato 3 — Alerta da 1ª Revisão",
    sub: "~15 dias antes de 1.000 km • ou no 5º mês",
    phase: "Fase 2",
    vars: ["nome", "consultor"],
    scripts: [
      {
        title: "Script 1", tag: "Guardião da garantia",
        strat: "Usa dados do Coffee Break para surpreender, ativa aversão à perda",
        text: `Fala, {nome}! Tudo bem? Aqui é o {consultor}, do Pós-Vendas da Caiobá Honda.

Lembra que calculamos a sua média de rodagem no nosso café? Pelas minhas contas aqui, a sua moto está prestes a bater os 1.000 km! 🏍️

Te chamei hoje com antecedência para proteger a sua garantia de 3 anos. A fábrica é super rigorosa com a 1ª revisão: ela precisa ser feita obrigatoriamente na janela entre 900 km e 1.100 km. Se passar disso, o sistema cancela a sua garantia automaticamente.

Como a mão de obra dessa revisão é 100% gratuita, quantos Km ela está marcando hoje no painel para eu já travar a sua vaga aqui na nossa agenda?`,
      },
      {
        title: "Script 2", tag: "5º mês — baixo giro",
        strat: "Foco no amaciamento do motor e critério de tempo",
        text: `Olá, {nome}! Tudo certo? Aqui é a equipe técnica da Caiobá Honda. 🔧

Estamos acompanhando a sua jornada com a moto e vimos que está chegando a hora da revisão.

Essa fase é fundamental, pois é na 1ª revisão que nós trocamos o óleo do amaciamento do motor para garantir que ele tenha uma vida útil super longa e potente.

A regra de ouro da Honda é não ultrapassar o prazo limite de 6 meses para não perder a sua garantia de 3 anos de fábrica.

A excelente notícia é que a mão de obra dessa revisão é totalmente grátis! Vamos aproveitar e já deixar um horário reservado para a próxima semana e garantir o seu carimbo no manual?`,
      },
    ],
    reactions: ["É muito caro", "Não tenho tempo", "Vou no mecânico de confiança", "Rodo muito pouco"],
  },
  {
    title: "Contato 4 — Alerta da 2ª Revisão",
    sub: "Projeção por Km • ou no 11º mês",
    phase: "Fase 2",
    vars: ["nome", "consultor"],
    scripts: [
      {
        title: "Script 1", tag: "Alerta de cortesia",
        strat: "Duplo argumento: garantia + última MO gratuita",
        text: `Fala, {nome}! Tudo bem? Aqui é o {consultor} do Pós-Vendas da Caiobá Honda.

Lembra daquela sua média de rodagem que acompanhamos na primeira revisão? Pelos nossos cálculos, você está chegando na marca dos 6.000 km! 🏍️

Te chamei com antecedência porque essa 2ª Revisão é super importante: primeiro, ela é obrigatória para mantermos a sua garantia de 3 anos de fábrica ativa.

E segundo: essa é a última revisão em que a mão de obra é 100% um presente da Honda para você!

A nossa janela de tolerância vai de 5.400 a 6.600 km. Quantos Km exatos ela está marcando hoje no painel para eu garantir a sua vaga de cortesia aqui na nossa agenda?`,
      },
      {
        title: "Script 2", tag: "11º mês — aniversário",
        strat: "Tom comemorativo transforma obrigação em convite",
        text: `Olá, {nome}! Tudo certo? Aqui é a equipe técnica da Caiobá Honda. 🔧

Estamos vendo aqui no sistema que você e sua moto estão quase completando 1 ano juntos! 🎉 Tempo passa rápido hehe!

Te chamamos para lembrar da sua Revisão de 12 meses (ou 6.000 km). Fazer esse check-up agora é essencial para preservar as peças e carimbar o manual para não perder a sua garantia de 3 anos.

E a melhor notícia: a mão de obra desta revisão de aniversário de 1 ano ainda é totalmente gratuita pela fábrica!

Como temos um prazo rigoroso, que tal já deixarmos o seu box reservado para a semana que vem e deixar a moto novinha para o segundo ano de uso?`,
      },
    ],
    reactions: ["É muito caro", "Já fiz em outro lugar", "Não tenho tempo"],
  },
  {
    title: "Contato 5 — Transição: 3ª Revisão",
    sub: "Projeção por Km • ou no 17º mês",
    phase: "Fase 3",
    vars: ["nome", "consultor"],
    scripts: [
      {
        title: "Script 1", tag: "Consultor financeiro",
        strat: "Ataca a dor do custo futuro, manutenção = investimento",
        text: `Fala, {nome}! Tudo bem? Aqui é o {consultor}, seu consultor de Pós-Vendas da Caiobá Honda.

Acompanhando seu histórico, vi que sua moto está chegando perto dos 12.000 km. Essa é a nossa Revisão de Transição!

Essa 3ª revisão é uma das mais críticas para a vida útil da sua moto. É nela que fazemos o ajuste fino de válvulas, checagem de freios e fluidos. Fazer esse serviço aqui com nossos especialistas garante que você previna o desgaste de peças caríssimas do motor e não perca a sua garantia de 3 anos de fábrica.

Vamos agendar o seu horário e manter o carimbo oficial no seu manual para a sua moto continuar super valorizada? Quantos Km ela está marcando hoje?`,
      },
      {
        title: "Script 2", tag: "17º mês — segurança",
        strat: "Urgência real: tolerância cai para 600km / 1 dia útil",
        text: `Olá, {nome}! Tudo certo? Aqui é a equipe técnica da Caiobá Honda. 🔧

Já estamos no 17º mês desde que você realizou o sonho de tirar sua Honda 0km com a gente! Estamos entrando na janela da 3ª Revisão (a de 18 meses).

A partir de agora, a tolerância da fábrica muda para apenas 600 km ou 1 dia útil. Se passar disso, a garantia de 3 anos é cancelada na hora.

Além disso, essa é a manutenção onde checamos os sistemas vitais para a sua segurança no trânsito.

Como essa revisão tem o custo da mão de obra, nós preparamos condições de pagamento facilitadas para você que já é de casa.

Me manda uma foto do seu painel para eu calcular sua tolerância exata e não te deixar perder essa garantia?`,
      },
    ],
    reactions: ["É muito caro", "Vou no mecânico", "Tolerância de 600km é muito pouco"],
  },
  {
    title: "Ciclo Fixo — A cada 6.000 km ou 6 meses",
    sub: "18.000 km (24m) • 24.000 km (30m) • 30.000 km (36m)...",
    phase: "Fase 3",
    vars: ["nome", "consultor", "km"],
    scripts: [
      {
        title: "Script 1", tag: "Check-up específico",
        strat: "Âncora técnica específica do serviço gera autoridade",
        text: `Fala, {nome}! Tudo bem? Aqui é o {consultor} da Caiobá Honda.

A nossa parceira de estrada está chegando na marca dos {km} km! 🏍️

Te chamei porque essa revisão é uma das mais importantes do manual. É nela que fazemos a substituição obrigatória do filtro de ar e checamos o desgaste da relação, o que faz a sua moto continuar econômica e não forçar o motor à toa.

A nossa janela de tolerância de 600 km está rodando. Como estão os Km exatos no seu painel hoje para eu já separar o seu kit de revisão aqui na oficina?`,
      },
      {
        title: "Script 2", tag: "Check-up de ouro (30.000 km)",
        strat: "Aversão à perda: últimos meses de cobertura de fábrica",
        text: `Olá, {nome}! Tudo certo? Aqui é a equipe de Pós-Vendas da Caiobá Honda. 🔧

Estava olhando a sua pasta e vi que a sua moto já passou dos 30.000 km. Estamos entrando na reta final da sua Garantia de 3 anos da Honda!

Essa Revisão de 30.000 km é o que a gente chama de "Check-up de Ouro". É a oportunidade perfeita para nossos mecânicos fazerem um pente-fino na moto inteira. Se tiver qualquer detalhe ou defeito de fábrica, a gente já aciona a garantia e resolve para você sem custo de peças antes que o prazo expire!

Vamos agendar o seu box para a próxima semana e carimbar o manual para manter ela super valorizada?`,
      },
    ],
    reactions: ["É muito caro", "Não tenho tempo", "Para que revisar se está funcionando bem?"],
  },
  {
    title: "Contornando Objeções",
    sub: "Como responder quando o cliente resiste",
    phase: "Apoio",
    vars: ["nome"],
    scripts: [
      {
        title: "Resistência financeira", tag: '"É muito caro"',
        strat: "Transforma crítica em pergunta de solução",
        text: `Entendo perfeitamente o seu lado, {nome}. Realmente, quando a mão de obra deixa de ser presente da fábrica, a gente pesa no bolso e pensa em economizar.

A questão é que essa revisão não é um gasto, é o que garante a prevenção de quebras no motor e na injeção. O barato em oficinas não autorizadas pode custar caríssimo lá na frente, além de rasgar o seu manual.

Eu tenho liberdade de pedir pro meu gerente parcelar para você sem juros no cartão, se ele autorizar — você agenda pra essa semana?`,
      },
      {
        title: "Reatância psicológica", tag: '"Vocês querem empurrar serviço"',
        strat: "Transparência total, convida o cliente a participar",
        text: `Você tem toda razão em ser cauteloso, {nome}. Infelizmente o mercado tem muitos profissionais ruins que fazem isso. Mas aqui a gente trabalha de forma 100% transparente.

Nós seguimos exclusivamente a Tabela de Manutenção oficial da Honda. Nosso papel não é inventar serviço, é checar os itens obrigatórios para proteger a sua segurança e a sua garantia.

Se você buscar seu manual agora a gente confere juntos o que troca, o que checa e o que aperta. Além disso nenhum parafuso ou peça de desgaste natural é trocado sem a sua autorização prévia.

Que tal trazer a moto para fazermos apenas o que o manual exige e você mesmo acompanha o que precisa ser feito?`,
      },
    ],
    reactions: ["Não tenho tempo", "Vou pensar", "Minha moto está boa"],
  },
  {
    title: "Perguntas Frequentes",
    sub: "Respostas oficiais para as dúvidas mais comuns",
    phase: "Apoio",
    vars: ["nome"],
    scripts: [
      {
        title: "Sobre a gratuidade", tag: '"A revisão é 100% de graça?"',
        strat: "Clareza + diferencial Caiobá no final",
        text: `Ótima pergunta, {nome}! A Honda garante a mão de obra gratuita nas revisões de 1.000 km e 6.000 km. Isso significa que o técnico não cobra nada pelo serviço.

No entanto, os itens de desgaste natural — como velas, juntas, guarnições, fluidos e materiais de limpeza — correm por conta do proprietário, assim como em qualquer revisão.

E aqui tem um diferencial da Caiobá: nós oferecemos o fornecimento gratuito de óleo por até 7 revisões, desde que as manutenções anteriores tenham sido feitas na concessionária dentro dos prazos previstos. 😉`,
      },
      {
        title: "Sobre a tolerância", tag: '"Um pouquinho passa, a fábrica corta?"',
        strat: "Números exatos geram autoridade e urgência real",
        text: `Sim, {nome}, a Honda é rigorosa e o sistema cancela automaticamente se a tolerância for ultrapassada.

As janelas são:
• 1ª revisão: entre 900 km e 1.100 km
• 2ª revisão: entre 5.400 km e 6.600 km
• 3ª revisão em diante: exatamente ±600 km
• Critério de tempo: tolerância de apenas 1 dia útil

Por isso eu te aviso com antecedência — para você ter tempo de agendar sem correria e sem risco de perder os 3 anos de garantia.`,
      },
    ],
    reactions: ["Entendi, quero agendar", "Tenho outra dúvida"],
  },
];

const SIDEBAR_ITEMS = [
  { group: "Fase 1 — Encantamento",    items: [{ id: 0, label: "Boas-vindas" }, { id: 1, label: "Coffee Break" }] },
  { group: "Fase 2 — Garantia",        items: [{ id: 2, label: "Alerta 1ª Revisão" }, { id: 3, label: "Alerta 2ª Revisão" }] },
  { group: "Fase 3 — Transição",       items: [{ id: 4, label: "3ª Revisão" }, { id: 5, label: "Ciclo contínuo" }] },
  { group: "Apoio",                    items: [{ id: 6, label: "Objeções" }, { id: 7, label: "Perguntas frequentes" }] },
];

export default function ScriptsPanel({ user }: ScriptsPanelProps) {
  const [current, setCurrent] = useState<ContactId>(0);
  const [nome,    setNome]    = useState("");
  const [cons,    setCons]    = useState("");
  const [km,      setKm]      = useState("");
  const [copied,  setCopied]  = useState<number | null>(null);
  const [active,  setActive]  = useState<ActiveConv | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sent,    setSent]    = useState<number | null>(null);

  const isManager = user.role === "admin" || user.role === "gestao";
  const c = CONTACTS[current];

  function fill(text: string): string {
    return text
      .replace(/\{nome\}/g,      nome      || "{nome}")
      .replace(/\{consultor\}/g, cons      || "{consultor}")
      .replace(/\{km\}/g,        km        || "{km}");
  }

  function copyScript(idx: number) {
    navigator.clipboard.writeText(fill(c.scripts[idx].text)).catch(() => {});
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  async function sendScript(idx: number) {
    if (!active) return;
    setSent(idx);
    try {
      const r = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wa: active.wa,
          phoneNumberId: active.phoneNumberId,
          contactId: current,
          scriptId: idx,
          vars: { nome: nome || active.nome, consultor: cons, km },
        }),
      });
      if (r.ok) setReloadKey(k => k + 1);
    } finally {
      setTimeout(() => setSent(null), 2000);
    }
  }

  const sidebarW = 200;

  return (
    <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", minHeight: 540 }}>
      {/* Sidebar */}
      <div style={{ width: sidebarW, flexShrink: 0, background: "#082F58", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
            Scripts <span style={{ color: "#FBB814" }}>Qualidade</span>
          </div>
        </div>
        {SIDEBAR_ITEMS.map(({ group, items }) => (
          <div key={group} style={{ padding: "10px 10px 4px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.35)", padding: "0 4px", marginBottom: 4 }}>
              {group}
            </div>
            {items.map(({ id, label }) => {
              const active = current === id;
              return (
                <button
                  key={id}
                  onClick={() => setCurrent(id as ContactId)}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 7, marginBottom: 2, cursor: "pointer",
                    background: active ? "rgba(251,184,20,0.15)" : "transparent",
                    border: active ? "1px solid rgba(251,184,20,0.3)" : "1px solid transparent",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: active ? "#FBB814" : "rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                    color: active ? "#082F58" : "rgba(255,255,255,0.5)",
                  }}>{id + 1 <= 6 ? id + 1 : "?"}</div>
                  <span style={{ fontSize: 12, color: active ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: active ? 600 : 400 }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{c.sub}</div>
          </div>
          <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#e0e7ff", color: "#3730a3" }}>
            {c.phase}
          </span>
        </div>

        {/* Vars */}
        <div style={{ padding: "10px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {c.vars.includes("nome") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Nome:</span>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João Silva"
                style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 9px", fontSize: 12, fontFamily: "inherit", outline: "none", width: 130 }} />
            </div>
          )}
          {c.vars.includes("consultor") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Consultor:</span>
              <input value={cons} onChange={e => setCons(e.target.value)} placeholder="Seu nome"
                style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 9px", fontSize: 12, fontFamily: "inherit", outline: "none", width: 120 }} />
            </div>
          )}
          {c.vars.includes("km") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Km atual:</span>
              <input value={km} onChange={e => setKm(e.target.value)} placeholder="Ex: 480"
                style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 9px", fontSize: 12, fontFamily: "inherit", outline: "none", width: 80 }} />
            </div>
          )}
        </div>

        {/* Scripts */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {c.scripts.map((s, i) => (
            <div key={i} style={{ flex: 1, borderRight: i < c.scripts.length - 1 ? "1px solid #e2e8f0" : "none", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#082F58", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.title}</span>
                <span style={{ fontSize: 10, color: "#64748b", background: "#f1f5f9", padding: "2px 7px", borderRadius: 10 }}>{s.tag}</span>
              </div>
              <div style={{ padding: "12px 14px", flex: 1, overflowY: "auto", fontSize: 12.5, lineHeight: 1.75, color: "#0f172a", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {fill(s.text).split(/(\{[^}]+\})/).map((part, j) =>
                  part.startsWith("{") ? (
                    <mark key={j} style={{ background: "#fef9c3", borderRadius: 3, padding: "0 2px", fontWeight: 600, color: "#854d0e" }}>{part}</mark>
                  ) : part
                )}
              </div>
              <div style={{ padding: "8px 14px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 10, color: "#64748b", fontStyle: "italic", flex: 1, lineHeight: 1.3 }}>{s.strat}</span>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => copyScript(i)}
                    style={{
                      padding: "7px 12px", background: copied === i ? "#166534" : "#e2e8f0",
                      color: copied === i ? "#fff" : "#082F58",
                      border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {copied === i ? "✓" : "Copiar"}
                  </button>
                  {findTemplate(current, i) && (
                    <button
                      onClick={() => sendScript(i)}
                      disabled={!active || sent === i}
                      title={active ? `Enviar para ${active.nome}` : "Selecione uma conversa no WhatsApp ao lado"}
                      style={{
                        padding: "7px 12px",
                        background: sent === i ? "#166534" : !active ? "#cbd5e1" : "#25D366",
                        color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
                        cursor: !active ? "not-allowed" : "pointer", fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sent === i ? "✓ Enviado" : "Enviar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reactions */}
        <div style={{ padding: "10px 18px", borderTop: "1px solid #e2e8f0", background: "#fafafa" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 6 }}>
            E se o cliente reagir assim?
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.reactions.map(r => (
              <button key={r} style={{
                padding: "5px 11px", border: "0.5px solid #e2e8f0", borderRadius: 20,
                fontSize: 11, color: "#64748b", cursor: "pointer", background: "#fff", fontFamily: "inherit",
              }}>
                &ldquo;{r}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — WhatsApp ao vivo */}
      <div style={{ width: 380, flexShrink: 0, borderLeft: "1px solid #e2e8f0" }}>
        <ChatPanel
          isManager={isManager}
          reloadKey={reloadKey}
          onActiveChange={setActive}
        />
      </div>
    </div>
  );
}
