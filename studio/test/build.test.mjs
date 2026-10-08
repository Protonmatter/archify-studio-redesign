import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {safeInput,scriptJSON,prepareGeometry,buildHTML,importAtlas} from '../build.mjs';
import {exampleAtlas} from '../example.mjs';
test('inline data cannot terminate script tags',()=>{const value={x:'</script><img src=x onerror=alert(1)>\u2028'};const encoded=scriptJSON(value);assert(!encoded.includes('<'));assert.deepEqual(JSON.parse(encoded),value);});
test('source traversal and absolute paths are refused',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-path-'));try{fs.writeFileSync(path.join(root,'a.txt'),'safe');assert.equal(safeInput(root,'a.txt'),path.join(root,'a.txt'));for(const p of ['../escape','/etc/passwd','https://example.com','C:\\secret'])assert.throws(()=>safeInput(root,p));}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('routing is deterministic and every edge has finite geometry',()=>{const a=prepareGeometry(exampleAtlas()),b=prepareGeometry(exampleAtlas());assert.deepEqual(a,b);for(const r of a.routes)for(const e of r.edges){assert(e.d.startsWith('M'));assert(e.points.length>=2);assert(e.points.flat().every(Number.isFinite));assert(r.bounds.every(Number.isFinite));}});
test('portable document root contains the license for browser re-export',()=>{const result=buildHTML(exampleAtlas());const root=result.slice(result.indexOf('<html'));assert(root.includes('Permission is hereby granted'));assert(root.includes('Copyright (c) 2026 tt-a1i'));});
test('diagram bounds include connection labels and transport chips on exterior channels',()=>{
  /* The exterior vertical run is the longest segment, so the label sits on it, outside every node and route point. */
  const data=exampleAtlas(),r=data.routes[1];
  r.nodes=[{id:'a',label:'Upper',kind:'Endpoint',status:'documented',x:0,y:0,width:222,height:90,symbols:[],sources:[]},{id:'b',label:'Lower',kind:'Endpoint',status:'documented',x:0,y:1000,width:222,height:90,symbols:[],sources:[]}];
  r.edges=[{id:'outside',from:'a',to:'b',label:'A deliberately long relationship label',status:'documented',fromSide:'left',toSide:'left',via:[[-60,45],[-60,1045]],transport:{mechanism:'Shared memory ring',port:0},sources:[]}];
  const route=prepareGeometry(data).routes[1],e=route.edges[0],half=e.label.length*3.6;
  assert(Math.abs(e.labelX+60)<1,`label expected on the exterior run, got x=${e.labelX}`);
  assert(route.bounds[0]<=e.labelX-half,`left bound ${route.bounds[0]} clips the label, which starts at ${e.labelX-half}`);
  assert(route.bounds[1]+route.bounds[3]>=e.labelY+28,'bottom bound clips the transport chip');
});
test('malformed and extreme edge waypoints fail before routing',()=>{for(const via of [[['garbage',100]],[[1e200,100]],[[1,2,3]]]){const data=exampleAtlas();data.routes[0].edges[0].via=via;assert.throws(()=>prepareGeometry(data));}});
function cleanup(root){assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('studio-'));fs.rmSync(root,{recursive:true,force:true});}
test('atlas import binds indexed references, verifies hashes and preserves explicit routing',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-import-'));
  try{
    const model=exampleAtlas(),r=model.routes[0],raw='source.txt';
    const contents=model.sources[0].text;fs.writeFileSync(path.join(root,raw),contents);
    const sha256=createHash('sha256').update(contents).digest('hex');
    const source={...model.sources[0],raw,href:'source.html',sha256};
    const candidate={diagram_type:'architecture',components:r.nodes.map(n=>({id:n.id,pos:[n.x,n.y],size:[n.width,n.height]})),connections:r.edges.map(e=>({...e,route:'auto'}))};
    fs.writeFileSync(path.join(root,'candidate.json'),JSON.stringify(candidate));
    const input={routes:[{...r,candidate:'candidate.json'}],sources:[source],terms:[{term:'TEST_TERM',references:[{href:'source.html#L3',path:source.path,line:3,scope:source.scope}]}]};
    fs.writeFileSync(path.join(root,'atlas-data.json'),JSON.stringify(input));
    const imported=importAtlas(root);assert.equal(imported.terms[0].references[0].source,source.id);assert.equal(imported.terms[0].references[0].line,3);assert.equal(imported.routes[0].edges[0].route,'auto');assert(buildHTML(imported).includes('TEST_TERM'));
    candidate.connections[0].to='unknown';fs.writeFileSync(path.join(root,'candidate.json'),JSON.stringify(candidate));assert.throws(()=>importAtlas(root),/topology/);
    fs.writeFileSync(path.join(root,raw),'changed');assert.throws(()=>importAtlas(root),/hash mismatch/);
  }finally{cleanup(root);}
});
test('an external directory link cannot expose files outside an atlas',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-link-')),outside=fs.mkdtempSync(path.join(os.tmpdir(),'studio-outside-'));
  try{fs.writeFileSync(path.join(outside,'secret.txt'),'outside');fs.symlinkSync(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');assert.throws(()=>safeInput(root,'linked/secret.txt'),/escapes/);}finally{cleanup(root);cleanup(outside);}
});
test('BOM-prefixed evidence survives import and source-download re-encoding exactly',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-bom-'));
  try{
    const model=exampleAtlas(),r=model.routes[0];const bytes=Buffer.from('\ufeff'+model.sources[0].text,'utf8');
    fs.writeFileSync(path.join(root,'source.txt'),bytes);
    const source={...model.sources[0],raw:'source.txt',href:'source.txt',sha256:createHash('sha256').update(bytes).digest('hex')};
    const candidate={diagram_type:'architecture',components:r.nodes.map(n=>({id:n.id,pos:[n.x,n.y],size:[n.width,n.height]})),connections:r.edges};
    fs.writeFileSync(path.join(root,'candidate.json'),JSON.stringify(candidate));
    fs.writeFileSync(path.join(root,'atlas-data.json'),JSON.stringify({routes:[{...r,candidate:'candidate.json'}],sources:[source],terms:[]}));
    const imported=importAtlas(root).sources[0];const downloaded=Buffer.from(imported.text,'utf8');
    assert.deepEqual(downloaded,bytes);assert.equal(createHash('sha256').update(downloaded).digest('hex'),source.sha256);
  }finally{cleanup(root);}
});
