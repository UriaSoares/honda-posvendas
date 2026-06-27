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

  revisao_1: [
    {
      id: "revisao_1_1",
      texto: `Fala, {nome}! Tudo bem? Aqui é o {consultor}, do Pós-Vendas da Caiobá Honda.
Lembra que calculamos a sua média de rodagem no nosso café? Pelas minhas contas aqui, a sua moto está prestes a bater os 1.000 km! 🏍️💨
Te chamei hoje com antecedência para proteger a sua garantia de 3 anos. A fábrica é super rigorosa com a 1ª revisão: ela precisa ser feita obrigatoriamente na janela entre 900 km e 1.100 km, se passar disso, o sistema cancela a sua garantia automaticamente.
Como a mão de obra dessa revisão é 100% gratuita, quantos Km ela está marcando hoje no painel pra eu já travar a sua vaga aqui na nossa agenda?`,
    },
    {
      id: "revisao_1_2",
      texto: `Olá, {nome}! Tudo certo? Aqui é a equipe técnica da Caiobá Honda. 🛠️
Estamos acompanhando a sua jornada com a moto e vimos que está chegando a hora da revisão.
Essa fase é fundamental, pois é na 1ª revisão que nós trocamos o óleo do amaciamento do motor para garantir que ele tenha uma vida útil super longa e potente.
A regra de ouro da Honda é não ultrapassar o prazo limite de 6 meses para não perder a sua garantia de 3 anos de fábrica.
A excelente notícia é que a mão de obra dessa revisão é totalmente grátis! Vamos aproveitar e já deixar um horário reservado para a próxima semana e garantir o seu carimbo no manual?`,
    },
  ],

  revisao_2: [
    {
      id: "revisao_2_1",
      texto: `Fala, {nome}! Tudo bem? Aqui é o {consultor} do Pós-Vendas da Caiobá Honda.
Lembra daquela sua média de rodagem que acompanhamos na primeira revisão? Pelos nossos cálculos, você está chegando na marca dos 6.000 km! 🏍️💨
Te chamei com antecedência porque essa 2ª Revisão é super importante por dois motivos: primeiro, ela é obrigatória para mantermos a sua garantia de 3 anos de fábrica ativa.
E segundo: essa é a última revisão em que a mão de obra é 100% um presente da Honda para você!
A nossa janela de tolerância para não perder a garantia vai de 5.400 a 6.600 km. Quantos Km exatos ela está marcando hoje no painel pra eu garantir a sua vaga de cortesia aqui na nossa agenda?`,
    },
    {
      id: "revisao_2_2",
      texto: `Olá, {nome}! Tudo certo? Aqui é a equipe técnica da Caiobá Honda. 🛠️
Estamos vendo aqui no sistema que você e sua moto estão quase completando 1 ano juntos! 🎂 Tempo passa rápido hehe!

Te chamamos para lembrar da sua Revisão de 12 meses (ou 6.000 km). Fazer esse check-up agora é essencial para preservar as peças e carimbar o manual para não perder a sua garantia de 3 anos.
E a melhor notícia: a mão de obra desta revisão de aniversário de 1 ano ainda é totalmente gratuita pela fábrica!
Como temos um prazo rigoroso, que tal já deixarmos o seu box reservado para a semana que vem e deixar a moto novinha para o segundo ano de uso?`,
    },
  ],

  revisao_3: [
    {
      id: "revisao_3_1",
      texto: `Fala, {nome}! Tudo bem? Aqui é o {consultor}, seu consultor de Pós-Vendas da Caiobá Honda.
Acompanhando seu histórico, vi que sua moto está chegando perto dos 12.000 km. Essa é a nossa Revisão de Transição! Eu preciso te dar uma dica de ouro:
Essa 3ª revisão é uma das mais críticas para a vida útil da sua moto.
É nela que fazemos o ajuste fino de válvulas, checagem de freios e fluidos. Fazer esse serviço aqui com nossos especialistas garante que você previna o desgaste de peças caríssimas do motor e, o mais importante, não perca a sua garantia de 3 anos de fábrica.

Vamos agendar o seu horário e manter o carimbo oficial no seu manual para a sua moto continuar super valorizada? Quantos Km ela está marcando hoje?`,
    },
    {
      id: "revisao_3_2",
      texto: `Olá, {nome}! Tudo certo? Aqui é a equipe técnica da Caiobá Honda. 🛠️
Já estamos no 17º mês desde que você realizou o sonho de tirar sua Honda 0km com a gente! Estamos entrando na janela da 3ª Revisão (a de 18 meses).

Te chamei com antecedência por dois motivos urgentes: a partir de agora, a tolerância da fábrica muda para apenas 600 km ou 1 dia útil. Se passar disso, a garantia de 3 anos é cancelada na hora.
Além disso, essa é a manutenção onde checamos os sistemas vitais para a sua segurança no trânsito, como o desgaste das pastilhas e o sistema de direção.
Como essa revisão tem o custo da mão de obra, nós preparamos condições de pagamento facilitadas para você que já é de casa.
Me manda uma foto do seu painel para eu calcular sua tolerância exata e não te deixar perder essa garantia?`,
    },
  ],

  // ciclo: [],   // a preencher
};
