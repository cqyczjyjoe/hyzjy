/* eslint-disable import/no-dynamic-require */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-eval */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    } else if (!fs.statSync(dir).isDirectory()) {
        fs.unlinkSync(dir);
        fs.mkdirSync(dir);
    }
}

function superRequire(p) {
    // eslint-disable-next-line camelcase
    if (typeof __non_webpack_require__ === 'function') {
        // eslint-disable-next-line no-undef
        return __non_webpack_require__(p);
    } return require(p);
}

let pending = [];
const active = [];
const fail = [];

async function handler() {
    for (const i of pending) {
        const p = `${os.tmpdir()}/hydro/tmp/${i}/handler.js`;
        if (fs.existsSync(p) && i.fail) {
            try {
                console.log(`Handler init: ${i}`);
                console.time(`Handler init: ${i}`);
                superRequire(p);
                console.timeEnd(`Handler init: ${i}`);
            } catch (e) {
                fail.push(i);
                console.error(`Handler Load Fail: ${i}`);
            }
        }
    }
}

async function locale() {
    for (const i of pending) {
        const p = `${os.tmpdir()}/hydro/tmp/${i}/locale.json`;
        if (fs.existsSync(p) && i.fail) {
            try {
                global.Hydro.lib.i18n(superRequire(p));
                console.log(`Locale init: ${i}`);
            } catch (e) {
                fail.push(i);
                console.error(`Locale Load Fail: ${i}`);
            }
        }
    }
}

async function template() {
    for (const i of pending) {
        const p = `${os.tmpdir()}/hydro/tmp/${i}/template.json`;
        if (fs.existsSync(p) && !i.fail) {
            try {
                Object.assign(global.Hydro.template, superRequire(p));
                console.log(`Template init: ${i}`);
            } catch (e) {
                fail.push(i);
                console.error(`Template Load Fail: ${i}`);
            }
        }
    }
}

async function model() {
    for (const i of pending) {
        const p = `${os.tmpdir()}/hydro/tmp/${i}/model.js`;
        if (fs.existsSync(p) && !i.fail) {
            try {
                console.log(`Model init: ${i}`);
                console.time(`Model init: ${i}`);
                superRequire(p);
                console.timeEnd(`Model init: ${i}`);
            } catch (e) {
                fail.push(i);
                console.error(`Model Load Fail: ${i}`);
            }
        }
    }
}

async function lib() {
    for (const i of pending) {
        const p = `${os.tmpdir()}/hydro/tmp/${i}/lib.js`;
        if (fs.existsSync(p) && !i.fail) {
            try {
                console.log(`Lib init: ${i}`);
                console.time(`Lib init: ${i}`);
                superRequire(p);
                console.timeEnd(`Lib init: ${i}`);
            } catch (e) {
                fail.push(i);
                console.error(`Lib Load Fail: ${i}`);
            }
        }
    }
}

async function service() {
    for (const i of pending) {
        const p = `${os.tmpdir()}/hydro/tmp/${i}/service.js`;
        if (fs.existsSync(p) && !i.fail) {
            try {
                console.log(`Service init: ${i}`);
                console.time(`Service init: ${i}`);
                superRequire(p);
                console.timeEnd(`Service init: ${i}`);
            } catch (e) {
                fail.push(i);
                console.error(`Service Load Fail: ${i}`);
                console.error(e);
            }
        }
    }
}

async function script() {
    for (const i of pending) {
        const p = `${os.tmpdir()}/hydro/tmp/${i}/script.js`;
        if (fs.existsSync(p) && !i.fail) {
            try {
                console.time(`Script init: ${i}`);
                superRequire(p);
                console.timeEnd(`Script init: ${i}`);
            } catch (e) {
                fail.push(i);
                console.error(`Script Load Fail: ${i}`);
                console.error(e);
            }
        }
    }
}

async function install() {
    const setup = require('./service/setup');
    await setup.setup();
}

const builtinLib = [
    'axios', 'download', 'i18n', 'mail', 'markdown',
    'md5', 'misc', 'paginate', 'hash.hydro', 'rank',
    'template', 'validator', 'nav', 'sysinfo',
];

const builtinModel = [
    'builtin', 'document', 'domain', 'blacklist', 'opcount',
    'setting', 'token', 'user', 'problem', 'record',
    'contest', 'message', 'solution', 'training', 'file',
    'discussion', 'system',
];

const builtinHandler = [
    'home', 'problem', 'record', 'judge', 'user',
    'contest', 'training', 'discussion', 'manage', 'import',
    'misc', 'homework', 'domain',
];

const builtinScript = [
    'install', 'uninstall', 'rating', 'recalcRating', 'register',
    'blacklist',
];

