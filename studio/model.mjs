/** Pure data/navigation contracts shared by the build, browser and tests. */
export const STATUSES = ['observed','static','documented','software-tested','unresolved','failed'];
export const VIEWS = ['diagram','relationships','evidence','gaps'];
const text = (v, name, max=20000) => { if(typeof v!=='string'||v.length>max) throw new Error(`Invalid ${name}`); return v; };
const list=(v,name,max)=>{if(!Array.isArray(v)||v.length>max)throw new Error(`Invalid ${name}`);return v;};
const identifier=(value,name)=>{text(value,name,200);if(!value.trim())throw new Error(`Empty ${name}`);};
export function validateModel(data) {
  if(!data||typeof data!=='object') throw new Error('Expected an atlas object');
  text(data.title,'atlas title',300);
  list(data.sources,'sources',5000);list(data.terms,'terms',30000);
  const sourceMap=new Map();let sourceBytes=0;
  for(const s of data.sources){
    identifier(s.id,'source ID');text(s.path,'source path',2000);
    if(sourceMap.has(s.id))throw new Error(`Duplicate source ${s.id}`);
    if(s.text!==undefined){text(s.text,'source text',5*1024*1024);sourceBytes+=s.text.length;}
    if(sourceBytes>64*1024*1024)throw new Error('Combined source text exceeds 64 MiB');
    if(s.sha256!==undefined&&s.sha256!==''&&!/^[a-f0-9]{64}$/i.test(s.sha256))throw new Error('Invalid source digest');
    sourceMap.set(s.id,{...s,lineCount:s.text===undefined?null:s.text.split(/\r?\n/).length});
  }
  const references=refs=>{for(const ref of list(refs||[],'references',1000)){
    const s=sourceMap.get(ref.source);if(!s)throw new Error(`Missing evidence source ${ref.source}`);
    const end=ref.end_line??ref.line;
    if(!Number.isSafeInteger(ref.line)||ref.line<1||!Number.isSafeInteger(end)||end<ref.line||(s.lineCount!==null&&end>s.lineCount))throw new Error('Evidence reference is outside source lines');
    if(ref.sha256&&ref.sha256!==s.sha256)throw new Error('Evidence reference digest mismatch');
    if(ref.path&&ref.path!==s.path)throw new Error('Evidence reference path mismatch');
    if(ref.scope&&s.scope&&ref.scope!==s.scope)throw new Error('Evidence reference scope mismatch');
  }};
  for(const t of data.terms){text(t.term,'indexed term',1000);references(t.references);}
  if(!Array.isArray(data.routes)||!data.routes.length||data.routes.length>100) throw new Error('Expected 1–100 diagrams');
  const routes=new Set();
  for(const route of data.routes){
    identifier(route.id,'route ID'); text(route.title,'route title',500);
    if(route.summary!==undefined)text(route.summary,'route summary');
    for(const unknown of list(route.unknowns||[],'unknowns',1000))text(unknown,'unknown');
    if(routes.has(route.id)) throw new Error(`Duplicate route ${route.id}`); routes.add(route.id);
    if(!Array.isArray(route.nodes)||!route.nodes.length||route.nodes.length>500||!Array.isArray(route.edges)||route.edges.length>2000) throw new Error('Diagram exceeds node/edge limits');
    const nodes=new Set(), edges=new Set();
    for(const n of route.nodes){
      identifier(n.id,'node ID');text(n.label,'node label',500);
      for(const key of ['kind','sublabel','full_label'])if(n[key]!==undefined)text(n[key],`node ${key}`,2000);
      if(nodes.has(n.id)) throw new Error(`Duplicate node ${n.id}`);nodes.add(n.id);
      if(!STATUSES.includes(n.status)) throw new Error(`Invalid evidence status ${n.status}`);
      for(const symbol of list(n.symbols||[],'symbols',500))text(symbol,'symbol',2000);
      if(n.detail!==undefined)text(n.detail,'node detail');references(n.sources);
      for(const k of ['x','y','width','height']) if(!Number.isFinite(n[k])||Math.abs(n[k])>100000) throw new Error(`Invalid node ${k}`);
      if(n.width<20||n.height<20) throw new Error('Node dimensions must be positive');
    }
    for(const e of route.edges){
      identifier(e.id,'edge ID'); text(e.label,'edge label',500);
      if(edges.has(e.id)||!nodes.has(e.from)||!nodes.has(e.to)) throw new Error('Duplicate or dangling relationship');edges.add(e.id);
      if(!STATUSES.includes(e.status)) throw new Error(`Invalid evidence status ${e.status}`);
      if(e.detail!==undefined)text(e.detail,'relationship detail');references(e.sources);
      if(e.via!==undefined)for(const point of list(e.via,'waypoints',200)){if(!Array.isArray(point)||point.length!==2||!point.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw new Error('Invalid edge waypoint');}
      for(const key of ['channelX','channelY'])if(e[key]!==undefined&&(!Number.isFinite(e[key])||Math.abs(e[key])>100000))throw new Error('Invalid edge channel');
    }
  }
  return data;
}
export function encodeState(s){const p=new URLSearchParams();for(const k of ['route','view','selected','selectionType','scope','query','filter','line'])if(s[k])p.set(k,s[k]);return '#'+p.toString();}
/** Restore each diagram/view's query without leaking a symbol filter into evidence. */
export function transitionState(state,patch,queries){
  queries.set(state.route+':'+state.view,state.query);
  const next={...state,...patch};
  if((next.route!==state.route||next.view!==state.view)&&!Object.hasOwn(patch,'query'))next.query=queries.get(next.route+':'+next.view)||'';
  queries.set(next.route+':'+next.view,next.query);
  return next;
}
export function decodeState(hash,data){
  const p=new URLSearchParams(hash.replace(/^#/,''));const route=data.routes.find(r=>r.id===p.get('route'))||data.routes[0];
  const type=['node','edge','source'].includes(p.get('selectionType'))?p.get('selectionType'):'node';
  let selected=p.get('selected')||'';
  if(!(type==='node'?route.nodes:type==='edge'?route.edges:data.sources).some(x=>x.id===selected))selected='';
  const result={route:route.id,view:VIEWS.includes(p.get('view'))?p.get('view'):'diagram',selected,selectionType:type,query:(p.get('query')||'').slice(0,500),scope:p.get('scope')==='all'?'all':'route',filter:STATUSES.includes(p.get('filter'))?p.get('filter'):'all'};
  const line=Number(p.get('line'));if(type==='source'&&Number.isSafeInteger(line)&&line>0&&line<=(data.sources.find(s=>s.id===selected)?.text?.split(/\r?\n/).length||0))result.line=line;
  return result;
}
export function gaps(data,scope,routeId){
  return data.routes.filter(r=>scope==='all'||r.id===routeId).flatMap(r=>[
    ...r.nodes.filter(n=>['failed','unresolved'].includes(n.status)).map(n=>({route:r.id,routeTitle:r.title,type:'node',id:n.id,title:n.label,status:n.status,detail:n.detail||''})),
    ...r.edges.filter(e=>['failed','unresolved'].includes(e.status)).map(e=>({route:r.id,routeTitle:r.title,type:'edge',id:e.id,title:e.label,status:e.status,detail:e.detail||''})),
    ...(r.unknowns||[]).map((detail,i)=>({route:r.id,routeTitle:r.title,type:'note',id:`note-${i}`,title:'Research boundary',status:'unresolved',detail}))
  ]);
}
export function search(data,query,scope,routeId,filter='all'){
  const q=query.trim().toLowerCase();if(!q)return [];
  const rows=[];const add=(entry,extra='')=>{const name=entry.title.toLowerCase(),symbols=(entry.symbols||[]).map(s=>s.toLowerCase());const hay=[name,...symbols,extra].join(' ').toLowerCase();if(hay.includes(q)&&(filter==='all'||entry.status===filter)){entry.score=name===q||symbols.includes(q)?0:name.startsWith(q)?1:2;rows.push(entry);}};
  for(const r of data.routes.filter(r=>scope==='all'||r.id===routeId)){
    for(const n of r.nodes)add({type:'node',id:n.id,title:n.label,route:r.id,routeTitle:r.title,status:n.status,symbols:n.symbols||[]},n.detail||'');
    for(const e of r.edges)add({type:'edge',id:e.id,title:e.label,route:r.id,routeTitle:r.title,status:e.status},e.detail||'');
  }
  const sourceIds=new Set(data.routes.find(r=>r.id===routeId)?.nodes.concat(data.routes.find(r=>r.id===routeId)?.edges||[]).flatMap(n=>(n.sources||[]).map(s=>s.source))||[]);
  for(const s of data.sources.filter(s=>scope==='all'||sourceIds.has(s.id)))add({type:'source',id:s.id,title:s.path,route:routeId,routeTitle:s.repo||'Source',status:s.status||'documented'},s.scope||'');
  if(filter==='all')for(const t of data.terms||[]){const refs=(t.references||[]).filter(s=>scope==='all'||sourceIds.has(s.source));if(refs.length)add({type:'source',id:refs[0].source,line:refs[0].line,title:t.term,route:routeId,routeTitle:'Indexed symbol · no call-edge claim',status:'documented'});}
  return rows.sort((a,b)=>a.score-b.score||a.title.localeCompare(b.title,'en')).slice(0,100);
}
export function connected(route,id,direction='both'){
  const visited=new Set([id]), queue=[id];
  while(queue.length){const current=queue.shift();for(const e of route.edges){let next;if(direction!=='upstream'&&e.from===current)next=e.to;if(direction!=='downstream'&&e.to===current)next=e.from;if(next&&!visited.has(next)){visited.add(next);queue.push(next);}}}return visited;
}
export function scopedSources(data,scope,routeId){
  if(scope==='all')return data.sources;
  const r=data.routes.find(r=>r.id===routeId);const ids=new Set([...r.nodes,...r.edges].flatMap(x=>(x.sources||[]).map(s=>s.source)));
  return data.sources.filter(s=>ids.has(s.id));
}
