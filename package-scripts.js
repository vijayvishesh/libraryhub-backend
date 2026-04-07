const { series, rimraf, } = require('nps-utils');

module.exports = {
    scripts: {
        default: 'nps start',
        /**
         * Starts the builded app from the dist directory.
         */
        start: {
            script: 'cross-env NODE_ENV=production node dist/app.js',
            description: 'Starts the builded app',
        },
        /**
         * Serves the current app and watches for changes to restart it
         */
        serve: {
            inspector: {
                script: series(
                    'nps banner.serve',
                    'nodemon --watch src --watch .env --inspect'
                ),
                description: 'Serves the current app and watches for changes to restart it, you may attach inspector to it.'
            },
            script: series(
                'nps banner.serve',
                'nodemon --watch src --watch .env'
            ),
            description: 'Serves the current app and watches for changes to restart it'
        },
        /**
         * Setup of the development environment
         */
        setup: {
            script: series(
                'yarn install',
                'nps db.setup',
            ),
            description: 'Setup`s the development environment(yarn & database)'
        },
        /**
         * Creates the needed configuration files
         */
        config: {
            script: series(
                runFast('./commands/tsconfig.ts'),
            ),
            hiddenFromHelp: true
        },
        /**
         * Builds the app into the dist directory
         */
        build: {
            script: series(
                'nps banner.build',
                'nps config',
                'npm run lint',
                'nps clean.dist',
                'nps transpile',
                'nps copy.tmp',
                'nps clean.tmp',
            ),
            description: 'Builds the app into the dist directory'
        },
        /**
         * Transpile your app into javascript
         */
        transpile: {
            script: `tsc --project ./tsconfig.build.json`,
            hiddenFromHelp: true
        },
        /**
         * Clean files and folders
         */
        clean: {
            default: {
                script: series(
                    `nps banner.clean`,
                    `nps clean.dist`
                ),
                description: 'Deletes the ./dist folder'
            },
            dist: {
                script: rimraf('./dist'),
                hiddenFromHelp: true
            },
            tmp: {
                script: rimraf('./.tmp'),
                hiddenFromHelp: true
            }
        },
        /**
         * Copies static files to the build folder
         */
        copy: {
            tmp: {
                script: copyDir(
                    './.tmp',
                    './dist'
                ),
                hiddenFromHelp: true
            }
        },
        /**
         * Database scripts
         */
        erd: {
            script: series(
                'nps banner.erd',
                runFast('./src/lib/utils/generate-ER.ts'),
            ),
            description: 'Generate ER diagram'
        },
        db: {
            migrate: {
                script: series(
                    'nps banner.migrate',
                    'nps config',
                    runFast('./node_modules/typeorm/cli.js migration:run'),
                    'nps erd',
                ),
                description: 'Migrates the database to newest version available'
            },
            revert: {
                script: series(
                    'nps banner.revert',
                    'nps config',
                    runFast('./node_modules/typeorm/cli.js migration:revert')
                ),
                description: 'Downgrades the database'
            },
            seed: {
                script: series(
                    'nps banner.seed',
                    'nps config',
                    'yarn seed:run'
                ),
                description: 'Seeds generated records into the database'
            },
            drop: {
                script: runFast('./node_modules/typeorm/cli.js schema:drop'),
                description: 'Drops the schema of the database'
            },
            setup: {
                script: series(
                    'nps db.drop',
                    'nps db.migrate',
                    'nps db.seed'
                ),
                description: 'Recreates the database with seeded data'
            }
        },
        /**
         * This creates pretty banner to the terminal
         */
        banner: {
            erd: banner('ERD'),
            build: banner('build'),
            swagger: banner('SWAGGER'),
            serve: banner('serve'),
            migrate: banner('migrate'),
            seed: banner('seed'),
            revert: banner('revert'),
            clean: banner('clean')
        }
    }
};

function banner(name) {
    return {
        hiddenFromHelp: true,
        silent: true,
        description: `Shows ${name} banners to the console`,
        script: runFast(`./commands/banner.ts ${name}`),
    };
}

function copyDir(source, target) {
    return `ncp ${source} ${target}`;
}

function runFast(path) {
    return `ts-node --transpile-only ${path}`;
}