async function loadAsMaster() {
    ensureDir(path.resolve(os.tmpdir(), 'hydro'));
    // TODO better run in another process as this needs lots of memory
    require('./unzip')();
    pending = await require('./lib/hpm').getInstalled();
    require('./lib/i18n');
    require('./utils');
    require('./error');
    require('./permission');
    await Promise.all([locale(), template()]);
    try {
        require('./options');
    } catch (e) {
        await install();
        require('./options');
    }
    const bus = require('./service/bus');
    await new Promise((resolve) => {
        const h = () => {
            console.log('Database connected');
            bus.unsubscribe(['system_database_connected'], h);
            resolve();
        };
        bus.subscribe(['system_database_connected'], h);
        require('./service/db');
    });
    for (const i of builtinLib) require(`./lib/${i}`);
    await lib();
    require('./service/monitor');
    await service();
    for (const i of builtinModel) {
        const m = require(`./model/${i}`);
        if (m.ensureIndexes) await m.ensureIndexes();
    }
    const system = require('./model/system');
    const dbVer = await system.get('db.ver');
    if (dbVer !== 1) {
        const ins = require('./script/install');
        await ins.run({ username: 'Root', password: 'rootroot' });
    }
    await model();
    for (const i in global.Hydro.service) {
        if (global.Hydro.service[i].postInit) {
            try {
                await global.Hydro.service[i].postInit();
            } catch (e) {
                console.error(e);
            }
        }
    }
    pending = [];
}

async function loadAsWorker() {
    pending = await require('./lib/hpm').getInstalled();
    require('./lib/i18n');
    require('./utils');
    require('./error');
    require('./permission');
    require('./options');
    await Promise.all([locale(), template()]);
    const bus = require('./service/bus');
    await new Promise((resolve) => {
        const h = () => {
            console.log('Database connected');
            bus.unsubscribe(['system_database_connected'], h);
            resolve();
        };
        bus.subscribe(['system_database_connected'], h);
        require('./service/db');
    });
    for (const i of builtinLib) require(`./lib/${i}`);
    await lib();
    require('./service/gridfs');
    const server = require('./service/server');
    await server.prepare();
    await service();
    for (const i of builtinModel) require(`./model/${i}`);
    for (const i of builtinHandler) require(`./handler/${i}`);
    await model();
    await handler();
    for (const i in global.Hydro.handler) {
        await global.Hydro.handler[i]();
    }
    const notfound = require('./handler/notfound');
    await notfound();
    for (const i in global.Hydro.service) {
        if (global.Hydro.service[i].postInit) {
            try {
                await global.Hydro.service[i].postInit();
            } catch (e) {
                console.error(e);
            }
        }
    }
    for (const i of builtinScript) require(`./script/${i}`);
    await script();
    pending = [];
    await server.start();
}

async function terminate() {
    for (const task of global.onDestory) {
        // eslint-disable-next-line no-await-in-loop
        await task();
    }
    process.exit(0);
}

async function load() {
    global.Hydro = {
        handler: {},
        service: {},
        model: {},
        script: {},
        lib: {},
        nodeModules: {
            bson: require('bson'),
            'js-yaml': require('js-yaml'),
            mongodb: require('mongodb'),
        },
        template: {},
        ui: {},
    };
    global.onDestory = [];
    if (cluster.isMaster) {
        console.log(`Master ${process.pid} Starting`);
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', async (input) => {
            try {
                const t = eval(input.toString().trim()); // eslint-disable-line no-eval
                if (t instanceof Promise) console.log(await t);
                else console.log(t);
            } catch (e) {
                console.warn(e);
            }
        });
        process.on('unhandledRejection', (e) => console.log(e));
        process.on('SIGINT', terminate);
        await loadAsMaster();
        cluster.on('exit', (worker, code, signal) => {
            console.log(`Worker ${worker.process.pid} exit: ${code} ${signal}`);
        });
        cluster.on('disconnect', (worker) => {
            console.log(`Worker ${worker.process.pid} disconnected`);
        });
        cluster.on('listening', (worker, address) => {
            console.log(`Worker ${worker.process.pid} listening at `, address);
        });
        cluster.on('online', (worker) => {
            console.log(`Worker ${worker.process.pid} is online`);
        });
        // FIXME this requires lots of memory
        for (let i = 0; i < numCPUs; i++) {
            cluster.fork();
        }
    } else {
        console.log(`Worker ${process.pid} Starting`);
        await loadAsWorker();
        console.log(`Worker ${process.pid} Started`);
    }
    if (global.gc) global.gc();
}

module.exports = {
    load, pending, active, fail,
};

if (!module.parent) {
    load().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
