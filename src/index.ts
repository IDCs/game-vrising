import Bluebird from 'bluebird';
import path from 'path';
import { fs, log, selectors, types, util } from 'vortex-api';

import { GAME_ID, genProps } from './common';
import { ensureBIXMod } from './payloadDeployer';

const NAME = 'V Rising';
const STEAM_ID = '1604030';

function findGame() {
  return util.GameStoreHelper.findByAppId([STEAM_ID])
    .then(game => game.gamePath);
}

function prepareForModding(api: types.IExtensionApi, discovery: types.IDiscoveryResult) {
  const state = api.getState();
  const modTypes: { [typeId: string]: string } = selectors.modPathsForGame(state, GAME_ID);
  const createDirectories = async () => {
    for (const modType of Object.keys(modTypes)) {
      try {
        await fs.ensureDirWritableAsync(modTypes[modType]);
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
  return new Bluebird<void>((resolve, reject) => createDirectories()
    .then(() => ensureBIXMod(api))
    .then(() => resolve())
    .catch(err => reject(err)));
}

function main(context: types.IExtensionContext) {
  context.registerGame({
    id: GAME_ID,
    name: NAME,
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => '.',
    logo: 'gameart.jpg',
    executable: () => 'VRising.exe',
    requiredFiles: [
      'VRising.exe',
    ],
    environment: {
      SteamAPPId: STEAM_ID,
    },
    setup: (discovery: types.IDiscoveryResult) => prepareForModding(context.api, discovery),
    details: {
      steamAppId: +STEAM_ID,
    },
  });

  const isSupported = (gameId: string) => gameId === GAME_ID;
  const getPath = (game: types.IGame): string => {
    const state: types.IState = context.api.getState();
    const discovery = state.settings.gameMode.discovered[game.id];
    if (discovery?.path !== undefined) {
      return discovery.path;
    } else {
      return '.';
    }
  };

  context.registerModType('vrising-bix-pack', 50, isSupported,
  (game: types.IGame) => getPath(game),
    () => Bluebird.Promise.resolve(false), {
    mergeMods: true,
    name: 'BepInEx Package',
  });

  context.registerModType('vrising-bix-root', 50, isSupported,
  (game: types.IGame) => path.join(getPath(game), 'BepInEx'),
    () => Bluebird.Promise.resolve(false), {
    mergeMods: true,
    name: '../BepInEx/',
  });

  context.registerModType('vrising-bix-plugin', 60, isSupported,
    (game: types.IGame) => path.join(getPath(game), 'BepInEx', 'plugins'),
    (instructions: types.IInstruction[]) => {
      const copyInstructions = instructions.filter(instr => (instr.type === 'copy')
        && path.extname(path.basename(instr.destination)));
      const hasDLL = (copyInstructions.find(instr =>
        path.extname(instr.destination) === '.dll') !== undefined);
      return Bluebird.Promise.resolve(hasDLL);
    }, {
    mergeMods: true,
    name: '../BepInEx/plugins/',
  });

  context.registerModType('vrising-bix-patcher', 25, isSupported,
    (game: types.IGame) => path.join(getPath(game), 'BepInEx', 'patchers'),
    () => Bluebird.Promise.resolve(false), {
    mergeMods: true,
    name: '../BepInEx/patchers/',
  });
;
  return true;
}

export default main;
