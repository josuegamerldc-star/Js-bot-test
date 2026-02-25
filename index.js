const { Client, GatewayIntentBits, Partials } = require("discord.js");
const axios = require("axios");

const TOKEN = process.env.TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.on("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.type !== 1) return;

  if (!message.content.startsWith("/ms ")) return;

  const texto = message.content.slice(4);

  try {
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

    await message.reply(`✅ A mensagem "${texto}" foi enviada com sucesso`);

  } catch (err) {
    console.error(err.response?.data || err.message);
    await message.reply("❌ Falha ao enviar mensagem.");
  }
});

client.login(TOKEN);