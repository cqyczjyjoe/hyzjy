import { inspect } from 'util';

declare global {
    interface StringConstructor {
        random: (digit?: number) => string;
    }
    interface String {
        format: (...args: Array<any>) => string;
        formatFromArray: (args: any[]) => string;
        rawformat: (object: any) => string;
    }
    interface ArrayConstructor {
        isDiff: (a: any[], b: any[]) => boolean;
    }
    interface Date {
        format: (fmt?: string) => string;
    }
    interface Math {
        sum: (...args: Array<number[] | number>) => number;
    }
    interface SetConstructor {
        isSuperset: (set: Set<any>, subset: Set<any>) => boolean;
        intersection: <T>(setA: Set<T> | Array<T>, setB: Set<T> | Array<T>) => Set<T>;
        union: <T>(setA: Set<T> | Array<T>, setB: Set<T> | Array<T>) => Set<T>;
    }
}

const defaultDict = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

String.random = function random(digit = 32, dict = defaultDict) {
    let str = '';
    for (let i = 1; i <= digit; i++) str += dict[Math.floor(Math.random() * dict.length)];
    return str;
};

String.prototype.format = function formatStr(...args) {
    let result = this;
    if (args.length) {
        if (args.length === 1 && typeof args[0] === 'object') {
            const t = args[0];
            for (const key in t) {
                if (!key.startsWith('_') && t[key] !== undefined) {
                    if (t._inspect && typeof t[key] === 'object') {
                        t[key] = inspect(t[key], { colors: process?.stderr?.isTTY });
                    }
                    const reg = new RegExp(`(\\{${key}\\})`, 'g');
                    result = result.replace(reg, t[key]);
                }
            }
        } else return this.formatFromArray(args);
    }
    return result;
};

String.prototype.formatFromArray = function formatStr(args) {
    let result = this;
    for (let i = 0; i < args.length; i++) {
        if (args[i] !== undefined) {
            const reg = new RegExp(`(\\{)${i}(\\})`, 'g');
            result = result.replace(reg, args[i]);
        }
    }
    return result;
};

String.prototype.rawformat = function rawFormat(object) {
    const res = this.split('{@}');
    return [res[0], object, res[1]].join();
};

Array.isDiff = function isDiff(a, b) {
    if (a.length !== b.length) return true;
    a.sort();
    b.sort();
    for (const i in a) {
        if (a[i] !== b[i]) return true;
    }
    return false;
};

Date.prototype.format = function formatDate(fmt = '%Y-%m-%d %H:%M:%S') {
    let m = this.getMonth() + 1;
    if (m < 10) m = `0${m}`;
    let d = this.getDate();
    if (d < 10) d = `0${d}`;
    let H = this.getHours();
    if (H < 10) H = `0${H}`;
    let M = this.getMinutes();
    if (M < 10) M = `0${M}`;
    let S = this.getSeconds();
    if (S < 10) S = `0${S}`;
    return fmt
        .replace('%Y', this.getFullYear())
        .replace('%m', m)
        .replace('%d', d)
        .replace('%H', H)
        .replace('%M', M)
        .replace('%S', S);
};

Math.sum = function sum(...args) {
    let s = 0;
    for (const i of args) {
        if (i instanceof Array) {
            for (const j of i) {
                s += j;
            }
        } else s += i;
    }
    return s;
};

Set.isSuperset = function isSuperset(set, subset) {
    for (const elem of subset) {
        if (!set.has(elem)) return false;
    }
    return true;
};

Set.union = function Union<T>(setA: Set<T> | Array<T>, setB: Set<T> | Array<T>) {
    const union = new Set(setA);
    for (const elem of setB) union.add(elem);
    return union;
};

Set.intersection = function Intersection<T>(A: Set<T> | Array<T> = [], B: Set<T> | Array<T> = []) {
    const intersection = new Set<T>();
    if (A instanceof Array) A = new Set(A);
    if (B instanceof Array) B = new Set(B);
    for (const elem of B) if (A.has(elem)) intersection.add(elem);
    return intersection;
};

const TIME_RE = /^([0-9]+(?:\.[0-9]*)?)([mu]?)s?$/i;
const TIME_UNITS = { '': 1000, m: 1, u: 0.001 };
const MEMORY_RE = /^([0-9]+(?:\.[0-9]*)?)([kmg])b?$/i;
const MEMORY_UNITS = { k: 1 / 1024, m: 1, g: 1024 };

export function parseTimeMS(str: string | number) {
    if (typeof str === 'number') return str;
    const match = TIME_RE.exec(str);
    if (!match) throw new Error(`${str} error parsing time`);
    return Math.floor(parseFloat(match[1]) * TIME_UNITS[match[2].toLowerCase()]);
}

export function parseMemoryMB(str: string | number) {
    if (typeof str === 'number') return str;
    const match = MEMORY_RE.exec(str);
    if (!match) throw new Error(`${str} error parsing memory`);
    return Math.ceil(parseFloat(match[1]) * MEMORY_UNITS[match[2].toLowerCase()]);
}

