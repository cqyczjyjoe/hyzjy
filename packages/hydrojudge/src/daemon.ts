/* eslint-disable import/no-duplicates */
/* eslint-disable no-constant-condition */
/* eslint-disable no-await-in-loop */
/*                        ..
                        .' @`._
         ~       ...._.'  ,__.-;
      _..- - - /`           .-'    ~
     :     __./'       ,  .'-'- .._
  ~   `- -(.-'''- -.    \`._       `.   ~
    _.- '(  .______.'.-' `-.`         `.
   :      `-..____`-.                   ;
   `.             ````  稻花香里说丰年，  ;   ~
     `-.__          听取人生经验。  __.-'
          ````- - -.......- - -'''    ~
       ~                   */
import './utils';

import PQueue from 'p-queue';
import { gte } from 'semver';
import { fs } from '@hydrooj/utils';
import * as sysinfo from '@hydrooj/utils/lib/sysinfo';
import { getConfig } from './config';
import HydroHost from './hosts/hydro';
import log from './log';
import client from './sandbox/client';

const hosts: Record<string, HydroHost> = {};
let exit = false;

const terminate = async () => {
    log.info('正在保存数据');
    try {
        await Promise.all(Object.values(hosts).map((f) => f.dispose?.()));
        process.exit(1);
    } catch (e) {
        if (exit) process.exit(1);
        log.error(e.stack);
        log.error('发生了错误。');
        log.error('再次按下 Ctrl-C 可强制退出。');
        exit = true;
    }
};
process.on('SIGINT', terminate);
process.on('SIGTERM', terminate);
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise ', p);
});

async function daemon() {
    const _hosts = getConfig('hosts');
    let sandboxVersion = '1.0.0';
    let sandboxCgroup = 0;
    try {
        const version = await client.version();
        sandboxVersion = version.buildVersion.split('v')[1];
        const config = await client.config();
        sandboxCgroup = config.runnerConfig?.cgroupType || 0;
    } catch (e) {
        log.error('Your sandbox version is tooooooo low! Please upgrade!');
        process.exit(1);
    }
    const { osinfo } = await sysinfo.get();
    if (sandboxCgroup === 2) {
        const kernelVersion = osinfo.kernel.split('-')[0];
        if (!(gte(kernelVersion, '5.19.0') && gte(sandboxVersion, '1.6.10'))) {
            log.warn('You are using cgroup v2 without kernel 5.19+. This could result in inaccurate memory usage measurements.');
        }
    }
    const queue = new PQueue({ concurrency: Infinity });
    await fs.ensureDir(getConfig('tmp_dir'));
    queue.on('error', (e) => log.error(e));
    for (const i in _hosts) {
        _hosts[i].host ||= i;
        hosts[i] = new HydroHost(_hosts[i]);
        await hosts[i].init();
    }
    for (const i in hosts) hosts[i].consume(queue);
}

if (require.main === module) daemon();
export = daemon;
