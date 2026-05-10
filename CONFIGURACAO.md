# Configuração do site

## Música de fundo

1. Coloque a música dentro da pasta `assets`.
2. Renomeie o arquivo para `musica.mp3`.
3. O botão `Ativar música` passa a tocar esse arquivo.

Os navegadores só permitem iniciar a música depois de um clique do visitante. Por isso o site mantém o botão de ativar/mutar.

## Telegram para solicitação de orçamento

No Vercel, configure estas variáveis de ambiente:

```txt
TELEGRAM_BOT_TOKEN=token_do_bot
TELEGRAM_CHAT_ID=id_do_chat
```

Como conseguir:

1. Crie um bot no Telegram pelo `@BotFather`.
2. Copie o token do bot.
3. Envie uma mensagem para o bot.
4. Consulte o `chat_id` usando a API do Telegram ou um bot auxiliar de ID.
5. No Vercel, abra o projeto, entre em `Settings`, depois `Environment Variables`.
6. Cadastre `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`.
7. Faça um novo deploy.

Depois disso, cada solicitação de orçamento enviada pelo site gera uma mensagem no Telegram com nome, WhatsApp, evento, data, período, cidade, duração e observações.

## Agenda online (Supabase)

O front-end obtém URL e chave anon pela rota `/api/public-config` (variáveis de ambiente no Vercel), para não versionar segredos no repositório. Cadastre:

```txt
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=sua_chave_anon_publicavel
```

Opcional: `SUPABASE_TABLE` (padrão `agenda_events`).

Mantenha políticas RLS no Supabase alinhadas ao uso público da chave anon.

## Painel administrativo

A senha do painel não fica mais no JavaScript. Configure no Vercel:

```txt
ADMIN_PASSWORD=sua_senha_forte
```

Sem essa variável, o login administrativo retorna erro de configuração.
