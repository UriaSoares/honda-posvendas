# HANDOFF — Mapa da Qualidade (honda-posvendas)

> Resumo do estado do projeto para retomada em outra sessão/ferramenta.
> Última atualização: sessão de desenvolvimento com Claude Code, projeto no ar em produção.

## O que é o projeto

**Mapa da Qualidade** — portal interno de pós-vendas da **Caiobá Honda** (concessionária,
lojas de **Campo Grande — CGR** e **Barretos — TEM**). Conecta a equipe de agendamento/
qualidade da oficina ao cliente via WhatsApp, com dados reais do ERP **Microwork** e
planilhas do **Google Sheets** como fonte de preços/manutenção.

- **Repositório:** `/Users/uriasoares/Projetos/honda-posvendas` (GitHub: `UriaSoares/honda-posvendas`, branch `main`)
- **Produção:** `https://honda-posvendas.vercel.app` (Vercel, auto-deploy no push pra `main`)
- **Stack:** Next.js 16 (App Router, Turbopack) + TypeScript + Upstash Redis (KV) + JWT (`jose`) + bcryptjs
- **⚠️ Ler `AGENTS.md` na raiz do repo antes de mexer** — avisa que esta versão do Next.js tem
  breaking changes vs. o conhecimento de treinamento; consultar `node_modules/next/dist/docs/`.

---

## Arquitetura de dados (visão rápida)

| Fonte | O quê | Onde no código |
|---|---|---|
| Microwork API (POST único, `idrelatorioconfiguracao` diferente por relatório) | Agendamentos, Apontamentos, Ordens de Serviço | `lib/microwork.ts` (mappers de snake_case→PascalCase) |
| Google Sheets (CSV publicado) | Preços de revisão (por loja!), Óleo, Extras, Transparência (peças) | `lib/manutencao.ts` + `lib/manutencao-model.ts`, sync em `/api/manutencao/sync` |
| Redis (Upstash) | Usuários, sessões, WhatsApp (contatos/threads), config do telão, promoções | `lib/auth/users.ts`, `lib/whatsapp-store.ts`, `lib/display-config.ts`, `lib/promo.ts` |
| Meta Cloud API (WhatsApp) | Envio/recebimento de mensagens | `lib/whatsapp.ts` (cliente), `app/api/whatsapp/*` (rotas) |

---

## O que está pronto e funcionando em produção

### Painéis operacionais
- **Hoje / Amanhã / Oficina ao vivo** — `components/{Hoje,Amanha,Oficina}Panel.tsx`, dados reais do Microwork, filtrados por loja e por data (fuso `America/Campo_Grande`)
- KPIs calibrados com o vocabulário real do ERP: `BAIXADO`=sucesso, `ABERTO`=aguardando, `REAGENDADO`, `NÃO COMPARECEU`+`CANCELADO`=perda

### Manutenção / Preços (`ADM → 🔧 Manutenção`)
- Sync manual (botão "Sincronizar agora") puxa 6 abas do Sheets: Preços CGR, Preços BAR, Manutenção, Óleo, Extras, Transparência
- **Preços de revisão são POR LOJA** (`ManutencaoData.precos: { CGR: [...], BAR: [...] }`) — CGR e Barretos têm planilhas separadas
- `lib/manutencao-model.ts` tem as funções puras: `precoRevisao()`, `precoOleo()`, `totalExtras()`, de-para `modeloManut()` (ex.: CG 160 Cargo/Fan → "CG 160" pra óleo/manutenção)
- **Cuidado:** `getManutencao()` já tem uma blindagem pra cache antigo (formato pré-loja) — se o formato do Sheets mudar de novo, checar essa função

