import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { Duplex, PassThrough } from 'stream';
import { inspect } from 'util';
import type AdmZip from 'adm-zip';
import fs from 'fs-extra';
import moment, { isMoment, Moment } from 'moment-timezone';
import { ObjectId } from 'mongodb';
import Logger from 'reggol';
import type * as superagent from 'superagent';
export * as yaml from 'js-yaml';
export * as fs from 'fs-extra';

Logger.levels.base = process.env.DEV ? 3 : 2;
Logger.targets[0].showTime = 'dd hh:mm:ss';
Logger.targets[0].label = {
    align: 'right',
    width: 9,
    margin: 1,
};

export { Logger, moment };

const encrypt = (algorithm, content) => crypto.createHash(algorithm).update(content).digest('hex');
export const sha1 = (content: string) => encrypt('sha1', content);
export const md5 = (content: string) => encrypt('md5', content);

export function folderSize(folderPath: string) {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let size = 0;
    const _next = function a(p: string) {
        if (p) {
            const stats = fs.statSync(p);
            if (!stats.isDirectory() || stats.isSymbolicLink()) {
                if (!stats.isSymbolicLink()) size += stats.size;
            } else {
                size += stats.size;
                const files = fs.readdirSync(p);
                if (Array.isArray(files)) {
                    for (const file of files) _next(path.join(p, file));
                }
            }
        }
    };
    _next(folderPath);
    return size;
}

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
    return result.toString();
};

