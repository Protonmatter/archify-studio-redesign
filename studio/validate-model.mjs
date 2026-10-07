/** Shared validation gate for Python packaging and external authoring tools. */
import fs from 'node:fs';
import {parseJSONStrict} from './json-input.mjs';
import {validateModel} from './model.mjs';

try {
  if (process.argv.length !== 3) throw new Error('Usage: node studio/validate-model.mjs FILE.json (or - for stdin)');
  const input=fs.readFileSync(process.argv[2] === '-' ? 0 : process.argv[2]);
  const model=validateModel(parseJSONStrict(input, {maxBytes:128*1024*1024}));
  console.log(JSON.stringify({status:'pass',contract:'studio-atlas-v1',routes:model.routes.length,sources:model.sources.length}));
} catch (error) {
  console.error(JSON.stringify({status:'fail',error:error.message}));
  process.exitCode=1;
}
