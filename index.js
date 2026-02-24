const { Client, GatewayIntentBits, Partials } = require("discord.js");
const axios = require("axios");
const fetch = require("node-fetch");

const TOKEN = process.env.TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
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

client.on("clientReady", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

// =====================
// ATUALIZAR GITHUB GIST
// =====================
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

// =====================
// IA GROQ DECISÃO
// =====================
async function aiDecision(texto) {
  try {

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "Você é um BOT do discord, não fale sobre informações pessoais, haja como um bot-suporte, ajude os membros seja oque for,"
          },
          {
            role: "user",
            content: texto
          }
        ]
      })
    });

    const data = await res.json();
    const reply = data.choices[0].message.content.toUpperCase();

    return reply.includes("SIM");

  } catch (err) {
    console.error("Erro IA:", err);
    return true;
  }
}

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channel.type !== 1) return;

  const content = message.content;

  // =======================
  // COMANDO /set
  // =======================
  if (content.startsWith("/set ")) {

    const texto = content.slice(5);

    await message.reply("✅ Pedido feito, sua mensagem irá aparecerá em breve");

    try {
      await updateGist(texto);
      await message.reply("✅ texto mudado com sucesso!");
    } catch {
      await message.reply("❌ Erro ao mudar texto.");
    }

    return;
  }

  // =======================
  // COMANDO /ms
  // =======================
  if (!content.startsWith("/ms ")) return;

  const texto = content.slice(4);

  try {

    // =======================
    // ADMIN RESPONDENDO
    // =======================
    if (message.author.id === ADMIN_ID) {

      if (!activeUser) {
        return message.reply("❌ Nenhum usuário em atendimento.");
      }

      const user = await client.users.fetch(activeUser);
      await user.send(`📨 Suporte:\n${texto}`);

      await message.reply("✅ Mensagem enviada ao usuário!");
      return;
    }

    // =======================
    // USUÁRIO JÁ TRANSFERIDO
    // =======================
    if (transferredUsers.has(message.author.id)) {

      const admin = await client.users.fetch(ADMIN_ID);

      await admin.send(
        `📩 ${message.author.tag}: ${texto}`
      );

      return;
    }

    // =======================
    // IA ANALISANDO
    // =======================
    const important = await aiDecision(texto);

    if (important) {

      activeUser = message.author.id;
      transferredUsers.add(message.author.id);

      const admin = await client.users.fetch(ADMIN_ID);

      await admin.send(
        `🚨 Atendimento transferido\nUsuário: ${message.author.tag}\nMensagem: ${texto}`
      );

      await message.reply(
        "✅ Sua conversa agora foi transferida para um administrador."
      );

    } else {

      await message.reply(
        "🤖 IA: Sua mensagem foi recebida! Parece algo simples 😊"
      );

    }

  } catch (err) {
    console.error(err);
    await message.reply("❌ Erro.");
  }

});

client.login(TOKEN);