export function isClass(obj: any, strict = false): obj is new (...args: any) => any {
    if (typeof obj !== 'function') return false;
    if (obj.prototype === undefined) return false;
    if (obj.prototype.constructor !== obj) return false;
    if (Object.getOwnPropertyNames(obj.prototype).length >= 2) return true;
    const str = obj.toString();
    if (str.slice(0, 5) === 'class') return true;
    if (/^function\s+\(|^function\s+anonymous\(/.test(str)) return false;
    if (strict && /^function\s+[A-Z]/.test(str)) return true;
    if (/\b\(this\b|\bthis[.[]\b/.test(str)) {
        if (!strict || /classCallCheck\(this/.test(str)) return true;
        return /^function\sdefault_\d+\s*\(/.test(str);
    }
    return false;
}

function isSuperagentRequest(t: NodeJS.ReadableStream | superagent.Request): t is superagent.Request {
    return 'req' in t;
}
export function streamToBuffer(input: NodeJS.ReadableStream | superagent.Request, maxSize = 0): Promise<Buffer> {
    let stream: NodeJS.ReadableStream;
    if (isSuperagentRequest(input)) {
        const s = new PassThrough();
        input.pipe(s);
        stream = s;
    } else stream = input;
    return new Promise((resolve, reject) => {
        const buffers = [];
        let length = 0;
        function onData(data) {
            buffers.push(data);
            length += data.length;
            if (maxSize && length > maxSize) {
                stream.removeListener('data', onData);
                reject(new Error('buffer length exceeded'));
            }
        }
        stream.on('error', reject);
        stream.on('data', onData);
        stream.on('end', () => resolve(Buffer.concat(buffers)));
    });
}

export function bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
    const stream = new Duplex();
    stream.push(buffer);
    stream.push(null);
    return stream;
}

export namespace Time {
    export const second = 1000;
    export const minute = second * 60;
    export const hour = minute * 60;
    export const day = hour * 24;
    export const week = day * 7;
    export function formatTimeShort(ms: number) {
        const abs = Math.abs(ms);
        if (abs >= day - hour / 2) return `${Math.round(ms / day)}d`;
        if (abs >= hour - minute / 2) return `${Math.round(ms / hour)}h`;
        if (abs >= minute - second / 2) return `${Math.round(ms / minute)}m`;
        if (abs >= second) return `${Math.round(ms / second)}s`;
        return `${ms}ms`;
    }

    export function getObjectID(timestamp: string | Date | Moment, allZero = true) {
        let _timestamp: number;
        if (typeof timestamp === 'string') _timestamp = new Date(timestamp).getTime();
        else if (isMoment(timestamp)) _timestamp = timestamp.toDate().getTime();
        else _timestamp = timestamp.getTime();
        const hexSeconds = Math.floor(_timestamp / 1000).toString(16);
        return new ObjectId(`${hexSeconds}${allZero ? '0000000000000000' : new ObjectId().toHexString().substr(8)}`);
    }
}

export function errorMessage(err: Error | string) {
    const t = typeof err === 'string' ? err : err.stack;
    const lines = t.split('\n')
        .filter((i) => !i.includes(' (node:') && !i.includes('(internal'));
    let cursor = 1;
    let count = 0;
    while (cursor < lines.length) {
        if (lines[cursor] !== lines[cursor - 1]) {
            if (count) {
                lines[cursor - 1] += ` [+${count}]`;
                count = 0;
            }
            cursor++;
        } else {
            count++;
            lines.splice(cursor, 1);
        }
    }
    const parsed = lines.join('\n')
        .replace(/[A-Z]:\\.+\\@hydrooj\\/g, '@hydrooj\\')
        .replace(/\/.+\/@hydrooj\//g, '\\')
        .replace(/[A-Z]:\\.+\\hydrooj\\/g, 'hydrooj\\')
        .replace(/\/.+\/hydrooj\//g, 'hydrooj/')
        .replace(/[A-Z]:\\.+\\node_modules\\/g, '')
        .replace(/\/.+\/node_modules\//g, '')
        .replace(/\\/g, '/');
    if (typeof err === 'string') return parsed;
    err.stack = parsed;
    return err;
}

export function changeErrorType(err: any, Err: any) {
    const e = new Err(err.message);
    e.stack = err.stack;
    if (err.params) e.params = err.params;
    return e;
}

export async function findFile(pathname: string, doThrow = true) {
    if (await fs.pathExists(path.resolve(pathname))) return path.resolve(pathname);
    if (await fs.pathExists(path.resolve(process.cwd(), pathname))) return path.resolve(process.cwd(), pathname);
    if (await fs.pathExists(path.resolve(__dirname, pathname))) return path.resolve(__dirname, pathname);
    try {
        return require.resolve(pathname);
    } catch (e) { }
    if (pathname.includes('/')) {
        const eles = pathname.split('/');
        let pkg = eles.shift();
        if (pkg.startsWith('@')) pkg = `${pkg}/${eles.shift()}`;
        const rest = eles.join('/');
        try {
            const p = path.dirname(require.resolve(path.join(pkg, 'package.json')));
            if (await fs.pathExists(path.resolve(p, rest))) return path.resolve(p, rest);
        } catch (e) { }
    }
    if (await fs.pathExists(path.resolve(os.homedir(), pathname))) return path.resolve(os.homedir(), pathname);
    if (await fs.pathExists(path.resolve(os.homedir(), '.hydro', pathname))) return path.resolve(os.homedir(), '.hydro', pathname);
    // eslint-disable-next-line max-len
    if (await fs.pathExists(path.resolve(os.homedir(), '.config', 'hydro', pathname))) return path.resolve(os.homedir(), '.config', 'hydro', pathname);
    if (doThrow) throw new Error(`File ${pathname} not found`);
    return null;
}

export function findFileSync(pathname: string, doThrow: boolean | Error = true) {
    if (fs.pathExistsSync(path.resolve(pathname))) return path.resolve(pathname);
    if (fs.pathExistsSync(path.resolve(process.cwd(), pathname))) return path.resolve(process.cwd(), pathname);
    if (fs.pathExistsSync(path.resolve(__dirname, pathname))) return path.resolve(__dirname, pathname);
    try {
        return require.resolve(pathname);
    } catch (e) { }
    if (pathname.includes('/')) {
        const eles = pathname.split('/');
        let pkg = eles.shift();
        if (pkg.startsWith('@')) pkg = `${pkg}/${eles.shift()}`;
        const rest = eles.join('/');
        try {
            const p = path.dirname(require.resolve(path.join(pkg, 'package.json')));
            if (fs.statSync(path.resolve(p, rest))) return path.resolve(p, rest);
        } catch (e) { }
    }
    if (fs.pathExistsSync(path.resolve(os.homedir(), pathname))) return path.resolve(os.homedir(), pathname);
    if (fs.pathExistsSync(path.resolve(os.homedir(), '.hydro', pathname))) return path.resolve(os.homedir(), '.hydro', pathname);
    if (fs.pathExistsSync(path.resolve(os.homedir(), '.config', 'hydro', pathname))) return path.resolve(os.homedir(), '.config', 'hydro', pathname);
    if (doThrow) throw (typeof doThrow !== 'boolean' ? doThrow : new Error(`File ${pathname} not found`));
    return null;
}

export async function retry(func: Function, ...args: any[]): Promise<any>;
export async function retry(times: number, func: Function, ...args: any[]): Promise<any>;
// eslint-disable-next-line consistent-return
export async function retry(arg0: number | Function, func: any, ...args: any[]) {
    let res;
    if (typeof arg0 !== 'number') {
        args = [func, ...args];
        func = arg0;
        arg0 = 3;
    }
    for (let i = 1; i <= arg0; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            res = await func(...args);
        } catch (e) {
            if (i === arg0) throw e;
            continue;
        }
        return res;
    }
}

export function CallableInstance(property = '__call__') {
    let func;
    if (typeof property === 'function') func = property;
    else func = this.constructor.prototype[property];
    const apply = function __call__(...args) { return func.apply(apply, ...args); };
    Object.setPrototypeOf(apply, this.constructor.prototype);
    for (const p of Object.getOwnPropertyNames(func)) {
        Object.defineProperty(apply, p, Object.getOwnPropertyDescriptor(func, p));
    }
    return apply;
}

CallableInstance.prototype = Object.create(Function.prototype);

export const htmlEncode = (str: string) => str.replace(/[&<>'"]/g,
    (tag: string) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    }[tag]));

export function Counter<T extends (string | number) = string>() {
    return new Proxy({}, {
        get: (target, prop) => {
            if (target[prop] === undefined) return 0;
            return target[prop];
        },
    }) as Record<T, number>;
}

function canonical(p: string) {
    if (!p) return '';
    const safeSuffix = path.posix.normalize(`/${p.split('\\').join('/')}`);
    return path.join('.', safeSuffix);
}

function sanitize(prefix: string, name: string) {
    prefix = path.resolve(path.normalize(prefix));
    const parts = name.split('/');
    for (let i = 0, l = parts.length; i < l; i++) {
        const p = path.normalize(path.join(prefix, parts.slice(i, l).join(path.sep)));
        if (p.indexOf(prefix) === 0) {
            return p;
        }
    }
    return path.normalize(path.join(prefix, path.basename(name)));
}

export function sanitizePath(pathname: string) {
    const parts = pathname.replace(/\\/g, '/').split('/').filter((i) => i && i !== '.' && i !== '..');
    return parts.join(path.sep);
}

/* eslint-disable no-await-in-loop */
export async function extractZip(zip: AdmZip, dest: string, overwrite = false, strip = false) {
    const entries = zip.getEntries();
    const shouldStrip = strip ? entries.every((i) => i.entryName.startsWith(entries[0].entryName)) : false;
    for (const entry of entries) {
        const name = shouldStrip ? entry.entryName.substring(entries[0].entryName.length) : entry.entryName;
        const d = sanitize(dest, canonical(name));
        if (entry.isDirectory) {
            await fs.mkdir(d, { recursive: true });
            continue;
        }
        const content = entry.getData();
        if (!content) throw new Error('CANT_EXTRACT_FILE');
        if (!fs.existsSync(d) || overwrite) await fs.writeFile(d, content);
        await fs.utimes(d, entry.header.time, entry.header.time);
    }
}

export async function pipeRequest(req: superagent.Request, w: fs.WriteStream, timeout?: number, name?: string) {
    try {
        await new Promise((resolve, reject) => {
            req.buffer(false).timeout({
                response: Math.min(10000, timeout),
                deadline: timeout,
            }).parse((resp, cb) => {
                if (resp.statusCode !== 200) throw new Error(`${resp.statusCode}`);
                else {
                    resp.pipe(w);
                    resp.on('end', () => {
                        cb(null, undefined);
                        resolve(null);
                    });
                    resp.on('error', (err) => {
                        cb(err, undefined);
                    });
                }
            }).catch(reject);
        });
    } catch (e) {
        throw new Error(`Download${e.errno === 'ETIMEDOUT' ? 'Timedout' : 'Error'}(${name ? `${name}, ` : ''}${e.message})`);
    }
}

export * from '@hydrooj/utils/lib/common';
