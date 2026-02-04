# Hotfix P2022 clientId

Este hotfix adiciona a coluna `clientId` na tabela `Client` para eliminar o erro Prisma P2022 durante o signup e garante índice único compatível com Postgres/Neon.

## Aplicação Automática (Recomendado)

Este hotfix é aplicado **automaticamente em produção** no `npm start` via `prisma migrate deploy`.

A migration roda uma vez por deploy e alinha o schema do banco automaticamente. Isso elimina o erro P2022 antes do app iniciar, sem necessidade de intervenção manual.

## Fallback: SQL Direto

Caso prefira executar manualmente no banco (sem usar `prisma migrate`), execute:

```sql
\i docs/HOTFIX_P2022_CLIENTID.sql
```

**Nota:** A migration **não** cria tabelas a cada cliente novo. Ela apenas sincroniza o schema do banco uma vez por deploy.
