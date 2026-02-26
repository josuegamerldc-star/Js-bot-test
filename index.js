const { Client, GatewayIntentBits, Partials } = require("discord.js");
const axios = require("axios");

const TOKEN = process.env.TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;

const OWNER_ID = "841709448338472991";

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

async function getGistContent() {
  const res = await axios.get(`https://api.github.com/gists/${GIST_ID}`);
  return res.data.files["gistfile1.txt"].content;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.type !== 1) return;
  if (!message.content.startsWith("/ms ")) return;

  const texto = message.content.slice(4).trim();
  if (!texto) return;

  const owner = await client.users.fetch(OWNER_ID);

  try {

    // mensagem inicial pro usuário
    await message.reply(
      `📨 vc solicitou para mudar o texto para "${texto}", e em breve irá alterar o texto.`
    );

    // log pro owner SOMENTE se não for o owner
    if (message.author.id !== OWNER_ID) {
      await owner.send(
        `📩 ${message.author.username} solicitou para mudar o texto para "${texto}"`
      );
    }

    // alterar gist
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

    // verificar a cada 2 segundos até mudar
    const interval = setInterval(async () => {
      try {
        const atual = await getGistContent();

        if (atual.trim() === texto.trim()) {
          clearInterval(interval);

          await message.reply("✅ Texto alterado com sucesso!");
        }
      } catch (err) {
        console.error("Erro ao verificar:", err.message);
      }
    }, 2000);

  } catch (err) {
    console.error(err.response?.data || err.message);

    await message.reply("❌ Ocorreu um erro ao solicitar a alteração.");

    if (message.author.id !== OWNER_ID) {
      await owner.send(
        `⚠️ ${message.author.username} tentou mudar o texto para "${texto}", mas ocorreu erro.`
      );
    }
  }
});

client.login(TOKEN);