import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import proxy from 'http2-proxy';
import { dirname } from 'path';
import { defineConfig } from 'vite';
import { prismjsPlugin } from 'vite-plugin-prismjs';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import svgr from 'vite-plugin-svgr';
import root from './build/utils/root';
import { version } from './package.json';

const target = 'http://127.0.0.1:2333/';
const targetUrl = new URL(target);
export default defineConfig({
  base: '/vite/',
  publicDir: 'static',
  server: { https: true },
  define: {
    'process.env.VERSION': JSON.stringify(version),
  },
  plugins: [
    svgr(),
    react(),
    basicSsl(),
    prismjsPlugin({
      languages: 'all',
      plugins: ['toolbar', 'line-highlight'],
    }),
    {
      name: 'ServerProxy',
      configureServer(server) {
        // server.httpServer.on('upgrade', (req, socket, head) => {
        //   proxy.ws(req, socket as any, head, {
        //     hostname: targetUrl.hostname,
        //     port: +targetUrl.port,
        //   });
        // });
        server.middlewares.use('/', (req, res, next) => {
          if (req.url.startsWith('/vite/')) {
            next();
            return;
          }
          const url = req.url.replace(/^\/+/, '');
          const { pathname, search } = new URL(url, target);
          proxy.web(
            req,
            res,
            {
              protocol: targetUrl.protocol.slice(0, -1) as 'http' | 'https',
              port: +targetUrl.port,
              hostname: targetUrl.hostname,
              path: pathname + search,
            },
            (err) => err && next(err),
          );
        });
      },
    },
    viteStaticCopy({
      targets: [
        { src: root('components/navigation/nav-logo-small_dark.png'), dest: 'components/navigation/nav-logo-small_dark.png' },
        { src: root(`${dirname(require.resolve('streamsaver/package.json'))}/mitm.html`), dest: 'streamsaver/mitm.html' },
        { src: root(`${dirname(require.resolve('streamsaver/package.json'))}/sw.js`), dest: 'streamsaver/sw.js' },
        { src: root(`${dirname(require.resolve('vditor/package.json'))}/dist`), dest: 'vditor/dist' },
        { src: root(`${dirname(require.resolve('graphiql/package.json'))}/graphiql.min.css`), dest: 'graphiql.min.css' },
        { src: `${dirname(require.resolve('monaco-themes/package.json'))}/themes`, dest: 'monaco/themes/' },
      ],
    }),
  ],
  resolve: {
    alias: {
      vj: root(),
    },
  },
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        hydro: './entry.js',
        'service-worker': './service-worker.ts',
        'messages-shared-worker': './components/message/worker.ts',
      },
    },
  },
  css: {
    preprocessorOptions: {
      styl: {
        imports: [require.resolve('rupture/rupture/index.styl'), root('common/common.inc.styl')],
      },
    },
  },
});