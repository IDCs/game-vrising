import path from 'path';
import { IEntry } from 'turbowalk';
import { actions, fs, selectors, types, util } from 'vortex-api';
import Parser, { IniFile, WinapiFormat } from 'vortex-parse-ini';

import { GAME_ID, genInstructions, genProps, IProps, walkDirPath } from './common';

const PAYLOAD_PATH = path.join(__dirname, 'payload');

async function createBIXMod(props: IProps) {
  const modId = 'bixil2cpppack';
  const { api, profile } = props;
  const mod = {
    id: modId,
    state: 'installed',
    attributes: {
      name: 'BepInEx (IL2CPP)',
      description: 'The BepInEx mod loader - mods require this to be enabled and deployed at all times',
      logicalFileName: 'BepInEx (IL2CPP)',
      modId: 666,
      version: '1.0.0',
      installTime: new Date(),
    },
    installationPath: modId,
    type: 'vrising-bix-pack',
  };

  return new Promise<void>((resolve, reject) => {
    api.events.emit('create-mod', profile.gameId, mod, async (error) => {
      if (error !== null) {
        return reject(error);
      }
      try {
        const installPath = selectors.installPathForGame(props.state, GAME_ID);
        const fileEntries: IEntry[] = await walkDirPath(PAYLOAD_PATH);
        const srcPath = PAYLOAD_PATH;
        const destPath = path.join(installPath, modId);
        const instructions: types.IInstruction[] = genInstructions(srcPath, destPath, fileEntries);
        for (const instr of instructions) {
          await fs.ensureDirWritableAsync(path.dirname(instr.destination));
          await fs.copyAsync(instr.source, instr.destination);
        }
      } catch (err) {
        return reject(err);
      }
      const reduxActs = [actions.setModEnabled(profile.id, modId, true),
                         actions.setDeploymentNecessary(GAME_ID, true)];
      util.batchDispatch(props.api.store, reduxActs);
      return resolve();
    });
  });
}

export async function ensureBIXMod(api: types.IExtensionApi) {
  const props: IProps = genProps(api);
  if (Object.values(props.mods).find(mod => mod.type === 'vrising-bix-pack') === undefined) {
    await createBIXMod(props);
  }
}

async function ensureConsole(filePath: string) {
  const parser = new Parser(new WinapiFormat());
  const iniData: IniFile<any> = await parser.read(filePath);
  iniData.data['Logging.Console']['Enabled'] = true;
  return parser.write(filePath, iniData);
}
