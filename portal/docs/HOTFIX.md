# Hotfix / Operação

## Diagnóstico de Conexão com Banco de Dados

Acesse `/api/health/db` para verificar o status da conexão com o banco de dados. Este endpoint retorna:
- Status da conexão
- Host do banco de dados
- Código de erro (se houver)
- Descrição do problema e sugestões de resolução

### Exemplo de resposta com sucesso:
```json
{
  "ok": true,
  "status": "connected",
  "database": { "host": "db.xxx.supabase.co", "configured": true },
  "metrics": { "responseTimeMs": 123, "userCount": 5 }
}
```

### Exemplo de resposta com erro:
```json
{
  "ok": false,
  "status": "error",
  "code": "ECONNREFUSED",
  "message": "connect ECONNREFUSED",
  "description": "Database connection refused. Check if the database server is running."
}
```

## DATABASE_URL no Vercel

⚠️ **IMPORTANTE**: Configure `DATABASE_URL` em **TODOS os ambientes** no Vercel:

1. Vá para o painel do projeto Vercel
2. Settings > Environment Variables
3. Adicione `DATABASE_URL` com sua connection string
4. Selecione **Production**, **Preview** E **Development**
5. Salve e faça redeploy

## Formato da CONNECTION STRING

### Formato básico:
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

### Para Supabase (conexão direta):
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require
```

### Para Supabase (pooler - Transaction mode):
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Para Neon:
```
postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## SSL/TLS com Supabase (pooler)

Por padrão, o sistema usa `sslmode=require` para bancos Supabase e Neon.

### Se tiver erro de certificado SSL:

**Opção 1** - Compatibilidade libpq (para Supabase Pooler em Transaction mode):
```env
PG_USE_LIBPQ_COMPAT=true
```

**Opção 2** - Forçar modo SSL específico:
```env
PG_SSL_MODE=require
```

**Opção 3** - Fallback emergencial (último recurso, NÃO recomendado em produção):
```env
PG_SSL_REJECT_UNAUTHORIZED=false
```

## Códigos de Erro Comuns

| Código | Problema | Solução |
|--------|----------|---------|
| ECONNREFUSED | Conexão recusada | Verifique host/porta e se o banco está online |
| ENOTFOUND | Host não encontrado | Verifique o hostname na DATABASE_URL |
| ETIMEDOUT | Timeout | Banco pode estar lento ou inacessível |
| P1000 | Autenticação falhou | Verifique usuário/senha na DATABASE_URL |
| P1001 | Não consegue alcançar o banco | Verifique host e porta |
| P1003 | Banco não existe | Verifique o nome do banco na URL |
| P1011 | Erro de conexão TLS | Tente `PG_SSL_REJECT_UNAUTHORIZED=false` |
| P2021 | Tabela não existe | Execute `prisma migrate deploy` |

## Executando Migrations

Após configurar DATABASE_URL, execute as migrations:

```bash
# No ambiente local (com .env configurado)
npx prisma migrate deploy

# Ou via Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy
```

## Criando Super Admin

Após as migrations, crie o super admin via API:

```bash
# Via script (com variáveis de ambiente configuradas)
node scripts/seed-remote.mjs https://seu-app.vercel.app SEU_SETUP_SECRET

# Ou configure no Vercel:
# ADMIN_SEED_EMAIL=seu-email@exemplo.com
# ADMIN_SEED_PASSWORD=SuaSenhaSegura123!
# SETUP_SECRET=seu-secret-aqui
```
