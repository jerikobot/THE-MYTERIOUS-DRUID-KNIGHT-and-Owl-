import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling.js';
import { addXp } from '../services/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

export default {
  name: Events.MessageCreate,

  async execute(message, client) {
    try {

      if (message.author.bot || !message.guild) return;

      // ===== POWER RESPONDE SI LO MENCIONAN =====
      const powerLines = {
        greet: [
          "HALT. STATE YOUR PURPOSE.",
          "YOU STAND BEFORE POWER.",
          "INTRUSION DETECTED."
        ]
      };

      if (message.mentions.has(client.user)) {
        const pool = powerLines.greet;
        const reply = pool[Math.floor(Math.random() * pool.length)];

        await message.channel.send(reply);
        return;
      }

      // ===== RESPONDE A "hola" =====
      if (message.content.toLowerCase().startsWith("hola")) {

        const mensajes = [
          "hola",
          "por eso te funan.",
          "callate 100 años, w",
          "ok."
        ];

        const aleatorio =
          Math.floor(Math.random() * mensajes.length);

        await message.channel.send(mensajes[aleatorio]);
        return;
      }

      // ===== LEVELING =====
      await handleLeveling(message, client);

    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};

async function handleLeveling(message, client) {
  try {

    const rateLimitKey =
      `xp-event:${message.guild.id}:${message.author.id}`;

    const canProcess =
      await checkRateLimit(
        rateLimitKey,
        MESSAGE_XP_RATE_LIMIT_ATTEMPTS,
        MESSAGE_XP_RATE_LIMIT_WINDOW_MS
      );

    if (!canProcess) return;

    const levelingConfig =
      await getLevelingConfig(client, message.guild.id);

    if (!levelingConfig?.enabled) return;

    // resto de tu función igual...
