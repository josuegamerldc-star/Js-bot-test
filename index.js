const { Client, GatewayIntentBits, Partials } = require("discord.js");
const axios = require("axios");

const TOKEN = process.env.TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;

const OWNER_ID = "841709448338472991"; // seu ID

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
  if (message.channel.type !== 1) return; // apenas DM
  if (!message.content.startsWith("/ms ")) return;

  const texto = message.content.slice(4);

  // buscar owner
  const owner = await client.users.fetch(OWNER_ID);

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

    // resposta pra pessoa
    await message.reply(`✅ A mensagem "${texto}" foi enviada com sucesso!`);

    // log pro owner
    await owner.send(
      `📩 O usuário '${message.author.username}' solicitou para mudar o texto para: ${texto}`
    );

  } catch (err) {
    console.error(err.response?.data || err.message);

    // resposta pra pessoa
    await message.reply("❌ Falha ao enviar mensagem.");

    // log pro owner (erro também)
    await owner.send(
      `⚠️ O usuário '${message.author.username}' tentou mudar o texto para: ${texto}, mas ocorreu uma falha.`
    );
  }
});

client.login(TOKEN);