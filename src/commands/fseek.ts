import {Message, TextChannel} from 'discord.js';
import {TYPES} from '../types';
import {inject, injectable} from 'inversify';
import PlayerManager from '../managers/player';
import LoadingMessage from '../utils/loading-message';
import errorMsg from '../utils/error-msg';
import Command from '.';

@injectable()
export default class implements Command {
  public name = 'fseek';
  public aliases = [];
  public examples = [
    ['fseek 10', 'Avança na música atual em 10 segundos']
  ];

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(msg: Message, args: string []): Promise<void> {
    const player = this.playerManager.get(msg.guild!.id);

    const currentSong = player.getCurrent();

    if (!currentSong) {
      await msg.channel.send(errorMsg('📻 Não está tocando nada'));
      return;
    }

    if (currentSong.isLive) {
      await msg.channel.send(errorMsg('📻 Não é possível avançar em uma transmissão ao vivo'));
      return;
    }

    const seekTime = parseInt(args[0], 10);

    if (seekTime + player.getPosition() > currentSong.length) {
      await msg.channel.send(errorMsg('📻 Não posso avançar além do final da música'));
      return;
    }

    const loading = new LoadingMessage(msg.channel as TextChannel);

    await loading.start();

    try {
      await player.forwardSeek(seekTime);

      await loading.stop();
    } catch (error: unknown) {
      await loading.stop(errorMsg(error as Error));
    }
  }
}
