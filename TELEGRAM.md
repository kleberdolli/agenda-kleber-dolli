# Notificação de orçamento pelo Telegram

O formulário de orçamento já chama a função `api/notify-telegram.js`.

Para ativar no Vercel:

## 1. Criar o bot

1. Abra o Telegram.
2. Procure por `@BotFather`.
3. Envie `/newbot`.
4. Escolha o nome do bot.
5. Copie o token gerado.

## 2. Descobrir o chat ID

Opção simples:

1. Envie uma mensagem qualquer para o bot criado.
2. Abra no navegador:

```txt
https://api.telegram.org/botSEU_TOKEN/getUpdates
```

3. Procure pelo campo `chat` e copie o valor de `id`.

## 3. Configurar no Vercel

No projeto do Vercel:

1. Entre em `Settings`.
2. Entre em `Environment Variables`.
3. Adicione:

```txt
TELEGRAM_BOT_TOKEN=token_do_bot
TELEGRAM_CHAT_ID=id_do_chat
```

4. Faça um novo deploy.

## 4. O que será enviado

Quando alguém preencher a solicitação de orçamento, o Telegram recebe:

- nome;
- WhatsApp;
- tipo de evento;
- data;
- período;
- cidade;
- duração;
- observações.

O token do Telegram nunca deve ficar dentro do `index.html` ou do `script.js`. Ele deve ficar somente nas variáveis de ambiente do Vercel.
