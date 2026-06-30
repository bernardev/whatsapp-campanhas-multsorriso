# 📋 Contexto do Projeto — Handoff para nova sessão / nova máquina

> Documento de transferência de contexto. Leia isto primeiro ao iniciar uma nova sessão
> (inclusive Claude Code no cloud / outro computador). Última atualização: 25/06/2026.

---

## 1. O que é o projeto

**WhatsApp Campanhas — Mult Sorriso** é um sistema de **campanhas e atendimento via WhatsApp**
para a clínica odontológica **Mult Sorriso Curitiba**. Permite disparar mensagens em massa,
atender conversas, gerenciar contatos/leads e — adição mais recente — **agendar avaliações
com lembretes automáticos**.

Envia mensagens por **dois canais**, definidos por instância (`provider`):
- **BAILEYS** → via Evolution API, QR Code (WhatsApp comum, texto livre).
- **CLOUD_API** → Meta WhatsApp Business; exige **template aprovado** para mensagens iniciadas pela clínica.

Instância Cloud API em uso: **`mult-sorriso-curitiba`** ("Mult Sorriso Curitiba (Cloud API)").

---

## 2. Stack

- **Next.js 16** (App Router, React 19, TypeScript, Tailwind 4) — build/dev com `--webpack`.
- **PostgreSQL** (Neon, `sa-east-1`) + **Prisma 5**.
- **Redis** + **BullMQ** (fila de envio + cron) — **worker roda em processo separado**.
- **Cloudinary** (hospedagem de mídia/áudio).
- Auth própria com `jose` (JWT em cookie `auth-token`) + `bcrypt`. Helpers em `lib/auth.ts`.
- **Node 20.x**. Gerenciador: o projeto tem `pnpm-lock.yaml` e `package-lock.json`
  (foi usado npm/pnpm; padronize em `npm`).

---

## 3. Git / acesso

- **Repositório:** `git@github.com-personal:bernardev/whatsapp-campanhas-multsorriso.git`
  - Note o host alias SSH **`github.com-personal`** (config em `~/.ssh/config` apontando para a
    chave da conta pessoal `bernardev`). Na nova máquina, **configure esse alias** ou troque a
    URL do remote para o formato que usar.
- **Branch principal:** `main`. Commits direto na `main`.
- **Autoria dos commits:** `bernardev <ebernardes.dev@gmail.com>`.
  - ⚠️ **Convenção do cliente:** commitar **sem** `Co-Authored-By` (sem assinatura do assistente).
    Só o autor Bernard.
- Mensagens de commit em português, estilo Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).

### Setup na nova máquina
```bash
git clone git@github.com-personal:bernardev/whatsapp-campanhas-multsorriso.git
cd whatsapp-campanhas-multsorriso
npm install            # roda postinstall -> prisma generate
# copiar o .env (NÃO está no git) — ver seção 4
npx prisma generate
npm run dev            # app em http://localhost:3000
npm run worker         # em OUTRO terminal — fila + cron de lembretes
```

---

## 4. Variáveis de ambiente (.env) — **NÃO está no git** (`.gitignore` ignora `.env*`)

O arquivo `.env` precisa ser copiado **manualmente e de forma segura** (não commitar).
Chaves esperadas (valores ficam só no `.env`):

```
DATABASE_URL            # Postgres (Neon)
REDIS_URL               # Redis
NEXTAUTH_URL
NEXTAUTH_SECRET         # segredo do JWT (lib/auth.ts e rotas)
EVOLUTION_API_URL       # Evolution API (ex.: http://31.97.42.88:8082)
EVOLUTION_API_KEY
MESSAGES_PER_MINUTE     # rate limit do worker (default 20)
DELAY_BETWEEN_MESSAGES
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

> Sem `.env` o app e o worker não sobem. Leve o `.env` da máquina antiga (pendrive/gerenciador
> de segredos), não por chat/git.

---

## 5. Estrutura essencial

```
app/
  (dashboard)/
    campanhas/        # dashboard inicial (lista + paginação)
    contatos/         # lista, novo, importar CSV, editar/excluir
    agenda/           # AGENDA (calendário + lembretes) — feature recente
    conversas/ leads/ instancias/ monitoramento/ usuarios/
  api/
    campanhas/ contatos/ agenda/ conversas/ ...
    webhooks/meta/    # callbacks Meta (status delivered/read via wamid)
    webhooks/evolution/
lib/
  prisma.ts redis.ts queue.ts evolution.ts auth.ts cloudinary.ts
  agenda.ts          # helpers de fuso (America/Sao_Paulo) + constantes dos templates
  reminders.ts       # lógica dos lembretes (runVespera / runDia / runDailyReminders)
workers/
  message-worker.ts  # processo do worker (npm run worker); importa reminder-worker
  reminder-worker.ts # fila 'reminders' + cron diário 08:00 (upsertJobScheduler)
prisma/
  schema.prisma + migrations/
scripts/
  backfill-reminder-logs.ts  # one-time: popula logs de lembretes já enviados