### Aba Conversas (`components/ConversasPanel.tsx`)
- Layout CRM: inbox (esquerda) · chat (centro) · playbook (direita)
- Playbook mostra **todas as opções de script** por fase/objeção (não só uma), puxadas de `lib/roteiro-scripts.ts` (roteiro completo: Boas-vindas, Coffee Break, 1ª/2ª/3ª Revisão, Ciclo, objeções, FAQ)
- `lib/playbook.ts` — motor de decisão (fase/objeção → script recomendado), "automação fake" por etiqueta manual (sem integração com Microwork ainda — é um passo futuro)
- Preço de revisão calculado automaticamente conforme moto + fase + loja ativa

### Telão de recepção (`/display`, rota pública)
- Landing com 2 botões (Recepção Campo Grande / Recepção Barretos)
- Trava por **PIN de 4 dígitos** (editável em `ADM → 📺 Telão`), com teclado numérico na tela
- Agenda centrada em **±2h** do horário atual (não a lista do dia inteiro)
- Slides: Agenda · Técnicos · Promoção (imagem, até 4 slots com rotação semanal automática) · Nossa Equipe (organograma) · Informações (horários/contatos/WhatsApp/site) · Tabela de Preços (Transparência, rolagem automática + QR code)
- `lib/display-config.ts` guarda tudo num blob único no Redis (`pos:display:config`)

### Hierarquia de usuários (`lib/auth/users.ts`, `ADM → 👥 Usuários`)
- 3 perfis: **admin** (você, Uriá) · **gestao** (Deyvid) · **qualidade** (Natalia/Thais)
- Campo `lojas: ("CGR"|"TEM")[]` no usuário — só relevante pra `qualidade` (admin/gestao sempre têm as duas, via `userLojas()`)
- **Gestão só pode convidar usuários Qualidade** — todas as outras ações (editar, ativar/desativar, resetar senha) são **exclusivas do Admin**
- Edição completa pelo Admin: nome, e-mail (com migração segura de chave no Redis via `renameUserEmail()`), perfil, status, WhatsApp, lojas
- Aba **Scripts** foi **removida da navegação** pra todo mundo (o conteúdo virou o playbook da aba Conversas)

### Login (`app/login/page.tsx`)
- Redesenhado com identidade "Collaboration" (fontes Mulish/Saira, só nessa página — resto do app usa Manrope)
- **Captcha Cloudflare Turnstile ativo** — `lib/turnstile.ts` valida server-side; widget só aparece se `NEXT_PUBLIC_TURNSTILE_SITE_KEY` existir (fail-open seguro se a chave não estiver configurada)

---

## 🟡 EM ANDAMENTO — WhatsApp real (saindo do modo de teste)

Isso é o que estava sendo trabalhado por último. Contexto: WhatsApp em modo **Coexistência**
(cada atendente mantém o WhatsApp Business no próprio celular; o sistema espelha via Cloud API).

### Checklist da burocracia Meta

| Item | Status |
|---|---|
| Verificação do Negócio (CAIOBA MOTOCICLETAS E PECAS LTDA) | ✅ Feita desde 2021 |
| App Review — Advanced Access (`whatsapp_business_management`, `whatsapp_business_messaging`) | ⏳ **Enviado, aguardando aprovação da Meta** (pode levar dias) |
| Token permanente (System User) | 🔴 **Travado** — pedindo aprovação de um segundo administrador do Business Manager (ver "Próximos passos" abaixo) |
| Templates dos scripts aprovados | 🔲 Não iniciado — precisa dos templates aprovados pra enviar fora da janela de 24h |
| Embedded Signup real (Coexistência) no código | 🔲 Não iniciado — hoje é só um placeholder |

### O que já foi testado e funciona (com número de TESTE da Meta)
- Webhook configurado e validado (`/api/whatsapp/webhook`, verify token `caioba-verify-2026`)
- Envio e recebimento de mensagem reais confirmados de ponta a ponta (usando o número de teste
  `+1 555 182 9624`, Phone Number ID `1247057171818503`, WABA `2473546823129268`)
- Vínculo atendente↔número funcional (`lib/whatsapp-store.ts`, `pos:wa:*` no Redis)

