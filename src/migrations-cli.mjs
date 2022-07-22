/**
 * A basic CLI wrapper around the migrations module.
 *
 * node ./src/migrations.mjs {dbname} {direction: up | down} [--dir ./migrations]
 */

import * as migrate from './migrations.mjs';

async function run() {
  const dirFlagPrefix = '--dir=';
  const [_node, _script, db, command, flag] = process.argv;
  const directions = ['up', 'down'];
  let dir = './migrations';

  if (flag && !flag.startsWith(dirFlagPrefix)) {
    console.log(`Unknown flag ${flag}. Expected --dir=<migration_directory>`);
    process.exit(2);
  }

  if (flag) {
    dir = flag.slice(dirFlagPrefix.length);
  }

  if (db === 'new') {
    // We're dealing with a "migrate new ./foo-bar-baz" command.
    await migrate.create({ dir, suffix: command });
    return;
  }

  if (!directions.includes(command)) {
    console.log(
      `Invalid migration direction: ${command}. Must be one of ${directions.join(
        ', '
      )}`
    );
    process.exit(1);
  }

  const conn = await migrate[command]({ db, dir });
  conn.close();
}

run();
