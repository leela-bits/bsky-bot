// noinspection JSUnusedGlobalSymbols

import {defineLexiconConfig} from '@atcute/lex-cli';

export default defineLexiconConfig({
    generate: {
        files: ['lexicons/**/*.json'],
        outdir: 'src/lexicons',
        imports: ['@atcute/atproto', '@atcute/bluesky'],
    },
    pull: {
        outdir: 'lexicons/',
        clean: true,
        sources: [
            {
                type: 'git',
                remote: 'https://github.com/bluesky-social/atproto.git',
                ref: 'main',
                pattern: ['lexicons/**/*.json'],
            },
        ],
    },
});