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

let activeUser = null;
let transferredUsers = new Set();

client.on("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});


// =====================
// ATUALIZAR GITHUB GIST
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
// IA GROQ
// =====================
async function aiChat(texto) {

  try {

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
Você é um bot de suporte do Discord.

REGRAS:
- Converse normalmente com o usuário.
- Seja amigável.
- Se a pessoa precisar de ajuda real ou suporte humano,
termine a resposta com: [TRANSFERIR]
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

  } catch (err) {

    console.error(err);
    return "❌ Erro na IA.";

  }

}


// =====================
// EVENTO MENSAGEM
// =====================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channel.type !== 1) return;

  const content = message.content;


  // =======================
  // /set  (mudar github)
  // =======================
  if (content.startsWith("/set ")) {

    const texto = content.slice(5);

    await message.reply(
      "✅ Pedido feito, seu texto (talvez) aparecerá em breve."
    );

    try {

      await updateGist(texto);

      setTimeout(() => {
        message.reply("✅ Texto apareceu com sucesso!");
      }, 5000);

    } catch {

      await message.reply("❌ Erro ao mudar texto.");

    }

    return;

  }


  // =======================
  // ADMIN RESPONDENDO
  // =======================
  if (message.author.id === ADMIN_ID && content.startsWith("/ms ")) {

    const texto = content.slice(4);

    if (!activeUser) {
      return message.reply("❌ Nenhum usuário em atendimento.");
    }

    const user = await client.users.fetch(activeUser);

    await user.send(`📨 Suporte:\n${texto}`);

    await message.reply("✅ Mensagem enviada!");

    return;
  }


  // =======================
  // USUÁRIO EM ATENDIMENTO
  // =======================
  if (transferredUsers.has(message.author.id)) {

    const admin = await client.users.fetch(ADMIN_ID);

    await admin.send(
      `📩 ${message.author.tag}: ${content}`
    );

    return;
  }


  // =======================
  // IA CONVERSA
  // =======================
  const reply = await aiChat(content);

  const transfer = reply.includes("[TRANSFERIR]");

  const cleanReply = reply.replace("[TRANSFERIR]", "");

  await message.reply(cleanReply);


  // =======================
  // TRANSFERIR PRO ADMIN
  // =======================
  if (transfer) {

    activeUser = message.author.id;
    transferredUsers.add(message.author.id);

    const admin = await client.users.fetch(ADMIN_ID);

    await admin.send(
      `🚨 Atendimento iniciado\nUsuário: ${message.author.tag}\nMensagem: ${content}`
    );

  }

});


// =====================
// LOGIN
// =====================
client.login(TOKEN);