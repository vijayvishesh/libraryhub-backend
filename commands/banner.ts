import chalk from 'chalk';
import * as figlet from 'figlet';

figlet.text(process.argv[2], (error: any, data: any) => {
    if (error) {
        return process.exit(1);
    }

    console.error(chalk.blue(data));
    console.error('');
    return process.exit(0);
});
