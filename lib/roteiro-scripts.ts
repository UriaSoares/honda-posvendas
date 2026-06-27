import type { FaseId } from "@/lib/playbook";

// Roteiro de scripts por fase de atendimento — fonte de conteúdo do playbook
// da aba Conversas. Cada fase pode ter VÁRIAS opções de script; o painel
// sugere todas e a atendente escolhe.
//
// Variáveis: {nome} = cliente, {consultor} = atendente logado, {km} = km da revisão.
// (No envio, o sistema substitui automaticamente.)
//
// ⚠️ EM CONSTRUÇÃO — preenchendo aos poucos. As fases sem scripts ainda
// receberão o conteúdo completo numa carga única.

export interface RoteiroScript {
  id: string;
  rotulo?: string;   // etiqueta curta opcional (ex: "Humanizado", "Direto")
  texto: string;
}

export type RoteiroPorFase = Partial<Record<FaseId, RoteiroScript[]>>;

export const ROTEIRO_SCRIPTS: RoteiroPorFase = {
  boas_vindas: [
    {
      id: "boas_vindas_1",
      texto: `Olá, {nome}! Tudo bem?
Aqui é o {consultor} da Caiobá Honda.
Passando aqui para te dar os parabéns mais uma vez pela conquista da sua Honda 0km! Ficamos muito felizes em fazer parte da realização desse sonho. 🏍️💨

Salva este nosso número na sua agenda, tá? Esse aqui é o seu canal direto e oficial com a gente. É por aqui que você vai poder tirar dúvidas e agendar as suas revisões com facilidade. 🛠️`,
    },
    {
      id: "boas_vindas_2",
      texto: `Olá, {nome}! Tudo certo?
Aqui é a equipe de Pós-Vendas da Caiobá Honda.
Parabéns pela sua Honda 0km! Que ela te traga muitas alegrias e rotas incríveis! 🚀
Te chamamos aqui para te passar dois avisos rápidos:
1️⃣ Este número é o nosso canal oficial! Quando precisar agendar a sua 1ª revisão ou tiver qualquer dúvida, é só nos mandar um 'Oi' por aqui.
2️⃣ Em breve entraremos em contato para uma rápida pesquisa de qualidade, pois sua opinião é fundamental para nós.
Obrigado por escolher a Caiobá! E se tiver algum amigo ou parente querendo realizar o mesmo sonho, já sabe com quem falar, né? 😉 Tamo junto!`,
    },
  ],

  coffee_break: [
    {
      id: "coffee_break_1",
      texto: `Olá, {nome}! Tudo bem?
Aqui é o {consultor} da Caiobá Honda. Já faz uns dias que você tirou sua moto nova com a gente, como ela está se comportando? 🏍️
Estou te chamando para fazer um convite super especial! Neste sábado, teremos um Café da Manhã Exclusivo aqui na loja para os nossos novos clientes. Além do café, nossa equipe técnica vai fazer ajustes personalizados nos comandos da sua moto (como embreagem, freios e retrovisores) para deixá-la exatamente na medida da sua altura e do seu estilo de pilotagem.
Isso vai deixar o seu dia a dia muito mais confortável e seguro! 🛠️
Posso confirmar a sua presença? Ah, e para eu já deixar a sua ficha separada para o pessoal da oficina, quantos quilômetros a sua moto está marcando no painel hoje?`,
    },
    {
      id: "coffee_break_2",
      texto: `Olá, {nome}! Tudo certo? Aqui é a equipe de Pós-Vendas da Caiobá Honda. 🚀
Queremos elevar a sua experiência com a sua Honda 0km para outro nível!
Por isso, gostaríamos de te convidar para o nosso Coffee Break Especial neste final de semana. ☕
Vai rolar um bate-papo super bacana com dicas de pilotagem segura, e nossos mecânicos farão ajustes finos e personalizados na sua moto para garantir que ela esteja 100% adaptada ao seu corpo. Uma postura correta na moto cansa muito menos e evita sustos no trânsito!
Você consegue dar uma passadinha aqui para tomar esse café com a gente? 😉`,
    },
  ],

  // revisao_1: [],   // a preencher
  // revisao_2: [],   // a preencher
  // revisao_3: [],   // a preencher
  // ciclo:     [],   // a preencher
};
