# Plano Operacional – Codex (10 Comandos)

> Documento de referência para a evolução do ClickPro com WhatsApp + OpenAI.

## 1) Configurar Banco e Estrutura Inicial
- Criar modelos e migrations:
  - `User`
  - `Client`
  - `ClientMember`
  - `Contact`
  - `Campaign`
  - `Message`
  - `Template`
  - `WebhookEvent`
  - `OptOut`
  - `OpenAiCredential`
  - `WhatsappCredential`

## 2) Implementar Autenticação e Painel Multiusuário
- Criar rotas e páginas:
  - Login seguro
  - Dashboard por cliente
  - Isolamento de dados por sessão
- Middleware de autenticação com JWT ou NextAuth com RBAC:
  - `SUPER_ADMIN`
  - `CLIENT_ADMIN`
  - `CLIENT_USER`

## 3) Cadastrar e Validar Credenciais (Meta + OpenAI)
- Front-end: formulários para cadastrar credenciais.
- Back-end: validação com chamadas de teste:
  - Meta: `GET /phone_numbers`
  - OpenAI: `GET /models`
- Salvar credenciais com criptografia.

## 4) Sistema de Templates de Mensagem (Meta)
- Painel para criação de templates (texto, mídia).
- Integração com Graph API para submissão.
- Salvamento e status inicial no banco.

## 5) Webhook da Meta (Mensagens e Status)
- Criar endpoint público HTTPS `/webhook` com verificação de token.
- Armazenar mensagens recebidas e eventos de status (entregue/lido).
- Associar eventos ao cliente correto.

## 6) Verificação de Status de Templates
- Agendar verificação periódica dos templates enviados.
- Atualizar status no banco: `APPROVED`, `REJECTED`, etc.
- Notificar cliente no painel.

## 7) Upload de Contatos e Pré-processamento
- Implementar parser CSV/Excel com validação de telefone.
- Salvar contatos no banco com vinculação a campanhas.
- Eliminar duplicados automaticamente.

## 8) Campanhas e Agendador com Rate Limit
- Criar fluxo para campanha:
  - Selecionar template
  - Selecionar contatos
  - Configurar lote/envio
- Criar worker com fila para processar envios em intervalos definidos.
- Suporte a pausa/cancelamento em tempo real.

## 9) Responder com IA (OpenAI)
- No webhook de mensagem recebida, consultar `assistant_id` e chave do cliente.
- Enviar prompt com contexto recente.
- Responder via WhatsApp API se IA ativada e registrar no histórico.

## 10) Painel de Conversas ao Vivo + Histórico
- Construir front-end tipo inbox com mensagens agrupadas por contato.
- Suporte a busca, filtragem e envio manual com fallback.
- Mostrar se resposta foi da IA ou humana, com timestamps e status.
