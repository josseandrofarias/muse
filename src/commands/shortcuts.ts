import {Message} from 'discord.js';
import {injectable} from 'inversify';
import {Shortcut, Settings} from '../models';
import errorMsg from '../utils/error-msg';
import Command from '.';

@injectable()
export default class implements Command {
  public name = 'shortcuts';
  public aliases = [];
  public examples = [
    ['shortcuts', 'Mostrar todos os atalhos'],
    ['shortcuts set s skip', 'atalho `s` para` skip`'],
    ['shortcuts set party play https://www.youtube.com/watch?v=zK6oOJ1wz8k', 'Atalho `party` para tocar uma música específica'],
    ['shortcuts delete party', 'Remove o atalho `party`']
  ];

  public async execute(msg: Message, args: string []): Promise<void> {
    if (args.length === 0) {
      // Get shortcuts for guild
      const shortcuts = await Shortcut.findAll({where: {guildId: msg.guild!.id}});

      if (shortcuts.length === 0) {
        await msg.channel.send('📻 Não existem atalhos');
        return;
      }

      // Get prefix for guild
      const settings = await Settings.findOne({where: {guildId: msg.guild!.id}});

      if (!settings) {
        return;
      }

      const {prefix} = settings;

      const res = shortcuts.reduce((accum, shortcut) => {
        accum += `${prefix}${shortcut.shortcut}: ${shortcut.command}\n`;

        return accum;
      }, '');

      await msg.channel.send(res);
    } else {
      const action = args[0];

      const shortcutName = args[1];

      switch (action) {
        case 'set': {
          const shortcut = await Shortcut.findOne({where: {guildId: msg.guild!.id, shortcut: shortcutName}});

          const command = args.slice(2).join(' ');

          const newShortcut = {shortcut: shortcutName, command, guildId: msg.guild!.id, authorId: msg.author.id};

          if (shortcut) {
            if (shortcut.authorId !== msg.author.id && msg.author.id !== msg.guild!.owner!.id) {
              await msg.channel.send(errorMsg('📻 Você não tem permissão para fazer isso'));
              return;
            }

            await shortcut.update(newShortcut);
            await msg.channel.send('📻 Atalho atualizado');
          } else {
            await Shortcut.create(newShortcut);
            await msg.channel.send('📻 Atalho criado');
          }

          break;
        }

        case 'delete': {
          // Check if shortcut exists
          const shortcut = await Shortcut.findOne({where: {guildId: msg.guild!.id, shortcut: shortcutName}});

          if (!shortcut) {
            await msg.channel.send(errorMsg('📻 Atalho não existe'));
            return;
          }

          // Check permissions
          if (shortcut.authorId !== msg.author.id && msg.author.id !== msg.guild!.owner!.id) {
            await msg.channel.send(errorMsg('📻 Você não tem permissão para fazer isso'));
            return;
          }

          await shortcut.destroy();

          await msg.channel.send('📻 Atalho deletado');

          break;
        }

        default: {
          await msg.channel.send(errorMsg('📻 Comando desconhecido'));
        }
      }
    }
  }
}
