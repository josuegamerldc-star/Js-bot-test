const { Client, GatewayIntentBits, Partials } = require("discord.js");
const axios = require("axios");
const fetch = require("node-fetch");

const TOKEN = process.env.TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;
const GROQ_KEY = process.env.GROQ_KEY;
const ADMIN_ID = process.env.ADMIN_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});


// =====================
// SISTEMAS
// =====================

let activeChats = new Map(); // userId -> true
let chatMemory = new Map(); // userId -> mensagens IA


client.on("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
});


// =====================
// GITHUB
// =====================

async function updateGist(texto) {
  await axios.patch(
    `https://api.github.com/gists/${GIST_ID}`,
    {
      files: {
        "mensagem.txt": {
          content: texto
        }
      }
    },
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`
      }
    }
  );
}


// =====================
// IA COM MEMORIA
// =====================

async function aiChat(userId, texto) {

  if (!chatMemory.has(userId)) {
    chatMemory.set(userId, []);
  }

  const history = chatMemory.get(userId);

  history.push({ role: "user", content: texto });

  const messages = [
    {
      role: "system",
      content: `
Você é Js Studios BOT.

INFORMAÇÕES:

- Você é uma inteligência artificial de suporte.
- Você pertence ao servidor Js Studios Productions.
- Seu objetivo é ajudar as pessoas do servidor.
- Você é formal.
- Não usa emojis.
- Não demonstra emoções.
- Não faz piadas.
- Não fala sobre amizade.
- Não fala coisas pessoais.
- Não inventa informações.
- Não pede para mencionar administradores.

Se perguntarem seu propósito:
Responda: ajudar as pessoas do servidor.

TRANSFERÊNCIA:

Se o usuário pedir administrador, suporte humano, moderador ou ajuda real,
no FINAL da resposta escreva: [TRANSFERIR]

Caso contrário, nunca escreva isso.
`
    },
    ...history
  ];

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages
      })
    }
  );

  const data = await res.json();

  let reply = data.choices[0].message.content;

  history.push({ role: "assistant", content: reply });

  // Limitar memória
  if (history.length > 20) history.shift();

  return reply;
}


// =====================
// MENSAGEM
// =====================

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channel.type !== 1) return;

  const content = message.content;
  const userId = message.author.id;


  // =====================
  // ADMIN /close
  // =====================

  if (message.author.id === ADMIN_ID && content === "/close") {

    const currentUser = [...activeChats.keys()][0];

    if (!currentUser) {
      return message.reply("Nenhum atendimento ativo.");
    }

    const user = await client.users.fetch(currentUser);

    await user.send("Atendimento encerrado.");

    activeChats.delete(currentUser);
    chatMemory.delete(currentUser);

    return message.reply("Atendimento fechado.");
  }


  // =====================
  // ADMIN RESPONDE
  // =====================

  if (message.author.id === ADMIN_ID && content.startsWith("/ms ")) {

    const texto = content.slice(4);

    const currentUser = [...activeChats.keys()][0];

    if (!currentUser) {
      return message.reply("Nenhum usuario em atendimento.");
    }

    const user = await client.users.fetch(currentUser);

    await user.send(texto);

    return;
  }


  // =====================
  // USUARIO EM CHAT COM ADMIN
  // =====================

  if (activeChats.has(userId)) {

    const admin = await client.users.fetch(ADMIN_ID);

    await admin.send(content);

    return;
  }


  // =====================
  // COMANDO /set
  // =====================

  if (content.startsWith("/set ")) {

    const texto = content.slice(5);

    await message.reply(
      "Pedido feito, seu texto aparecera em breve."
    );

    try {

      await updateGist(texto);

      setTimeout(() => {
        message.reply("Texto alterado com sucesso.");
      }, 4000);

    } catch {

      await message.reply("Erro ao alterar texto.");

    }

    return;
  }


  // =====================
  // IA
  // =====================

  const reply = await aiChat(userId, content);

  const transfer = reply.includes("[TRANSFERIR]");
  const clean = reply.replace("[TRANSFERIR]", "");

  await message.reply(clean);


  // =====================
  // TRANSFERIR
  // =====================

  if (transfer) {

    activeChats.set(userId, true);

    const admin = await client.users.fetch(ADMIN_ID);

    await message.reply(
      "Vou transferir você para o ADMINISTRADOR. A partir de agora você está falando com o administrador. Para enviar uma mensagem, comece com /ms"
    );

    await admin.send(
      `-----a partir de agora você está em um CHAT com ${message.author.tag}-----`
    );

  }

});


client.login(TOKEN);