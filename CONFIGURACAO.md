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
