# Hotfix P2022 clientId

Este hotfix adiciona a coluna `clientId` na tabela `Client` para eliminar o erro Prisma P2022 durante o signup e garante índice único compatível com Postgres/Neon.

Este hotfix agora é aplicado automaticamente em produção no `npm start` via `prisma migrate deploy`.

SQL direto (caso prefira executar manualmente no banco, sem `prisma migrate`):
```
\i docs/HOTFIX_P2022_CLIENTID.sql
```
