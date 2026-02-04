# Hotfix / Operação

## DATABASE_URL no Vercel

Defina `DATABASE_URL` nos ambientes **Production**, **Preview** e **Development** do projeto no Vercel e faça o redeploy para aplicar as migrations e permitir que o Prisma conecte corretamente.

## SSL/TLS com Supabase (pooler)

Recomendação padrão: adicione `sslmode=verify-full` no `DATABASE_URL` do Postgres.

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=verify-full
```

Compatibilidade libpq (quando exigido pelo pooler):

```
PG_USE_LIBPQ_COMPAT=true
```

Fallback emergencial (último recurso): permitir certificados inválidos **apenas** quando necessário. Isso reduz a segurança e deve ser usado temporariamente.

```
PG_SSL_REJECT_UNAUTHORIZED=false
```