export function size(s: number, base = 1) {
    s *= base;
    const unit = 1024;
    const unitNames = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    for (const unitName of unitNames) {
        if (s < unit) return '{0} {1}'.format(Math.round(s * 10) / 10, unitName);
        s /= unit;
    }
    return `${Math.round(s * unit)} ${unitNames[unitNames.length - 1]}`;
}

interface Re0 {
    reg: RegExp,
    output: ((a: RegExpExecArray) => string)[],
    id: (a: RegExpExecArray) => number,
}

interface Re1 extends Re0 {
    subtask: (a: RegExpExecArray) => number,
}

const RE0: Re0[] = [
    {
        reg: /^([^\d]*)(\d+).(in|txt)$/,
        output: [
            (a) => `${a[1] + a[2]}.out`,
            (a) => `${a[1] + a[2]}.ans`,
            (a) => `${a[1] + a[2]}.out`.replace(/input/g, 'output'),
            (a) => (a[1].includes('input') ? `${a[1] + a[2]}.txt`.replace(/input/g, 'output') : null),
        ],
        id: (a) => +a[2],
    },
    {
        reg: /^([^\d]*)\.in(\d+)$/,
        output: [
            (a) => `${a[1]}.ou${a[2]}`,
            (a) => `${a[1]}.ou${a[2]}`.replace(/input/g, 'output'),
        ],
        id: (a) => +a[2],
    },
];
const RE1: Re1[] = [
    {
        reg: /^([^\d]*)([0-9]+)([-_])([0-9]+).in$/,
        output: [(a) => `${a[1] + a[2]}${a[3]}${a[4]}.out`],
        subtask: (a) => +a[2],
        id: (a) => +a[4],
    },
];

export async function readCasesFromFiles(files: string[], checkFile, cfg) {
    const cases = [];
    for (const file of files) {
        for (const REG of RE0) {
            if (REG.reg.test(file)) {
                const data = REG.reg.exec(file);
                const c = { input: file, output: '', id: REG.id(data) };
                for (const func of REG.output) {
                    if (cfg.noOutputFile) c.output = '/dev/null';
                    else c.output = func(data);
                    if (c.output && (c.output === '/dev/null' || checkFile(c.output))) {
                        cases.push(c);
                        break;
                    }
                }
            }
        }
    }
    cases.sort((a, b) => (a.id - b.id));
    const extra = cases.length - (100 % cases.length);
    const config = {
        count: 0,
        subtasks: [{
            time: parseTimeMS(cfg.time || '1s'),
            memory: parseMemoryMB(cfg.memory || '256m'),
            type: 'sum',
            cases: [],
            score: Math.floor(100 / cases.length),
        }],
    };
    for (let i = 0; i < extra; i++) {
        config.count++;
        config.subtasks[0].cases.push({
            id: config.count,
            input: checkFile(cases[i].input),
            output: checkFile(cases[i].output),
        });
    }
    if (extra < cases.length) {
        config.subtasks.push({
            time: parseTimeMS(cfg.time || '1s'),
            memory: parseMemoryMB(cfg.memory || '256m'),
            type: 'sum',
            cases: [],
            score: Math.floor(100 / cases.length) + 1,
        });
        for (let i = extra; i < cases.length; i++) {
            config.count++;
            config.subtasks[1].cases.push({
                id: config.count,
                input: checkFile(cases[i].input),
                output: checkFile(cases[i].output),
            });
        }
    }
    return config;
}

export async function readSubtasksFromFiles(files: string[], checkFile, cfg, rst) {
    const subtask = {};
    for (const s of rst.subtasks) if (s.id) subtask[s.id] = s;
    const subtasks = [];
    for (const file of files) {
        for (const REG of RE1) {
            if (REG.reg.test(file)) {
                const data = REG.reg.exec(file);
                const sid = REG.subtask(data);
                const c = { input: file, output: '', id: REG.id(data) };
                for (const func of REG.output) {
                    if (cfg.noOutputFile) c.output = '/dev/null';
                    else c.output = func(data);
                    if (c.output === '/dev/null' || checkFile(c.output)) {
                        if (!subtask[sid]) {
                            subtask[sid] = {
                                time: parseTimeMS(cfg.time || '1s'),
                                memory: parseMemoryMB(cfg.memory || '256m'),
                                type: 'min',
                                cases: [c],
                            };
                        } else if (!subtask[sid].cases) subtask[sid].cases = [c];
                        else subtask[sid].cases.push(c);
                        break;
                    }
                }
            }
        }
    }
    for (const i in subtask) {
        subtask[i].cases.sort((a, b) => (a.id - b.id));
        subtasks.push(subtask[i]);
    }
    const base = Math.floor(100 / subtasks.length);
    const extra = subtasks.length - (100 % subtasks.length);
    const config = { count: 0, subtasks };
    const keys = Object.keys(subtask);
    for (let i = 0; i < keys.length; i++) {
        if (i >= extra) subtask[keys[i]].score = base + 1;
        else subtask[keys[i]].score = base;
        for (const j of subtask[keys[i]].cases) {
            config.count++;
            j.input = checkFile(j.input);
            j.output = checkFile(j.output);
            j.id = config.count;
        }
    }
    return config;
}