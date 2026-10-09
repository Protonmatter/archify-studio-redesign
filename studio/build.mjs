import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRouter} from '../archify/renderers/architecture/routing.mjs';
import {validateModel,edgeTextHalfWidth,edgeTextBelow} from './model.mjs';
import {exampleAtlas} from './example.mjs';
import {parseJSONStrict} from './json-input.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
export function safeInput(root,relative){
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.includes(':'))throw new Error('Expected a relative source path');
  const base=fs.realpathSync(root), candidate=path.resolve(base,relative);
  const contained=p=>{const rel=path.relative(base,p);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
  if(!contained(candidate)||!contained(fs.realpathSync(candidate)))throw new Error('Source path escapes input directory');
  if(fs.statSync(candidate).size>20*1024*1024)throw new Error('Input file exceeds 20 MiB');
  return candidate;
}
export function scriptJSON(value){const serialized=JSON.stringify(value,(_key,item)=>{if(typeof item==='number'&&(!Number.isFinite(item)||(Number.isInteger(item)&&!Number.isSafeInteger(item))))throw new Error('Cannot serialize a non-interoperable JSON number');return item;});parseJSONStrict(serialized,{maxBytes:128*1024*1024});return serialized.replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
export function prepareGeometry(data){
  validateModel(data);
  for(const r of data.routes){
    const boxes=new Map(r.nodes.map(n=>[n.id,{...n,cx:n.x+n.width/2,cy:n.y+n.height/2}]));
    const router=createRouter(boxes,r.edges,{distinctAutomaticPorts:true,preferReadableRoutes:true});
    for(const e of r.edges){const geometry=router.pathFor(e);e.d=geometry.d;e.points=geometry.points;
      if(!Array.isArray(e.points)||e.points.length<2||!e.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))||typeof e.d!=='string'||/NaN|Infinity|undefined/.test(e.d))throw new Error(`Invalid generated geometry: ${r.id}/${e.id}`);
      let best=0;for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i];const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len>best){best=len;e.labelX=(a[0]+b[0])/2;e.labelY=(a[1]+b[1])/2-10;}}
    }
    const points=r.edges.flatMap(e=>e.points);
    /* Labels and transport chips are drawn around labelX/labelY and can reach past the geometry margin. */
    const text=r.edges.filter(e=>Number.isFinite(e.labelX)).map(e=>{const half=edgeTextHalfWidth(e);return [e.labelX-half-8,e.labelY-22,e.labelX+half+8,e.labelY+edgeTextBelow(e)+8];});
    const minX=Math.min(Math.min(...r.nodes.map(n=>n.x),...points.map(p=>p[0]))-45,...text.map(t=>t[0]));
    const minY=Math.min(Math.min(...r.nodes.map(n=>n.y),...points.map(p=>p[1]))-65,...text.map(t=>t[1]));
    const maxX=Math.max(Math.max(...r.nodes.map(n=>n.x+n.width),...points.map(p=>p[0]))+45,...text.map(t=>t[2]));
    const maxY=Math.max(Math.max(...r.nodes.map(n=>n.y+n.height),...points.map(p=>p[1]))+65,...text.map(t=>t[3]));
    r.bounds=[minX,minY,maxX-minX,maxY-minY];
  }return data;
}
/* Candidates supply geometry only: component position and size, and connection routing. Every claim (label, kind,
   sublabel, status, detail, transport, sources) comes from the evidence record, so a candidate can never add one. */
