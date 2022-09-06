/* eslint-disable no-await-in-loop */
import { PassThrough } from 'stream';
import { JSDOM } from 'jsdom';
import * as superagent from 'superagent';
import proxy from 'superagent-proxy';
import { STATUS } from '@hydrooj/utils/lib/status';
import {
    parseMemoryMB, parseTimeMS, sleep,
} from '@hydrooj/utils/lib/utils';
import { Logger } from 'hydrooj/src/logger';
import { IBasicProvider, RemoteAccount } from '../interface';
import { VERDICT } from '../verdict';

proxy(superagent as any);
const logger = new Logger('remote/csgoj');
const statusDict = {
    4: 'Accepted',
    5: 'PRESENTATION ERROR',
    6: 'WRONG ANSWER',
    7: 'TIME LIMIT EXCEEDED',
    8: 'MEMORY LIMIT EXCEEDED',
    9: 'OUTPUT LIMIT EXCEEDED',
    10: 'RUNTIME ERROR',
    11: 'COMPILE ERROR',
    0: 'PENDING',
    1: 'PENDING',
    2: 'SUBMITTED',
    3: 'JUDGING',
};

export default class POJProvider implements IBasicProvider {
    constructor(public account: RemoteAccount, private save: (data: any) => Promise<void>) {
        if (account.cookie) this.cookie = account.cookie;
    }

    cookie: string[] = [];

    get(url: string) {
        logger.debug('get', url);
        if (!url.includes('//')) url = `${this.account.endpoint || 'https://cpc.csgrandeur.cn'}${url}`;
        const req = superagent.get(url).set('Cookie', this.cookie);
        if (this.account.proxy) return req.proxy(this.account.proxy);
        return req;
    }

    post(url: string) {
        logger.debug('post', url, this.cookie);
        if (!url.includes('//')) url = `${this.account.endpoint || 'https://cpc.csgrandeur.cn'}${url}`;
        const req = superagent.post(url).set('Cookie', this.cookie).type('form');
        if (this.account.proxy) return req.proxy(this.account.proxy);
        return req;
    }

    async getCsrfToken(url: string) {
        const { header } = await this.get(url);
        if (header['set-cookie']) {
            await this.save({ cookie: header['set-cookie'] });
            this.cookie = header['set-cookie'];
        }
        return '';
    }

    get loggedIn() {
        return this.get('/').then(({ text: html }) => !html
            .includes('<form id="login_form" class="form-signin" method="post" action="/csgoj/user/login_ajax">'));
    }

    async ensureLogin() {
        if (await this.loggedIn) return true;
        logger.info('retry login');
        await this.getCsrfToken('/');
        await this.post('/csgoj/user/login_ajax')
            .set('referer', 'https://cpc.csgrandeur.cn/')
            .set('X-Requested-With', 'XMLHttpRequest')
            .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0')
            .set('Host', 'cpc.csgrandeur.cn')
            .send({
                user_id: this.account.handle,
                password: this.account.password,
            });
        return this.loggedIn;
    }

