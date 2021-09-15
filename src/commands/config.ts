import {TextChannel, Message, GuildChannel} from 'discord.js';
import {injectable} from 'inversify';
import {Settings} from '../models';
import errorMsg from '../utils/error-msg';
import Command from '.';

@injectable()
export default class implements Command {
  public name = 'config';
  public aliases = [];
  public examples = [
    ['config prefix !', 'Pefina o prefixo!'],
    ['config channel music-commands', 'Ligar o bot ao canal específico para ficar escutando os comandos']
  ];

  public async execute(msg: Message, args: string []): Promise<void> {
    if (args.length === 0) {
      // Show current settings
      const settings = await Settings.findByPk(msg.guild!.id);

      if (settings) {
        let response = `prefixo: \`${settings.prefix}\`\n`;
        response += `📻 Canal: ${msg.guild!.channels.cache.get(settings.channel)!.toString()}`;

        await msg.channel.send(response);
      }

      return;
    }

    const setting = args[0];

    if (args.length !== 2) {
      await msg.channel.send(errorMsg('📻 Número incorreto de argumentos'));
      return;
    }

    if (msg.author.id !== msg.guild!.owner!.id) {
      await msg.channel.send(errorMsg('📻 Não autorizado'));
      return;
    }

    switch (setting) {
      case 'prefix': {
        const newPrefix = args[1];

        await Settings.update({prefix: newPrefix}, {where: {guildId: msg.guild!.id}});

        await msg.channel.send(`📻 👍 Prefixo atualizado para \`${newPrefix}\``);
        break;
      }

      case 'channel': {
        let channel: GuildChannel | undefined;

        if (args[1].includes('<#') && args[1].includes('>')) {
          channel = msg.guild!.channels.cache.find(c => c.id === args[1].slice(2, args[1].indexOf('>')));
        } else {
          channel = msg.guild!.channels.cache.find(c => c.name === args[1]);
        }

        if (channel && channel.type === 'text') {
          await Settings.update({channel: channel.id}, {where: {guildId: msg.guild!.id}});

          await Promise.all([
            (channel as TextChannel).send('📻 Hey, aparentemente estou vinculado a este canal agora'),
            msg.react('👍')
          ]);
        } else {
          await msg.channel.send(errorMsg('📻 Ou esse canal não existe ou você quer que eu me torne consciente e ouça um canal de voz'));
        }

        break;
      }

      default:
        await msg.channel.send(errorMsg('📻 Nunca conheci esse cenário na minha vida'));
    }
  }
}
