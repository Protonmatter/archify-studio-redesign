import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {parseJSONStrict} from '../json-input.mjs';
import {createPreviewServer} from '../serve.mjs';

test('JSON interchange rejects duplicate keys, nonfinite and unsafe integers',()=>{
  for(const value of ['{"a":1,"a":2}','{"a":{"x":1,"\\u0078":2}}','{"n":1e400}','{"n":9007199254740993}','{"n":NaN}'])assert.throws(()=>parseJSONStrict(value));
  assert.deepEqual(parseJSONStrict('{"a": [1, 2.5, "Δ", {"a":2}]}'),{a:[1,2.5,'Δ',{a:2}]});
});
test('JSON interchange rejects malformed UTF-8, lone surrogates and excessive nesting',()=>{
  assert.throws(()=>parseJSONStrict(Buffer.from([0x22,0xc0,0xaf,0x22])));
  for(const value of ['"\\ud800"','"\\udfff"', '['.repeat(129)+'0'+']'.repeat(129)])assert.throws(()=>parseJSONStrict(value));
  assert.equal(parseJSONStrict('"\\ud83d\\udd0e"'),'🔎');
});
test('JSON punctuation inside strings does not change nesting or duplicate detection',()=>{
  const data={'a{},:[]"':'b\\\\x',nested:[{'same':1},{'same':2}]};assert.deepEqual(parseJSONStrict(JSON.stringify(data)),data);
});

function request(port,method='GET',url='/',host=`127.0.0.1:${port}`){return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,path:url,method,headers:{Host:host}},res=>{let body='';res.setEncoding('utf8');res.on('data',part=>body+=part);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});
  req.setTimeout(3000,()=>req.destroy(new Error('HTTP contract timeout')));req.on('error',reject);req.end();
});}
test('HTTP GET/HEAD, 405 Allow and no-store contracts hold on real loopback requests',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-http-'));const file=path.join(root,'index.html');const content='<html lang="en">Δ test</html>';fs.writeFileSync(file,content);
  const server=createPreviewServer(file);
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
    const get=await request(port),head=await request(port,'HEAD'),post=await request(port,'POST');
    assert.equal(get.status,200);assert.equal(get.body,content);assert.equal(get.headers['content-type'],'text/html; charset=utf-8');assert.equal(get.headers['cache-control'],'no-store');
    assert.equal(head.status,200);assert.equal(head.body,'');assert.equal(Number(head.headers['content-length']),Buffer.byteLength(content));assert.equal(head.headers['content-length'],get.headers['content-length']);
    assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');
    assert.equal((await request(port,'GET','/unknown')).status,404);assert.equal((await request(port,'GET','/','example.invalid')).status,421);
  }finally{await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
});
