import 'dotenv/config';
import { Client, GatewayIntentBits, PermissionsBitField } from 'discord.js';
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS keywords (id SERIAL PRIMARY KEY, word TEXT UNIQUE NOT NULL)`);
}

async function getKeywords() {
  const res = await pool.query('SELECT word FROM keywords');
  return res.rows.map(r => r.word);
}

async function addKeyword(word) {
  await pool.query('INSERT INTO keywords (word) VALUES ($1) ON CONFLICT DO NOTHING', [word]);
}

async function deleteKeyword(word) {
  await pool.query('DELETE FROM keywords WHERE LOWER(word) = LOWER($1)', [word]);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let cachedKeywords = [];
let messageEmojis = [
    '<:MONKA:1404546358245068974>',
    '<:NAILS:1404545586140545114>',
];

function getRandomEmoji() {
    const randomIndex = Math.floor(Math.random() * messageEmojis.length);
    return messageEmojis[randomIndex];
}

client.once('ready', async () => {
  await initDB();
  cachedKeywords = await getKeywords();

  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const keywords = cachedKeywords;
  const msgLower = message.content.toLowerCase();

  for (const word of keywords) {
    if (msgLower.includes(word.toLowerCase())) {
      message.reply(`${getRandomEmoji()} censor: \`${word}\``);
      break;
    }
  }
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!')) return;
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

  const [command, ...args] = message.content.slice(1).trim().split(/ +/);
  const word = args.join(' ');

  if (command === 'addword') {
    if (!word) return message.reply('⚠️ Please provide a word to add.');
    await addKeyword(word);
    if (!cachedKeywords.includes(word.toLowerCase())) {
        cachedKeywords.push(word.toLowerCase());
    }
    message.reply(`Added keyword: \`${word}\``);
  }

  if (command === 'removeword') {
    await deleteKeyword(word);
    cachedKeywords = cachedKeywords.filter(k => k !== word.toLowerCase());
    message.reply(`Removed keyword: \`${word}\``);
  }

  if (command === 'listwords') {
    const keywords = cachedKeywords;
    if (keywords.length > 0) {
      message.reply("Current keywords:\n" + keywords.map(w => `- ${w}`).join("\n"));
    } else {
      message.reply("No keywords set.");
    }
  }

  if (command === 'help') {
    const helpMsg = `**Censorship Bot Commands**
    
    !addword <word>\` - Add a new word to censor
    !removeword <word>\` - Remove a word from the censor list
    !listwords\` - List all censored words

    *Note: You need Manage Messages permission to use these commands.*`;
    message.reply(helpMsg);
    }
});

client.login(process.env.DISCORD_TOKEN);