const CANDIDATE_GEOMETRY=['via','route','fromSide','toSide','channelX','channelY','labelAt'];
const candidateGeometry=c=>Object.fromEntries(CANDIDATE_GEOMETRY.filter(k=>c&&c[k]!==undefined).map(k=>[k,c[k]]));
export function importAtlas(directory){
  const input=parseJSONStrict(fs.readFileSync(safeInput(directory,'atlas-data.json')));
  if(!Array.isArray(input.routes)||input.routes.length>100||!Array.isArray(input.sources)||input.sources.length>5000)throw new Error('Unsupported atlas');
  let sourceBytes=0;
  const sources=input.sources.map(s=>{const file=safeInput(directory,s.raw);sourceBytes+=fs.statSync(file).size;if(sourceBytes>64*1024*1024)throw new Error('Combined source text exceeds 64 MiB');const bytes=fs.readFileSync(file);if(createHash('sha256').update(bytes).digest('hex')!==s.sha256)throw new Error(`Source hash mismatch: ${s.id}`);return {...s,text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)};});
  const routes=input.routes.map(r=>{
    const candidate=parseJSONStrict(fs.readFileSync(safeInput(directory,r.candidate)));
    if(candidate.diagram_type!=='architecture')throw new Error('Studio currently supports architecture atlas diagrams');
    if(JSON.stringify(candidate.components.map(n=>n.id))!==JSON.stringify(r.nodes.map(n=>n.id))||JSON.stringify(candidate.connections.map(e=>[e.from,e.to,e.label]))!==JSON.stringify(r.edges.map(e=>[e.from,e.to,e.label])))throw new Error(`Diagram candidate does not match evidence topology: ${r.id}`);
    const componentMap=new Map(candidate.components.map(n=>[n.id,n]));
    return {...r,shortTitle:r.shortTitle||r.title.split(':')[0],group:r.group||(r.id==='overview'?'START HERE':r.id.startsWith('windows')?'WINDOWS INTERFACES':['sdk','ownership-lifecycle'].includes(r.id)?'APPLICATION INTEGRATION':'FIRMWARE & TRANSPORT'),nodes:r.nodes.map(n=>{const c=componentMap.get(n.id);if(!c)throw new Error(`Missing component ${n.id}`);return {...n,x:c.pos[0],y:c.pos[1],width:c.size[0],height:Math.max(c.size[1],84)};}),edges:r.edges.map((e,i)=>({...candidateGeometry(candidate.connections[i]),...e,id:e.id??candidate.connections[i]?.id??`${r.id}-edge-${i}`}))};
  });
  const groupOrder=['START HERE','WINDOWS INTERFACES','FIRMWARE & TRANSPORT','APPLICATION INTEGRATION'];
  routes.sort((a,b)=>groupOrder.indexOf(a.group)-groupOrder.indexOf(b.group));
  const sourceByHref=new Map(sources.map(s=>[s.href,s]));
  const terms=(input.terms||[]).map(t=>({...t,references:(t.references||[]).map(ref=>{const source=ref.source||sourceByHref.get((ref.href||'').split('#')[0])?.id;if(!source)throw new Error(`Indexed term has no source: ${t.term}`);return {...ref,source};})}));
  return {schemaVersion:1,title:input.title||'Evidence atlas',subtitle:input.subtitle||'Retained research',description:'A local research atlas. Evidence boundaries are retained.',demonstration:input.demonstration===true,routes,sources,terms,upstream:input.archify_revision||'73aaa0696e8f72c232ea710e6fa94fd953f3e773'};
}
export function buildHTML(data){
  const model=prepareGeometry(structuredClone(data));
  const css=fs.readFileSync(path.join(here,'studio.css'),'utf8');
  const logic=fs.readFileSync(path.join(here,'model.mjs'),'utf8').replace(/^export /gm,'');
  const app=fs.readFileSync(path.join(here,'app.mjs'),'utf8').replace(/^import .*;\r?\n/gm,'');
  const license=fs.readFileSync(path.join(here,'../LICENSE'),'utf8');
  return fs.readFileSync(path.join(here,'index.html'),'utf8').replace('<!-- STUDIO_LICENSE -->',()=>'<!--\nArchify Studio is a derivative of Archify.\n'+license+'\n-->').replace('/* STUDIO_STYLE */',()=>css).replace('/* STUDIO_DATA */',()=>scriptJSON(model)).replace('/* STUDIO_CODE */',()=>logic+'\n'+app);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);let atlas,out=path.resolve(here,'../dist/index.html');
    for(let i=0;i<args.length;i++){if(args[i]==='--atlas'&&args[i+1])atlas=path.resolve(args[++i]);else if(args[i]==='--out'&&args[i+1])out=path.resolve(args[++i]);else throw new Error('Usage: node studio/build.mjs [--atlas DIRECTORY] [--out FILE.html]');}
    if(!out.endsWith('.html'))throw new Error('Output must end in .html');
    const model=atlas?importAtlas(atlas):exampleAtlas();const html=buildHTML(model);
    fs.mkdirSync(path.dirname(out),{recursive:true});const temp=out+'.tmp';fs.writeFileSync(temp,html);fs.renameSync(temp,out);
    console.log(JSON.stringify({output:out,diagrams:model.routes.length,nodes:model.routes.reduce((n,r)=>n+r.nodes.length,0),sources:model.sources.length,bytes:Buffer.byteLength(html),demonstration:model.demonstration}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
