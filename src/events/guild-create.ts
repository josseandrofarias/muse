import {Guild, TextChannel, Message} from 'discord.js';
import emoji from 'node-emoji';
import pEvent from 'p-event';
import {Settings} from '../models';
import {chunk} from '../utils/arrays';

const DEFAULT_PREFIX = '!';

export default async (guild: Guild): Promise<void> => {
  await Settings.upsert({guildId: guild.id, prefix: DEFAULT_PREFIX});

  const owner = await guild.client.users.fetch(guild.ownerID);

  let firstStep = '👋 Olá!\n';
  firstStep += 'Eu só preciso fazer algumas perguntas antes de você começar a ouvir música.\n\n';
  firstStep += 'Primeiro, qual canal devo ouvir para comandos de música?\n\n';

  const firstStepMsg = await owner.send(firstStep);

  // Show emoji selector
  interface EmojiChannel {
    name: string;
    id: string;
    emoji: string;
  }

  const emojiChannels: EmojiChannel[] = [];

  for (const [channelId, channel] of guild.channels.cache) {
    if (channel.type === 'text') {
      emojiChannels.push({
        name: channel.name,
        id: channelId,
        emoji: emoji.random().emoji
      });
    }
  }

  const sentMessageIds: string[] = [];

  chunk(emojiChannels, 10).map(async chunk => {
    let str = '';
    for (const channel of chunk) {
      str += `${channel.emoji}: #${channel.name}\n`;
    }

    const msg = await owner.send(str);

    sentMessageIds.push(msg.id);

    await Promise.all(chunk.map(async channel => msg.react(channel.emoji)));
  });

  // Wait for response from user

  const [choice] = await pEvent(guild.client, 'messageReactionAdd', {
    multiArgs: true,
    filter: options => {
      const [reaction, user] = options;
      return sentMessageIds.includes(reaction.message.id) && user.id === owner.id;
    }
  });

  const chosenChannel = emojiChannels.find(e => e.emoji === choice.emoji.name) as EmojiChannel;

  // Second setup step (get prefix)
  let secondStep = `👍Legal, vou ouvir em **#${chosenChannel.name}** \n\n`;
  secondStep += 'Última pergunta: qual caractere devo usar como prefixo? Digite um único caractere e pressione Enter.';

  await owner.send(secondStep);

  const prefixResponses = await firstStepMsg.channel.awaitMessages((r: Message) => r.content.length === 1, {max: 1});

  const prefixCharacter = prefixResponses.first()!.content;

  // Save settings
  await Settings.update({prefix: prefixCharacter, channel: chosenChannel.id}, {where: {guildId: guild.id}});

  // Send welcome
  const boundChannel = guild.client.channels.cache.get(chosenChannel.id) as TextChannel;

  await boundChannel.send(`Hey <@${owner.id}> try \`${prefixCharacter}play https://www.youtube.com/watch?v=dQw4w9WgXcQ\``);

  await firstStepMsg.channel.send(`Soa bem. Veririfique o canal **#${chosenChannel.name}** para começarmos.`);
};
