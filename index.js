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


// =============================
// SISTEMA DE CHAT
// =============================

// Usuário atualmente em atendimento humano
let currentUserId = null;

// Memória da IA por usuário
let chatMemory = new Map();

// Controle para oferecer atendimento humano pelo menos 1x
let offeredHuman = new Set();


client.on("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
});


// =============================
// ATUALIZAR GITHUB GIST
// =============================

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


// =============================
// IA COM MEMÓRIA
// =============================

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

INFORMAÇÕES IMPORTANTES:

- Você é uma inteligência artificial de suporte.
- Você pertence a um servidor do Discord.
- O servidor pertence a um grupo do Roblox chamado Js Studios Productions.
- O grupo produz jogos no Roblox.
- Seu objetivo é auxiliar jogadores.

COMPORTAMENTO:

- Seja formal.
- Não use emojis.
- Não demonstre emoções.
- Não faça piadas.
- Não fale sobre amizade.
- Não invente informações.
- Não fale coisas pessoais.
- Não peça para mencionar administradores.

PROPÓSITO:

Se perguntarem seu propósito:
Responda: ajudar os jogadores do servidor.

TRANSFERÊNCIA:

Se o usuário pedir administrador, humano, suporte humano ou algo do tipo,
no FINAL escreva: [TRANSFERIR]

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

  // limitar memória
  if (history.length > 20) history.shift();

  return reply;
}


// =============================
// EVENTO MENSAGEM
// =============================

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channel.type !== 1) return;

  const content = message.content;
  const userId = message.author.id;


  // =============================
  // ADMIN COMANDOS
  // =============================

  if (userId === ADMIN_ID) {

    // ADMIN RESPONDER USUARIO
    if (content.startsWith("/ms ")) {

      if (!currentUserId) {
        return message.reply("Nenhum usuario em atendimento.");
      }

      const texto = content.slice(4);

      const user = await client.users.fetch(currentUserId);

      await user.send(texto);

      return;
    }

    // ADMIN ENCERRAR
    if (content === "/close") {

      if (!currentUserId) {
        return message.reply("Nenhum atendimento ativo.");
      }

      const user = await client.users.fetch(currentUserId);

      await user.send("Atendimento encerrado.");

      chatMemory.delete(currentUserId);
      offeredHuman.delete(currentUserId);
      currentUserId = null;

      return message.reply("Atendimento fechado.");
    }

    // IMPORTANTE:
    // Admin não passa pela IA
    return;
  }


  // =============================
  // USUARIO FALANDO COM ADMIN
  // =============================

  if (currentUserId === userId) {

    const admin = await client.users.fetch(ADMIN_ID);

    await admin.send(content);

    return;
  }


  // =============================
  // COMANDO /set
  // =============================

  if (content.startsWith("/set ")) {

    const texto = content.slice(5);

    await message.reply(
      "Pedido feito, seu texto aparecera em breve."
    );

    try {

      await updateGist(texto);

      setTimeout(() => {
        message.reply("Texto apareceu com sucesso.");
      }, 4000);

    } catch {

      await message.reply("Erro ao alterar texto.");

    }

    return;
  }


  // =============================
  // IA RESPONDENDO
  // =============================

  const aiReply = await aiChat(userId, content);

  const transfer = aiReply.includes("[TRANSFERIR]");
  let clean = aiReply.replace("[TRANSFERIR]", "");


  // Oferecer atendimento humano pelo menos uma vez
  if (!offeredHuman.has(userId)) {

    clean +=
      "\n\nVocê quer que eu te transfira para o atendimento humano?";

    offeredHuman.add(userId);
  }


  await message.reply(clean);


  // =============================
  // TRANSFERIR PARA ADMIN
  // =============================

  if (transfer) {

    currentUserId = userId;

    const admin = await client.users.fetch(ADMIN_ID);

    await message.reply(
      "Vou transferir você para o ADMINISTRADOR. A partir de agora você esta falando com o administrador. Para enviar uma mensagem, comece com /ms"
    );

    await admin.send(
      `-----a partir de agora voce esta em um CHAT com ${message.author.tag}-----`
    );

  }

});


client.login(TOKEN);