```

### Modelos Prisma principais
`User`, `Campaign`, `Contact`, `Message`, `WhatsAppInstance`, `ConversationMessage`,
`ConversationResponse`, `Lead`, **`Appointment`** (agenda), **`ReminderLog`** (log de lembretes).

---

## 6. ⚠️ Gotcha de migrations (IMPORTANTE)

O banco de produção tem **drift**: existem tabelas/colunas legadas que **não estão** no
`schema.prisma` (`contact_groups`, `message_templates`, `quick_replies`, `reports`,
`system_notifications`, coluna `engagementScore`, etc.).

**NÃO rode `prisma migrate dev`** — ele tentaria **DROPAR** tudo isso. Além de ser interativo
(falha em ambiente não interativo).

Para novas migrações, use o fluxo **aditivo manual**:
1. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` para ver o SQL.
2. Copie **apenas a parte aditiva** (CREATE TABLE/TYPE/INDEX/FK) para um arquivo
   `prisma/migrations/<timestamp>_<nome>/migration.sql`.
3. `npx prisma db execute --file <arquivo> --schema prisma/schema.prisma`
4. `npx prisma migrate resolve --applied <timestamp>_<nome>`
5. `npx prisma generate`

(Foi assim que `appointments` e `reminder_logs` foram aplicados.)

---

## 7. Funcionalidade de Agenda + lembretes (a mais recente)

**Página `/agenda`** (link no menu): calendário mensal, painel do dia, modal de agendamento
(paciente, data/hora, profissional, observação), ações confirmar/cancelar/excluir.

**Lembretes automáticos — todo dia 08:00 (fuso America/Sao_Paulo):**
- **Véspera** (consultas de amanhã) → template **`lembrete_24h`** (`{{1}}` nome, `{{2}}` data, `{{3}}` hora).
- **No dia** (consultas de hoje) → template **`confirmacao_consulta`** (`{{1}}` nome, `{{2}}` data, `{{3}}` hora, `{{4}}` profissional).
- Idempotência por carimbos `lembreteVesperaEnviadoEm` / `lembreteDiaEnviadoEm` no `Appointment`.

**Monitoramento:** botão **"Lembretes enviados"** na Agenda → cada tentativa (sucesso/falha)
fica em `ReminderLog`. Tem filtro por situação (Todos/Enviados/Falhas), **filtro por data da
consulta** e lista **agrupada por dia**. GET `/api/agenda/lembretes` (qualquer logado);
POST dispara manual (só ADMIN). Botão "Testar lembretes" (ADMIN) roda na hora.

**O cron vive dentro do `npm run worker`** (`reminder-worker.ts` registra o
`upsertJobScheduler('daily-reminders', '0 8 * * *', tz America/Sao_Paulo)` ao subir).

---

## 8. 🔴 Pendência aberta / risco conhecido (LER)

**O worker de produção precisa rodar SEMPRE e com o código mais novo.**
Em 25/06 o disparo das 8h **não aconteceu** porque o worker em produção estava com a versão
antiga (sem a feature de agenda) → o cron nunca foi registrado (`SCHEDULERS_COUNT=0`).

- Recuperação feita: os 7 lembretes de véspera de 26/06 foram disparados manualmente
  (`runVespera`) e o cron foi registrado no Redis (próximo disparo: 26/06 08:00 SP).
- **Ação ainda necessária:** garantir que, em produção, o worker (`npm run worker`) seja
  **reiniciado a cada deploy** com o código atualizado, rodando de forma persistente
  (PM2/systemd). **Ainda não há `ecosystem.config.js`/PM2 configurado** — é o próximo passo
  sugerido. Sem isso, o risco de o disparo das 8h falhar de novo permanece.

> Para checar se o cron está registrado: criar uma `Queue('reminders')` e chamar
> `getJobSchedulers()` — tem que retornar 1 (pattern `0 8 * * *`).

---

## 9. Histórico recente (últimos commits)

```
ffd041b feat(agenda): filtro por data + lista agrupada por dia em 'Lembretes enviados'  <- ÚLTIMO
39728ce refactor(lembretes): separa runVespera e runDia (reaproveitavel)
eb1200b chore(agenda): script de backfill dos lembretes ja enviados
2074e39 feat(agenda): monitoramento dos lembretes enviados
4eb56a6 feat: agenda de avaliacoes com lembretes automaticos
e6ceb36 feat: paginacao nas campanhas + editar/excluir contatos
c63c91c fix: capturar errors da Meta no callback status=failed
```

**Trabalho desta leva (em ordem):**
1. Paginação na lista de campanhas (antes limitava a 10).
2. Editar/excluir contatos (botões antes eram inertes) — `PATCH/DELETE /api/contatos/[id]`.
3. Agenda de avaliações + lembretes automáticos 8h (véspera + dia).
4. Monitoramento dos lembretes (`ReminderLog`) com painel na Agenda.
5. Filtro por data + agrupamento por dia no painel de monitoramento.

---

## 10. Comandos úteis

```bash
npm run dev        # app (localhost:3000)
npm run worker     # fila + cron de lembretes (PRECISA estar no ar p/ as 8h)
npm run build      # build de produção
npx tsc --noEmit   # type-check (use sempre antes de commitar)
npx tsx scripts/backfill-reminder-logs.ts   # one-time, idempotente
```

**Convenções com o cliente (Bernard):** deploys rápidos; commitar e dar push direto na `main`
após validar com `tsc`; sem `Co-Authored-By`; explicações de uso sempre em PT-BR e em
linguagem simples para a usuária leiga (Franciele).