### ⚠️ Pegadinhas descobertas nesse processo (não repetir os mesmos erros)
1. **Token temporário da Meta expira em 24h** — é por isso que o token permanente (System User) é necessário antes de usar em produção de verdade
2. **Cada WABA tem seus próprios templates e números** — o app tem mais de um WABA; um deles estava vazio (sem números, sem templates). Sempre confirmar com `debug_token` (`graph.facebook.com/debug_token`) a quais `target_ids` (WABA) o token realmente tem acesso antes de tentar enviar
3. **Número precisa ser "registrado"** na Cloud API (`POST /{phone_number_id}/register` com um PIN) antes de poder enviar/receber, mesmo sendo número de teste
4. **Números brasileiros têm o problema do 9º dígito** — o `wa_id` que chega no webhook pode vir sem o 9 extra, mesmo que o número de teste tenha sido cadastrado com o 9. Pode ser necessário cadastrar as duas variações como destinatário de teste
5. **Atribuir permissão a um Usuário do Sistema no Business Manager exige ligar o toggle de permissão** (não só marcar o checkbox do ativo) — bug de UI recorrente que confundiu bastante

### Próximos passos concretos
1. **Resolver a aprovação pendente do token permanente** — outro admin do Business Manager
   precisa aprovar via sininho de notificações ou Configurações do negócio → Segurança
2. Quando o App Review for aprovado: sair do modo de teste (limite de 5 destinatários)
3. Aprovar os templates de `lib/roteiro-scripts.ts` no WhatsApp Manager
4. Trocar o placeholder do botão "Conectar via Embedded Signup" (`components/WhatsAppConnect.tsx`)
   pelo fluxo real do SDK da Meta
5. Trocar `WHATSAPP_SYSTEM_TOKEN` no Vercel pelo token permanente assim que gerado

---

## Variáveis de ambiente (Vercel)

```
KV_REST_API_URL / KV_REST_API_TOKEN     — Redis (Upstash), compartilhado com honda-consorcio (prefixo pos: separa os dados)
JWT_SECRET                              — assinatura da sessão
MICROWORK_TOKEN                         — Bearer da API do ERP

SHEET_PRECOS_CGR_URL / SHEET_PRECOS_BAR_URL / SHEET_MANUT_URL / SHEET_OLEO_URL / SHEET_EXTRAS_URL / SHEET_TRANSP_URL
                                         — CSVs publicados do Google Sheets (têm default hardcoded no código, essas envs só sobrepõem)

META_APP_SECRET                         — valida assinatura do webhook do WhatsApp
META_GRAPH_VERSION                      — default "v25.0" se não setado
WHATSAPP_SYSTEM_TOKEN                   — token da Cloud API (⚠️ hoje é temporário, expira em 24h)
WHATSAPP_VERIFY_TOKEN                   — "caioba-verify-2026", usado no handshake do webhook

NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY — captcha do login
```

---

## Convenções importantes

- **CGR = Campo Grande, TEM = Barretos** — é assim que o campo `Empresa` chega do Microwork.
  A aba de preços usa `"BAR"` em vez de `"TEM"` internamente (`lib/manutencao-model.ts`) —
  cuidado com essa inconsistência de nomenclatura entre módulos.
- Sempre rodar `npx tsc --noEmit` e `npm run build` antes de commitar — o preview visual local
  não funciona bem nesta máquina (ambiente de preview fica preso a outro projeto), então a
  validação de tipo/build é a rede de segurança principal.
- Commits vão direto pra `main` e o Vercel faz deploy automático — não há branch de staging.
- Nunca usar `git push --force`, nunca commitar sem pedir (regra geral já em vigor).

## Onde encontrar o quê

- Plano original do WhatsApp Coexistência (mais detalhado que este resumo): `~/.claude/plans/magical-enchanting-platypus.md`
- Roteiro completo de scripts: `lib/roteiro-scripts.ts`
- Modelo de manutenção/preços: `lib/manutencao-model.ts` (puro) + `lib/manutencao.ts` (parsing/sync/Redis)
