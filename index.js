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
// SISTEMAS
// =============================

let currentUserId = null;
let chatMemory = new Map();
let messageCount = new Map();


client.on("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
});


// =============================
// ATUALIZAR GITHUB (SEU MÉTODO)
// =============================

async function updateGist(texto) {

  await axios.patch(
    `https://api.github.com/gists/${GIST_ID}`,
    {
      files: {
        "gistfile1.txt": {
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

  if (!messageCount.has(userId)) {
    messageCount.set(userId, 0);
  }

  messageCount.set(userId, messageCount.get(userId) + 1);

  const history = chatMemory.get(userId);

  history.push({ role: "user", content: texto });

  if (history.length > 12) history.shift();

  const messages = [
    {
      role: "system",
      content: `
Você é Js Studios BOT.

INFORMAÇÕES:

- Você é uma IA de suporte de um servidor Discord.
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

TRANSFERÊNCIA:

Se o usuário pedir administrador, humano ou ajuda real,
no FINAL escreva: [TRANSFERIR]

Caso contrário nunca escreva isso.
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
  // ADMIN
  // =============================

  if (userId === ADMIN_ID) {

    // =============================
    // /set (MUDAR GITHUB)
    // =============================
    if (content.startsWith("/set ")) {

      const texto = content.slice(5);

      try {

        await updateGist(texto);

        await message.reply("sucesso");

      } catch (err) {

        console.error(err.response?.data || err.message);

        await message.reply("falha");

      }

      return;
    }


    // =============================
    // RESPONDER USUARIO
    // =============================
    if (content.startsWith("/ms ")) {

      if (!currentUserId) {
        return message.reply("Nenhum usuario em atendimento.");
      }

      const texto = content.slice(4);

      const user = await client.users.fetch(currentUserId);

      await user.send(texto);

      return;
    }


    // =============================
    // FECHAR
    // =============================
    if (content === "/close") {

      if (!currentUserId) {
        return message.reply("Nenhum atendimento ativo.");
      }

      const user = await client.users.fetch(currentUserId);

      await user.send("Atendimento encerrado.");

      chatMemory.delete(currentUserId);
      messageCount.delete(currentUserId);

      currentUserId = null;

      return message.reply("Atendimento fechado.");
    }

    return;
  }


  // =============================
  // USUARIO EM CHAT COM ADMIN
  // =============================

  if (currentUserId === userId) {

    const admin = await client.users.fetch(ADMIN_ID);

    await admin.send(content);

    return;
  }


  // =============================
  // IA
  // =============================

  const aiReply = await aiChat(userId, content);

  const transfer = aiReply.includes("[TRANSFERIR]");
  let clean = aiReply.replace("[TRANSFERIR]", "");


  if (messageCount.get(userId) >= 3 && !transfer) {
    clean += "\n\nCaso precise, posso transferir você para atendimento humano.";
  }

  await message.reply(clean);


  // =============================
  // TRANSFERIR
  // =============================

  if (transfer) {

    currentUserId = userId;

    const admin = await client.users.fetch(ADMIN_ID);

    await message.reply(
      "Vou transferir você para o ADMINISTRADOR. A partir de agora voce esta falando com o administrador. Para enviar mensagem, comece com /ms"
    );

    await admin.send(
      `-----a partir de agora voce esta em um CHAT com ${message.author.tag}-----`
    );

  }

});


client.login(TOKEN);