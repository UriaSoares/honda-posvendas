# Mapa de Peças — desenho

> Portal de oportunidades do setor de peças, dentro do honda-posvendas.
> Rascunho de 23/10/2026, a partir de quatro relatórios da API Microwork já testados.

## O que é

Os painéis que a Caiobá tem hoje mostram **o que aconteceu**. O Mapa de Peças mostra
**o que fazer agora**: uma fila de oportunidades com valor em reais, ação sugerida e
dono, montada todo dia a partir do estoque e do faturamento.

A diferença não é cosmética. Oportunidade é perecível — os R$ 37.981 de excesso que
achamos na curva A em setembro já são outro número hoje. Relatório fotografa; fila cobra.

## Os quatro relatórios

Todos no mesmo `postRelatorio()` de `lib/microwork.ts`. Testados em 23/10/2026 com
`listaempresas: [2,13,4,8,9]`.

| Relatório | ids | Volume | Tempo | Para quê |
|---|---|---|---|---|
| Mercadoria obsoleta | 148 / 59 / 148 / **963** | 4.799 linhas · 3,1 MB | ~65 s | estoque parado, custo, saldo, dias parado, tributação |
| Vendas por código | 138 / 55 / 138 / **973** | 670 linhas/semana | 2,6 s | giro, curva ABC/XYZ, margem e desconto por item |
| Item por cliente | 133 / 61 / 133 / **970** | 1.037 linhas/semana | 4,4 s | cesta de compra, margem por vendedor × cliente |
| Vendas por cliente | 133 / 61 / 133 / **974** | 396 linhas/semana | 1,4 s | documento, município, forma de recebimento |

O leiaute **839**, que `lib/pecas.ts` já usa, continua servindo o histórico de compra do
cliente — tem `cpfoucnpj` e `doctofiscal`, que o 970 não traz.

### O 973 resolve o problema da descrição

Durante toda a análise de setembro e outubro, a maior dificuldade foi que os CSV
exportados **não trazem descrição da peça**. Os kits Hamp apareciam como "(sem
descrição)" e o Uriá teve que nomear à mão.

O leiaute 973 traz `descricaomercadoria` preenchida, inclusive para os Hamp:
`H0620KRM900 → KIT EMBREAGEM CG150`, `H0621KRM900 → KIT JUNTAS MOTOR`.

Ele também já devolve `curvaabc` e `curvaxyz` por item, o que torna o relatório
separado de curva ABC desnecessário.

### O que o 974 abre

`financeiroformarecebimento` vem preenchido: na semana de 16 a 23/10 foram 209
adiantamentos, 144 boletos em até 5x, 25 cartões. É a base da análise de risco de
crédito, sem depender de relatório novo.

### Transferência entre lojas já existe

O 973 mostra 78 lançamentos de `SAÍDA TRANSFERÊNCIA DE SALDO` na semana, todos em TEM,
a valor zero. A operação de transferir saldo entre as lojas já roda. Isso muda a
conversa sobre viabilidade tributária, que fica para outro momento.

## Camada de dados (Redis)

Segue o padrão de `lib/pecas.ts`: sharding por chave, nada de base externa.

| Chave | Conteúdo | Origem | Frequência |
|---|---|---|---|
| `pecas:estoque:{0..9}` | snapshot do obsoleto, fatiado | 148/59 | diário |
| `pecas:venda:{AAAA-SS}` | vendas da semana por código | 138/55 | diário, janela de 7 dias |
| `pecas:cliente:{0..9}` | item × cliente, 90 dias | 133/61 (970) | diário |
| `pecas:oportunidades` | a fila calculada | derivado | diário |
| `pecas:decisoes` | aceites e descartes, com quem e quando | usuário | ao vivo |
| `pecas:meta` | última sync, contagens, erros | — | diário |

O volume é pequeno: 670 linhas por semana no 973 dá ~35 mil no ano.

`pecas:decisoes` é a chave que mais importa no médio prazo — é o que ensina quais
regras acertam.

## Detectores

**Primeira onda — só com o que a API já dá hoje**

1. **Parada com demanda recente** — obsoleta, mas com última saída nos últimos 6 meses.
   Já medido: 62 códigos, R$ 11.374 de lucro potencial.
2. **Margem fora da faixa** — `lucropercentual` do item contra a faixa de referência.
   Monitorar margem, nunca desconto: o desconto varia por coeficiente irregular.
3. **Dispersão de preço** — mesmo código com preços muito diferentes na semana.

**Segunda onda — depois de 60 a 90 dias acumulando histórico**

4. **Obsolescência prevista** — velocidade caindo há meses. Agir aos 6 meses de
   cobertura custa ~20% de desconto; aos 24 meses, ~45%. É o de maior retorno.
5. **Ruptura prevista** — cobertura abaixo do prazo de reposição.
6. **Cliente parado e cliente que encolheu**.
7. **Cesta de compra** — do 970. Na semana testada, 113 clientes compraram 3 itens ou
   mais, que é base suficiente para afinidade.

**Terceira onda** — concentração e risco de crédito, com a forma de recebimento do 974.

## Telas

**`/pecas` — Oportunidades.** A fila. Card por oportunidade: peça, loja, tipo, R$ em
jogo, ação sugerida, localização no estoque. Filtro por loja e tipo. Aceitar ou
descartar — o descarte é dado, não desistência.

**`/pecas/ficha` — Ficha da peça.** Código → descrição, aplicação pelo catálogo,
estoque nas duas lojas, giro, margem praticada, última saída. É o que o balcão mais vai
usar e não depende do resto ficar pronto.

**`/pecas/gestao` — Resumo.** Capital parado, margem do mês, cobertura média,
oportunidades abertas e o que foi feito com as de ontem.

## Restrições técnicas conhecidas

- **Timeout.** `app/api/cron/pecas/route.ts` tem `maxDuration = 60`; o relatório de
  obsoletos levou ~65 s. Partir a chamada por loja é mais seguro que subir o limite —
  e diz qual das duas falhou.
- **Cloudflare.** A API rejeita cliente HTTP genérico com `error code: 1010`. O `fetch`
  do Next passa; `urllib` do Python não. Script de apoio tem que usar curl.
- **`ALL_EMPRESAS` tem 11 ids** em `lib/microwork.ts`; o correto para peças é
  `[2,13,4,8,9]`. A constante é compartilhada com agendamentos, apontamentos e O.S. do
  Mapa da Qualidade — conferir antes de trocar.
- **Decimais inconsistentes.** No obsoleto, `saldodisponivel` vem como texto
  (`"1,0000"`) enquanto `customedio` vem number. Normalizar na entrada.

## Ordem de construção

1. Coleta dos quatro relatórios em Redis, sem tela. Começa a acumular histórico já.
2. Ficha da peça — usa só o que a coleta traz e tem valor imediato no balcão.
3. Fila de oportunidades com os três primeiros detectores.
4. Resumo da gestão.
5. Segunda onda de detectores, quando houver histórico.

## Em aberto

- Perfil de acesso: quem vê a fila, quem aceita, quem só olha.
- Catálogo de peças (descrição, modelo, ano, bloco) roda em projeto paralelo e por
  partes; hoje há ~20 mil códigos indexados de CG, Biz e Bros.
- Viabilidade tributária da transferência, com a contabilidade.
