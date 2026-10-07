import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseJSONStrict} from './json-input.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try {
  const registry=parseJSONStrict(fs.readFileSync(path.join(root,'studio/contracts/standards.json')));
  const prose=fs.readFileSync(path.join(root,'studio/contracts/STANDARDS.md'),'utf8');
  if(registry.contract!=='studio-standards-v1'||!Array.isArray(registry.requirements)||!registry.requirements.length)throw new Error('Invalid standards registry');
  const ids=new Set();
  function localFile(relative){const resolved=path.resolve(root,relative);const rel=path.relative(root,resolved);if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.statSync(resolved).isFile())throw new Error('Invalid verification file');}
  for(const rule of registry.requirements){
    if(!/^[A-Z][A-Z0-9]+-\d{2}$/.test(rule.id)||ids.has(rule.id)||!prose.includes('| '+rule.id+' |'))throw new Error('Missing or duplicate requirement ID');ids.add(rule.id);
    if(!['automatic','automatic-subset','manual-open','mixed'].includes(rule.verification))throw new Error('Unknown verification scope');
    if(!Array.isArray(rule.tests)||(rule.verification.startsWith('automatic')&&!rule.tests.length))throw new Error('Automatic requirement has no tests');
    for(const file of rule.tests)localFile(file);
    if(['manual-open','mixed'].includes(rule.verification)){if(!rule.record)throw new Error('Manual requirement needs an evidence record');localFile(rule.record);}
    if(rule.reference.startsWith('https://')){if(!['www.rfc-editor.org','www.w3.org','url.spec.whatwg.org'].includes(new URL(rule.reference).hostname))throw new Error('Reference needs a primary standards source');}else localFile(rule.reference);
  }
  console.log(JSON.stringify({status:'pass',kind:'standards registry integrity only',requirements:ids.size,manual_open:registry.requirements.filter(r=>r.verification==='manual-open').map(r=>r.id),full_conformance_claim:false}));
}catch(error){console.error(error.message);process.exitCode=1;}
