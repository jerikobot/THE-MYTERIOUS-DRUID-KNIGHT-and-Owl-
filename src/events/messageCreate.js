import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling.js';
import { addXp } from '../services/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

export default {
  name: Events.MessageCreate,

  async execute(message, client) {
    try {
      if (message.author.bot || !message.guild) return;

      const content = message.content.toLowerCase();
      if (content.startsWith("hola")) {
        const mensajes = [
          "Hola",
          "Knightly: Grrr... hold still.",
          "Knightly: Through the magic of the Druids, I move faster.",
          "OWL: Just hit them already!",
        ];

        const random = mensajes[Math.floor(Math.random() * mensajes.length)];

        await message.channel.send(random);
        return;
      }

      if (message.mentions.has(client.user)) {

        const userText = message.content
          .replace(`<@${client.user.id}>`, "")
          .trim();

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `
Eres THE MYSTERIOUS DRUID KNIGHT (& OWL) de ULTRAKILL.

Hablas siempre en español.

Dos voces:
- Knightly: serio, críptico, tipo jefe secreto.
- OWL: confundido, simple.

Formato obligatorio:
Knightly: ...
OWL: ...

Siempre referencia ULTRAKILL.
              `
            },
            {
              role: "user",
              content: userText
            }
          ]
        });

        await message.channel.send(completion.choices[0].message.content);
        return;
      }

      await handleLeveling(message, client);

    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};

async function handleLeveling(message, client) {
  try {
    const rateLimitKey = `xp-event:${message.guild.id}:${message.author.id}`;

    const canProcess = await checkRateLimit(
      rateLimitKey,
      MESSAGE_XP_RATE_LIMIT_ATTEMPTS,
      MESSAGE_XP_RATE_LIMIT_WINDOW_MS
    );

    if (!canProcess) return;

    const levelingConfig = await getLevelingConfig(client, message.guild.id);
    if (!levelingConfig?.enabled) return;

    if (!message.content || message.content.trim().length === 0) return;

    const userData = await getUserLevelData(
      client,
      message.guild.id,
      message.author.id
    );

    const cooldownTime = levelingConfig.xpCooldown || 60;
    const now = Date.now();
    const timeSinceLast = now - (userData.lastMessage || 0);

    if (timeSinceLast < cooldownTime * 1000) return;

    const minXP = levelingConfig.xpRange?.min || 15;
    const maxXP = levelingConfig.xpRange?.max || 25;

    const xp =
      Math.floor(Math.random() * (maxXP - minXP + 1)) + minXP;

    const finalXP =
      levelingConfig.xpMultiplier > 1
        ? Math.floor(xp * levelingConfig.xpMultiplier)
        : xp;

    const result = await addXp(client, message.guild, message.member, finalXP);

    if (result.success && result.leveledUp) {
      logger.info(
        `${message.author.tag} subió a nivel ${result.level}`
      );
    }

  } catch (error) {
    logger.error('Error handling leveling:', error);
  }
}