    async getProblem(id: string) {
        logger.info(id);
        const res = await this.get(`/csgoj/problemset/problem?pid=${id.split('P')[1]}`);
        const { window: { document } } = new JSDOM(res.text);
        const files = {};
        const contents = {};
        let content = '';
        const title = document.getElementsByTagName('title')[0].innerHTML.replace(`${id.split('P')[1]}:`, '');
        const pDescription = document.querySelector('div[name="Description"]');
        const images = {};
        pDescription.querySelectorAll('img[src]').forEach((ele) => {
            let src = ele.getAttribute('src').replace('.svg', '.png');
            if (!src.startsWith('https')) src = `https://cpc.csgrandeur.cn${src}`;
            if (images[src]) {
                ele.setAttribute('src', `/d/csgoj/p/${id}/file/${images[src]}.png`);
                return;
            }
            const file = new PassThrough();
            this.get(src).pipe(file);
            const fid = String.random(8);
            images[src] = fid;
            files[`${fid}.png`] = file;
            ele.setAttribute('src', `/d/csgoj/p/${id}/file/${fid}.png`);
        });
        const description = pDescription.innerHTML.trim().replace('                        ', '');
        const input = document.querySelector('div[name="Input"]').innerHTML.trim().replace('                        ', '');
        const output = document.querySelector('div[name="Output"]').innerHTML.trim().replace('                        ', '');
        const sampleInput = `\n\n\`\`\`input1\n${document.querySelector('div[name="Sample Input"]>pre').innerHTML.trim()}\n\`\`\``;
        const sampleOutput = `\n\n\`\`\`output1\n${document.querySelector('div[name="Sample Output"]>pre').innerHTML.trim()}\n\`\`\``;
        content += `${description}\n\n${input}\n\n${output}\n\n${sampleInput}\n\n${sampleOutput}`;
        const hint = document.querySelector('div[name="Hint"]');
        if (hint.textContent.trim().length > 4) {
            content += `\n\n${document.querySelector('div[name="Hint"]').innerHTML.trim().replace('                        ', '')}`;
        }
        contents['zh'] = content;
        const tag = document.querySelector('div[name="Source"]>a').textContent;
        const limit = document.querySelectorAll('span[class="inline_span"]');
        const time = limit[0].textContent.split(' ')[6];
        const memory = limit[1].textContent.split(' ')[2];
        return {
            title,
            data: {
                'config.yaml': Buffer.from(`time: ${time}\nmemory: ${memory}\ntype: remote_judge\nsubType: csgoj\ntarget: ${id}`),
            },
            files,
            tag: [tag],
            content: JSON.stringify(contents),
        };
    }

    async listProblem(page: number, resync = false) {
        if (resync && page > 1) return [];
        const offset = (page - 1) * 100;
        const result = await this
            .get(`https://cpc.csgrandeur.cn/csgoj/problemset/problemset_ajax?search=&sort=problem_id&order=asc&offset=${offset}&limit=100`)
            .set('referer', 'https://cpc.csgrandeur.cn/csgoj/problemset')
            .set('X-Requested-With', 'XMLHttpRequest')
            .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0')
            .set('Host', 'cpc.csgrandeur.cn');
        const res = result.body.rows;
        if (res.length === 0) return [];
        const pli: string[] = Array.from(res.map((i) => `P${+i.problem_id}`));
        return pli;
    }

    async submitProblem(id: string, lang: string, code: string) {
        await this.ensureLogin();
        const language = lang.includes('csgoj.') ? lang.split('csgoj.')[1] : '0';
        code = Buffer.from(code).toString('utf-8');
        const result = await this.post('/csgoj/Problemset/submit_ajax')
            .set('X-Requested-With', 'XMLHttpRequest')
            .set('referer', `https://cpc.csgrandeur.cn/csgoj/problemset/submit?pid=${id.split('P')[1]}`)
            .send({
                pid: id.split('P')[1],
                language,
                source: code,
            });
        return result.body.data.solution_id;
    }

    // eslint-disable-next-line consistent-return
    async waitForSubmission(id: string, end) {
        let count = 0;
        // eslint-disable-next-line no-constant-condition
        while (count < 60) {
            count++;
            await sleep(3000);
            const result = await this
                // eslint-disable-next-line max-len
                .get(`/csgoj/Status/status_ajax?sort=solution_id_show&order=desc&offset=0&limit=20&problem_id=&user_id=&solution_id=${id}&language=-1&result=-1`)
                .set('X-Requested-With', 'XMLHttpRequest')
                .set('referer', 'https://cpc.csgrandeur.cn/csgoj/status');
            const stat = result.body.rows[0].result;
            const res = statusDict[stat];
            const status = VERDICT[res] || STATUS.STATUS_SYSTEM_ERROR;
            if (status === STATUS.STATUS_JUDGING) continue;
            const memory = parseMemoryMB(`${result.body.rows[0].memory}K`) * 1024;
            const time = parseTimeMS(`${result.body.rows[0].time}MS`);
            return await end({
                status,
                score: status === STATUS.STATUS_ACCEPTED ? 100 : 0,
                time,
                memory,
            });
        }
    }
}
