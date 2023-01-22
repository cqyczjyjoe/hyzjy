import { DOMWindow, JSDOM } from 'jsdom';
import proxy from 'superagent-proxy';
import { Logger, prochain } from '@hydrooj/utils';
import { superagent } from 'hydrooj';
import { RemoteAccount } from './interface';

proxy(superagent);

interface FetchOptions {
    headers?: { [key: string]: string };
    post?: Omit<FetchOptions, 'get' | 'post'>
    get?: Omit<FetchOptions, 'get' | 'post'>
}

export class BasicFetcher {
    cookie: string[] = [];

    constructor(
        public account: RemoteAccount, private defaultEndpoint: string,
        private formType: 'form' | 'json', public logger: Logger,
        public fetchOptions: FetchOptions = {},
    ) {
        if (account.cookie) this.cookie = account.cookie;
    }

    get(url: string) {
        this.logger.debug('get', url);
        url = new URL(url, this.account.endpoint || this.defaultEndpoint).toString();
        let req = superagent.get(url).set('Cookie', this.cookie);
        if (this.fetchOptions.headers) req = req.set(this.fetchOptions.headers);
        if (this.fetchOptions.get?.headers) req = req.set(this.fetchOptions.get.headers);
        return this.account.proxy ? req.proxy(this.account.proxy) : req;
    }

    private async _html(url: string) {
        const { text: html } = await this.get(url);
        const $dom = new JSDOM(html);
        $dom.window.html = html;
        return $dom.window as DOMWindow & { html: string };
    }

    html(url: string) {
        return prochain(this._html)(url);
    }

    post(url: string) {
        this.logger.debug('post', url, this.cookie);
        url = new URL(url, this.account.endpoint || this.defaultEndpoint).toString();
        let req = superagent.post(url).set('Cookie', this.cookie).type(this.formType);
        if (this.fetchOptions.headers) req = req.set(this.fetchOptions.headers);
        if (this.fetchOptions.post?.headers) req = req.set(this.fetchOptions.post.headers);
        return this.account.proxy ? req.proxy(this.account.proxy) : req;
    }
}
