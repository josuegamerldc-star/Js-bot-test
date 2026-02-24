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

let activeChats = new Map(); // userId -> true

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
// IA
// =====================
async function aiChat(texto) {

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
        messages: [
          {
            role: "system",
            content: `
Você é um BOT DE SUPORTE do Discord.

REGRAS OBRIGATÓRIAS:

- Seja formal e educado.
- Não faça piadas.
- Não fale sobre amizade.
- Não fale sobre sentimentos.
- Não fale coisas pessoais.
- Não use emojis.
- Não diga que é uma IA avançada.
- Não peça para mencionar administradores.
- Você é o próprio sistema de suporte.

OBJETIVO:

- Ajudar o usuário com dúvidas.
- Resolver problemas simples.
- Se o usuário pedir administrador, suporte humano, moderador ou ajuda real,
responda normalmente e no FINAL escreva: [TRANSFERIR]

EXEMPLOS DE TRANSFERÊNCIA:

"quero falar com adm"
"preciso de ajuda de verdade"
"quero suporte humano"
"me passa um moderador"

Quando não precisar transferir, NÃO escreva [TRANSFERIR].
`
          },
          {
            role: "user",
            content: texto
          }
        ]
      })
    }
  );

  const data = await res.json();

  return data.choices[0].message.content;
}


// =====================
// MENSAGEM
// =====================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channel.type !== 1) return;

  const content = message.content;


  // =====================
  // /set
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
  // ADMIN RESPONDE
  // =====================
  if (message.author.id === ADMIN_ID && content.startsWith("/ms ")) {

    const texto = content.slice(4);

    const userId = [...activeChats.keys()][0];

    if (!userId) {
      return message.reply("Nenhum usuario em atendimento.");
    }

    const user = await client.users.fetch(userId);

    await user.send(texto);

    return;
  }


  // =====================
  // USUARIO EM CHAT
  // =====================
  if (activeChats.has(message.author.id)) {

    const admin = await client.users.fetch(ADMIN_ID);

    await admin.send(content);

    return;
  }


  // =====================
  // IA
  // =====================
  const reply = await aiChat(content);

  const transfer = reply.includes("[TRANSFERIR]");

  const clean = reply.replace("[TRANSFERIR]", "");

  await message.reply(clean);


  // =====================
  // TRANSFERIR
  // =====================
  if (transfer) {

    activeChats.set(message.author.id, true);

    const admin = await client.users.fetch(ADMIN_ID);

    await message.reply(
      "Vou transferir você para o ADMINISTRADOR, a partir de agora você está falando com o administrador. Para enviar uma mensagem, comece com /ms"
    );

    await admin.send(
      `-----a partir de agora você está em um CHAT com ${message.author.tag}-----`
    );

  }

});

client.login(TOKEN);