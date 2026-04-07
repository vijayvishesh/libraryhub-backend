import chalk from 'chalk';
import { exec } from 'child_process';

// Search for seeds and factories
const run = async () => {
  const log = console.log;
  exec('yarn "seed:run"', (err, stdout, stderr) => {
    if (err) {
      log(err);
    } else {
     // the *entire* stdout and stderr (buffered)
     console.log(`stdout: ${stdout}`);
     console.log(`stderr: ${stderr}`);
    }
  });
  log('\n👍 ', chalk.gray.underline(`finished seeding`));
  process.exit(0);
};

run();
