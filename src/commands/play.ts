import {TextChannel, Message} from 'discord.js';
import {URL} from 'url';
import {TYPES} from '../types';
import {inject, injectable} from 'inversify';
import {QueuedSong, STATUS} from '../services/player';
import PlayerManager from '../managers/player';
import {getMostPopularVoiceChannel} from '../utils/channels';
import LoadingMessage from '../utils/loading-message';
import errorMsg from '../utils/error-msg';
import Command from '.';
import GetSongs from '../services/get-songs';

@injectable()
export default class implements Command {
  public name = 'play';
  public aliases = ['p'];
  public examples = [
    ['play', 'Retomar a reprodução pausada'],
    ['play https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Reproduz um vídeo do YouTube'],
    ['play cool music', 'Reproduz o primeiro resultado da pesquisa por "cool music" do YouTube'],
    ['play https://www.youtube.com/watch?list=PLi9drqWffJ9FWBo7ZVOiaVy0UQQEm4IbP', 'Adiciona a playlist à fila'],
    ['play https://open.spotify.com/track/3ebXMykcMXOcLeJ9xZ17XH?si=tioqSuyMRBWxhThhAW51Ig', 'Reproduz uma música do Spotify'],
    ['play https://open.spotify.com/album/5dv1oLETxdsYOkS2Sic00z?si=bDa7PaloRx6bMIfKdnvYQw', 'Adiciona todas as músicas do álbum à fila'],
    ['play https://open.spotify.com/playlist/37i9dQZF1DX94qaYRnkufr?si=r2fOVL_QQjGxFM5MWb84Xw', 'Adiciona todas as músicas da playlisto à fila'],
    ['play cool music immediate', 'Adiciona o primeiro resultado da pesquisa por "cool music" ao início da fila'],
    ['play cool music i', 'Adiciona o primeiro resultado da pesquisa por "cool music" ao início da fila']
  ];

  public requiresVC = true;

  private readonly playerManager: PlayerManager;
  private readonly getSongs: GetSongs;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager, @inject(TYPES.Services.GetSongs) getSongs: GetSongs) {
    this.playerManager = playerManager;
    this.getSongs = getSongs;
  }

  public async execute(msg: Message, args: string []): Promise<void> {
    const [targetVoiceChannel] = getMostPopularVoiceChannel(msg.guild!);

    const res = new LoadingMessage(msg.channel as TextChannel);
    await res.start();

    const player = this.playerManager.get(msg.guild!.id);

    const queueOldSize = player.queueSize();
    const wasPlayingSong = player.getCurrent() !== null;

    if (args.length === 0) {
      if (player.status === STATUS.PLAYING) {
        await res.stop(errorMsg('📻 Já está tocando, me dê o nome de uma música'));
        return;
      }

      // Must be resuming play
      if (!wasPlayingSong) {
        await res.stop(errorMsg('📻 Nada para tocar'));
        return;
      }

      await player.connect(targetVoiceChannel);
      await player.play();

      await res.stop('📻 O 🚦 está 🟢 agora');
      return;
    }

    const addToFrontOfQueue = args[args.length - 1] === 'i' || args[args.length - 1] === 'immediate';

    const newSongs: QueuedSong[] = [];
    let extraMsg = '';

    // Test if it's a complete URL
    try {
      const url = new URL(args[0]);

      const YOUTUBE_HOSTS = ['www.youtube.com', 'youtu.be', 'youtube.com'];

      if (YOUTUBE_HOSTS.includes(url.host)) {
        // YouTube source
        if (url.searchParams.get('list')) {
          // YouTube playlist
          newSongs.push(...await this.getSongs.youtubePlaylist(url.searchParams.get('list') as string));
        } else {
          // Single video
          const song = await this.getSongs.youtubeVideo(url.href);

          if (song) {
            newSongs.push(song);
          } else {
            await res.stop(errorMsg('📻 Isso não existe'));
            return;
          }
        }
      } else if (url.protocol === 'spotify:' || url.host === 'open.spotify.com') {
        const [convertedSongs, nSongsNotFound, totalSongs] = await this.getSongs.spotifySource(args[0]);

        if (totalSongs > 50) {
          extraMsg = 'Uma amostra aleatória de 50 canções foi tirada';
        }

        if (totalSongs > 50 && nSongsNotFound !== 0) {
          extraMsg += ' e ';
        }

        if (nSongsNotFound !== 0) {
          if (nSongsNotFound === 1) {
            extraMsg += '1 música não foi encontrada';
          } else {
            extraMsg += `📻 ${nSongsNotFound.toString()} músicas não foram encontradas`;
          }
        }

        newSongs.push(...convertedSongs);
      }
    } catch (_: unknown) {
      // Not a URL, must search YouTube
      const query = addToFrontOfQueue ? args.slice(0, args.length - 1).join(' ') : args.join(' ');

      const song = await this.getSongs.youtubeVideoSearch(query);

      if (song) {
        newSongs.push(song);
      } else {
        await res.stop(errorMsg('📻 Isso não existe'));
        return;
      }
    }

    if (newSongs.length === 0) {
      await res.stop(errorMsg('📻 Nenhuma música encontrada'));
      return;
    }

    newSongs.forEach(song => player.add(song, {immediate: addToFrontOfQueue}));

    const firstSong = newSongs[0];

    if (extraMsg !== '') {
      extraMsg = ` (${extraMsg})`;
    }

    if (newSongs.length === 1) {
      await res.stop(`📻 pode apostar, **${firstSong.title}** adicionado ao${addToFrontOfQueue ? ' frente do' : ''} fila${extraMsg}`);
    } else {
      await res.stop(`📻 pode apostar, **${firstSong.title}** e ${newSongs.length - 1} outras canções foram adicionadas a fila${extraMsg}`);
    }

    if (queueOldSize === 0 && !wasPlayingSong) {
      // Only auto-play if queue was empty before and nothing was playing
      if (player.voiceConnection === null) {
        await player.connect(targetVoiceChannel);
      }

      await player.play();
    }
  }
}
