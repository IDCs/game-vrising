import turbowalk, { IEntry } from 'turbowalk';
import { fs, log, selectors, types, util } from 'vortex-api';

export const IGNORABLE_FILES = [
  'LICENSE', 'README.md', 'manifest.json', 'icon.png',
];

export const GAME_ID = 'vrising';
export const isVRising = (gameId: string) => [GAME_ID].includes(gameId);

export interface IProps {
  api: types.IExtensionApi;
  state: types.IState;
  profile: types.IProfile;
  mods: { [modId: string]: types.IMod };
  discovery: types.IDiscoveryResult;
}

export async function walkDirPath(dirPath: string): Promise<IEntry[]> {
  let fileEntries: IEntry[] = [];
  await turbowalk(dirPath, (entries: IEntry[]) => {
    fileEntries = fileEntries.concat(entries);
  })
  .catch({ systemCode: 3 }, () => Promise.resolve())
  .catch(err => ['ENOTFOUND', 'ENOENT'].includes(err.code)
    ? Promise.resolve() : Promise.reject(err));

  return fileEntries;
}

export function genProps(api: types.IExtensionApi, profileId?: string): IProps {
  const state = api.getState();
  profileId = profileId !== undefined
    ? profileId
    : selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    // This is too spammy.
    // log('debug', 'Invalid profile', { profile });
    return undefined;
  }
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if (discovery?.path === undefined) {
    // log('debug', 'Game is not discovered', { profile, discovery });
    return undefined;
  }

  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  return { api, state, profile, discovery, mods };
}

export function genInstructions(srcPath: string,
                                destPath: string,
                                entries: IEntry[]): types.IInstruction[] {
  return entries.filter(entry => !entry.isDirectory)
    .reduce((accum, iter) => {
      const destination: string = iter.filePath.replace(srcPath, destPath);
      accum.push({
        type: 'copy',
        source: iter.filePath,
        destination,
      });
      return accum;
    }, []);
}

export async function removeDir(filePath: string) {
  const filePaths = await walkDirPath(filePath);
  filePaths.sort((lhs, rhs) => rhs.filePath.length - lhs.filePath.length);
  for (const entry of filePaths) {
    try {
      await fs.removeAsync(entry.filePath);
    } catch (err) {
      log('debug', 'failed to remove file', err);
    }
  }
}
