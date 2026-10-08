import {STATUSES,VIEWS,validateModel,encodeState,decodeState,transitionState,search,gaps,connected,scopedSources} from './model.mjs';

/* This module is assembled inline by build.mjs; all content remains on device. */
const originalHTML='<!doctype html>\n'+document.documentElement.outerHTML;
const data=validateModel(JSON.parse(document.getElementById('studio-data').textContent));
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const html=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const svg=(tag,attrs={},text)=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
let state=decodeState(location.hash,data), currentRoute='', trace='', toastTimer, searchScope='all';
/* Drawn elements by ID, rebuilt with each diagram, so highlighting is one linear pass on dense diagrams. */
let diagramIndex={nodes:new Map(),edges:new Map()};
const cameras=new Map();
const viewQueries=new Map();
/* Saved values may come from an older version or be hand-edited, so every read is checked and falls back. */
const storage={get(key,fallback,valid=()=>true){try{const value=JSON.parse(localStorage.getItem('archify-studio:'+key));return value!==null&&valid(value)?value:fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('archify-studio:'+key,JSON.stringify(value));}catch{/* Viewer remains usable when storage is unavailable. */}}};
const collapsedGroups=new Set(storage.get('collapsedGroups',[],v=>Array.isArray(v)&&v.every(g=>typeof g==='string')));
const isTheme=v=>v==='paper'||v==='ink';
let directoryRoute='';
const route=()=>data.routes.find(r=>r.id===state.route);
const num=i=>String(i+1).padStart(2,'0');
const isSmall=()=>matchMedia('(max-width:700px)').matches;
const isNarrow=()=>matchMedia('(max-width:980px)').matches;
const body=document.body;

/* Evidence vocabulary: each state has a label, a glyph shape and a line style. */
const STATUS_LABELS={observed:'Observed',static:'Static analysis',documented:'Documented','software-tested':'Software tested',unresolved:'Unresolved',failed:'Failed'};
const statusLabel=s=>STATUS_LABELS[s]||s;
const isOpen=s=>s==='unresolved'||s==='failed';
function glyphShapes(status){
  if(status==='observed')return [svg('circle',{cx:5,cy:5,r:4,fill:'currentColor'})];
  if(status==='software-tested')return [svg('path',{d:'M1 1H9V9H1Z M2.34 5.66 L4.4 7.72 L7.78 4.04 L6.82 3.16 L4.4 5.88 L3.26 4.74 Z',fill:'currentColor','fill-rule':'evenodd'})];
  if(status==='static')return [svg('path',{d:'M5 1 L9 5 L5 9 L1 5 Z',fill:'none',stroke:'currentColor','stroke-width':1.4})];
  if(status==='unresolved')return [svg('circle',{cx:5,cy:5,r:3.6,fill:'none',stroke:'currentColor','stroke-width':1.4,'stroke-dasharray':'2 1.6'}),svg('path',{d:'M5 1.4 A3.6 3.6 0 0 1 5 8.6 Z',fill:'currentColor'})];
  if(status==='failed')return [svg('path',{d:'M2 2 L8 8 M8 2 L2 8',fill:'none',stroke:'currentColor','stroke-width':1.6,'stroke-linecap':'round'})];
  return [svg('circle',{cx:5,cy:5,r:3.6,fill:'none',stroke:'currentColor','stroke-width':1.4})];
}
function glyph(status,size=10){const e=svg('svg',{class:'glyph',viewBox:'0 0 10 10',width:size,height:size,'aria-hidden':'true','data-status':status});e.append(...glyphShapes(status));return e;}
function icon(d,box=14){const e=svg('svg',{viewBox:`0 0 ${box} ${box}`,'aria-hidden':'true'});e.append(svg('path',{d}));return e;}
const closeIcon=()=>icon('M3 3l8 8M11 3l-8 8');
function copyIcon(){const e=svg('svg',{viewBox:'0 0 16 16','aria-hidden':'true'});e.append(svg('rect',{x:5,y:5,width:8.5,height:8.5,rx:1}),svg('path',{d:'M3 10.5V3.5a1 1 0 0 1 1-1h6.5'}));return e;}
/* A glyph with screen-reader text, wherever the glyph is the only carrier of the evidence state. */
function statusMark(status){const s=html('span',undefined,'status-mark');s.append(glyph(status,12),html('span',statusLabel(status)+'. ','sr-only'));return s;}
function statusChip(s){const e=html('span',undefined,'status-chip');e.dataset.status=s;e.append(glyph(s),statusLabel(s));return e;}

const announce=message=>{$('announcement').textContent=message;$('announcement').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('announcement').classList.remove('visible'),3000);};
const closeDialog=id=>$(id).close();
async function copyText(text,label){try{await navigator.clipboard.writeText(text);announce(label+' copied.');}catch{announce('Clipboard unavailable. Select the text to copy it.');}}

function navigate(patch,{replace=false}={}){
  const next=transitionState(state,patch,viewQueries),hadSelection=Boolean(state.selected);
  if(patch.route&&patch.route!==state.route&&!Object.hasOwn(patch,'selected')){next.selected='';next.selectionType='node';}
  state=decodeState(encodeState(next),data);trace='';
  /* A sheet opened for a selection closes when any navigation clears it; one opened from Details stays. */
  if(hadSelection&&!state.selected)body.classList.remove('sheet-open');
  const hash=encodeState(state);if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);
  render();
}
/* Every selection goes through here: lists, search, the inspector and the diagram itself. */
function select(type,id,routeId=state.route,line=undefined,{view=state.view,frame=isSmall(),focus=false,extra={}}={}){
  const small=isSmall();body.classList.remove('no-inspector');if(small)body.classList.add('sheet-open');
  navigate({route:routeId,selected:id,selectionType:type,line,view,...extra});
  if(view!=='diagram'||type==='source'){if(focus)requestAnimationFrame(()=>$('inspector-content').querySelector('h2')?.focus({preventScroll:true}));return;}
  if(small)$('map-panel').scrollIntoView({block:'start'});
  /* Wait for layout so a view that just became visible has its real size. Focus moves to the item when
     asked to, or when the control that had focus was replaced by the re-render. */
  requestAnimationFrame(()=>{
    if(frame)focusSelection(false);
    if(focus)$('diagram').querySelector(`[data-${type}="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
  });
}
function showOnDiagram(type,id,routeId){select(type,id,routeId,undefined,{view:'diagram',frame:true,focus:true});}
function restoreFocus(key){
  if(!key||(document.activeElement?.dataset?.focusKey===key&&document.activeElement.isConnected))return;
  const target=document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
  if(target&&!target.disabled)target.focus({preventScroll:true});else if(key.startsWith('chip:'))document.querySelector('[data-focus-key="chip:all"]')?.focus({preventScroll:true});
}
const isVisible=el=>Boolean(el&&el.isConnected&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
/* When an update removes or hides the focused control, land on the closest meaningful visible place. */
function ensureFocus(preferred){
  const active=document.activeElement;if(active&&active!==body&&isVisible(active))return;
  const item=state.selected&&state.view==='diagram'&&state.selectionType!=='source'?$('diagram').querySelector(`[data-${state.selectionType}="${CSS.escape(state.selected)}"]`):null;
  for(const target of [preferred,item,$('inspector-content').querySelector('h2'),state.view==='diagram'?$('canvas'):$('list-panel').querySelector('h2'),$('workspace')])if(isVisible(target)){target.focus({preventScroll:true});return;}
}
function clearSelection(){body.classList.remove('sheet-open');navigate({selected:''});}
function setNav(open){
  if(isNarrow()){body.classList.toggle('nav-open',open);$('scrim').hidden=!open;}
  else{body.classList.toggle('nav-collapsed',!open);storage.set('directory',open);}
  $('nav-toggle').setAttribute('aria-expanded',String(open));
  if(!open&&$('directory').contains(document.activeElement))$('nav-toggle').focus({preventScroll:true});
}
const navIsOpen=()=>isNarrow()?body.classList.contains('nav-open'):!body.classList.contains('nav-collapsed');

/* Directory, breadcrumb and heading */
function renderDirectory(){
  const nav=$('routes');nav.replaceChildren();const groups=[];
  if(directoryRoute!==state.route){directoryRoute=state.route;if(collapsedGroups.delete(route().group||''))storage.set('collapsedGroups',[...collapsedGroups]);}
  const byName=new Map();for(const r of data.routes){const name=r.group||'';if(!byName.has(name)){const g={name,routes:[]};byName.set(name,g);groups.push(g);}byName.get(name).routes.push(r);}
  for(const g of groups){
    const list=html('div',undefined,'route-list');
    if(g.name){
      const open=!collapsedGroups.has(g.name);
      const head=html('button',undefined,'route-group');head.dataset.focusKey='group:'+g.name;head.setAttribute('aria-expanded',String(open));head.append(html('span',g.name),icon('M3 5l4 4 4-4'));list.hidden=!open;
      head.onclick=()=>{const expand=head.getAttribute('aria-expanded')!=='true';head.setAttribute('aria-expanded',String(expand));list.hidden=!expand;if(expand)collapsedGroups.delete(g.name);else collapsedGroups.add(g.name);storage.set('collapsedGroups',[...collapsedGroups]);};
      nav.append(head);
    }
    for(const r of g.routes){
      const b=html('button',undefined,'route-link');b.dataset.route=r.id;b.dataset.focusKey='route:'+r.id;b.setAttribute('aria-current',r.id===state.route?'page':'false');
      b.append(html('span',num(data.routes.indexOf(r)),'number'),html('span',r.shortTitle||r.title,'route-title'),html('span',`${r.nodes.length} components · ${r.edges.length} links`,'route-meta'));
      const open=gaps(data,'route',r.id);
      if(open.length){
        const mark=html('span',undefined,'route-gaps'),parts=[];
        for(const s of ['failed','unresolved']){const count=open.filter(x=>x.status===s).length;if(!count)continue;const part=html('span',undefined,'route-gap');part.dataset.status=s;part.append(glyph(s),String(count));mark.append(part);parts.push(`${count} ${statusLabel(s).toLowerCase()}`);}
        mark.title=`${open.length} open question${open.length===1?'':'s'}: ${parts.join(', ')}`;mark.append(html('span',` ${mark.title}`,'sr-only'));b.append(mark);
      }
      b.onclick=()=>{navigate({route:r.id});if(isNarrow())setNav(false);};list.append(b);
    }
    nav.append(list);
  }
}
function renderHeading(){
  const r=route(),index=data.routes.indexOf(r),routeGaps=gaps(data,'route',r.id).length;
  document.title=(r.shortTitle||r.title)+' · Archify Studio';
  const crumbs=$('crumbs');crumbs.replaceChildren();
  const home=html('a',data.subtitle||data.title);home.href='#';home.onclick=e=>{e.preventDefault();navigate({route:data.routes[0].id,view:'diagram',selected:''});};
  const sep=()=>{const s=html('span','/');s.setAttribute('aria-hidden','true');return s;};
  crumbs.append(home);if(r.group)crumbs.append(sep(),html('span',r.group,'crumb-group'));
  const current=html('span',r.title);current.setAttribute('aria-current','page');crumbs.append(sep(),current);
  $('route-title').textContent=r.title;$('route-summary').textContent=r.summary||'';$('route-summary').hidden=!r.summary;
  $('group-name').textContent=r.group||'';$('sheet-number').textContent='FIG. '+num(index);$('provenance').textContent=r.provenance||'';
  const stats=$('stats');stats.replaceChildren();
  for(const[label,value]of [['Components',r.nodes.length],['Connections',r.edges.length]]){const d=html('div');d.append(html('span',label,'stat-l'),html('span',String(value),'stat-n'));stats.append(d);}
  const open=html('button',undefined,'stat-gaps');open.append(html('span','Open questions','stat-l'),html('span',String(routeGaps),'stat-n'));open.onclick=()=>navigate({view:'gaps',scope:'route'});stats.append(open);
  const relationshipCount=data.routes.filter(x=>state.scope==='all'||x.id===r.id).reduce((n,x)=>n+x.edges.length,0);
  $('count-relationships').textContent=relationshipCount;$('count-evidence').textContent=scopedSources(data,state.scope,state.route).length;
  const gapTotal=gaps(data,state.scope,state.route).length;$('gap-count').textContent=gapTotal;$('gap-count').dataset.zero=String(!gapTotal);
  for(const b of document.querySelectorAll('[data-scope]'))b.setAttribute('aria-pressed',String(b.dataset.scope===state.scope));
}
function renderFilters(box,items){
  box.replaceChildren(html('span','EVIDENCE','mono-label'));
  const counts=Object.fromEntries(STATUSES.map(s=>[s,0]));for(const x of items)counts[x.status]++;
  const chip=(status,label,count)=>{const b=html('button',undefined,'chip');b.dataset.focusKey='chip:'+status;if(status!=='all'){b.dataset.status=status;b.append(glyph(status));}b.append(label,html('span',String(count),'n'));
    const active=state.filter===status;b.setAttribute('aria-pressed',String(active));b.disabled=!count&&!active;
    b.onclick=()=>navigate({filter:active&&status!=='all'?'all':status});return b;};
  box.append(chip('all','All',items.length));
  const short={static:'Static','software-tested':'Tested'};
  for(const s of [...STATUSES.filter(s=>counts[s]),...STATUSES.filter(s=>!counts[s])]){const b=chip(s,short[s]||statusLabel(s),counts[s]);b.title=statusLabel(s);box.append(b);}
}

/* Diagram canvas */
function cameraKey(){return `${data.subtitle||data.title}:${state.route}`;}
function getCamera(){
  if(!cameras.has(state.route)){
    const saved=storage.get(cameraKey(),null,c=>typeof c==='object'&&['x','y','zoom'].every(k=>Number.isFinite(c[k]))&&c.zoom>=.5&&c.zoom<=4&&Math.abs(c.x)<100000&&Math.abs(c.y)<100000),[x,y,w,h]=route().bounds;
    const valid=Boolean(saved);
    cameras.set(state.route,valid?saved:{x:x+w/2,y:y+h/2,zoom:1});
  }return cameras.get(state.route);
}
function updateCamera(save=true){
  const c=getCamera(),b=route().bounds;
  $('diagram').setAttribute('viewBox',[c.x-b[2]/c.zoom/2,c.y-b[3]/c.zoom/2,b[2]/c.zoom,b[3]/c.zoom].join(' '));
  $('zoom-value').textContent=Math.round(c.zoom*100)+'%';$('zoom-out').disabled=c.zoom<=.5;$('zoom-in').disabled=c.zoom>=4;
  updateMinimapView();if(save)storage.set(cameraKey(),c);
}
function zoom(factor){getCamera().zoom=Math.max(.5,Math.min(4,getCamera().zoom*factor));updateCamera();}
function fit(){const[x,y,w,h]=route().bounds;cameras.set(state.route,{x:x+w/2,y:y+h/2,zoom:1});updateCamera();}
/* Approximate extent of a connection's text at its label position (11.5px monospace is about 7px a character). */
const edgeTextHalfWidth=e=>e.label.length*3.6;
const edgeTextBelow=()=>6;
function focusSelection(notify=true){
  const r=route();let ids=[];
  if(state.selectionType==='node'&&state.selected)ids=[...(trace?connected(r,state.selected,trace):new Set([state.selected,...r.edges.flatMap(e=>e.from===state.selected?[e.to]:e.to===state.selected?[e.from]:[])]))];
  else if(state.selectionType==='edge'){const e=r.edges.find(e=>e.id===state.selected);if(e)ids=[e.from,e.to];}
  const nodes=r.nodes.filter(n=>ids.includes(n.id));if(!nodes.length)return;
  /* Routed paths can detour well outside their endpoint boxes, so the frame includes every point and label of the
     connections in view: the selected one, or those among a selected component and its neighbors. */
  const framed=state.selectionType==='edge'?r.edges.filter(e=>e.id===state.selected):r.edges.filter(e=>ids.includes(e.from)&&ids.includes(e.to));
  const xs=[...nodes.flatMap(n=>[n.x,n.x+n.width]),...framed.flatMap(e=>[...e.points.map(p=>p[0]),e.labelX-edgeTextHalfWidth(e),e.labelX+edgeTextHalfWidth(e)])];
  const ys=[...nodes.flatMap(n=>[n.y,n.y+n.height]),...framed.flatMap(e=>[...e.points.map(p=>p[1]),e.labelY-14,e.labelY+edgeTextBelow(e)])];
  const pad=60,minX=Math.min(...xs)-pad,minY=Math.min(...ys)-pad,maxX=Math.max(...xs)+pad,maxY=Math.max(...ys)+pad;
  /* Fit the box into the part of the canvas that is actually visible: below the masthead and above a phone sheet. */
  const b=r.bounds,rect=$('canvas').getBoundingClientRect(),k=Math.min(rect.width/b[2],rect.height/b[3]);if(!k)return;
  const sheetTop=isSmall()&&body.classList.contains('sheet-open')?innerHeight-$('inspector').offsetHeight:Infinity;
  const top=Math.max(rect.top,document.querySelector('.masthead').getBoundingClientRect().bottom),bottom=Math.min(rect.bottom,sheetTop,innerHeight);
  const visibleH=Math.max(120,bottom-top),level=Math.max(.5,Math.min(2.5,rect.width/((maxX-minX)*k),visibleH/((maxY-minY)*k))),scale=level*k;
  const offsetY=(Math.max(top,rect.top)+Math.min(bottom,rect.bottom))/2-(rect.top+rect.height/2);
  cameras.set(state.route,{x:(minX+maxX)/2,y:(minY+maxY)/2-offsetY/scale,zoom:level});updateCamera();if(notify)announce('Focused on the selection.');
}
function wrappedLabel(label,max=26){if(label.length<=max)return[label];const words=label.split(/\s+/);const lines=[''];for(const word of words){if((lines.at(-1)+' '+word).trim().length>max&&lines.at(-1))lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim();}return lines;}
function renderDiagram(){
  const r=route(),root=$('diagram'),labels=new Map(r.nodes.map(n=>[n.id,n.label])),name=id=>labels.get(id)||id;root.replaceChildren();diagramIndex={nodes:new Map(),edges:new Map()};root.setAttribute('aria-label',r.title+' interactive diagram');
  const defs=svg('defs');
  for(const[id,cls]of [['arrow','arrow-fill'],['arrow-accent','arrow-accent'],['arrow-amber','arrow-amber'],['arrow-rose','arrow-rose']]){const m=svg('marker',{id,markerWidth:8,markerHeight:8,refX:7,refY:4,orient:'auto',markerUnits:'userSpaceOnUse'});m.append(svg('path',{d:'M0 0 L8 4 L0 8 Z',class:cls}));defs.append(m);}
  root.append(defs);
  root.append(svg('text',{x:r.bounds[0]+45,y:Math.min(...r.nodes.map(n=>n.y))-30,class:'sheet-label'},'DIRECTED SYSTEM MAP · FIG. '+num(data.routes.indexOf(r))));
  r.edges.forEach(e=>{
    const g=svg('g',{'data-edge':e.id,'data-status':e.status,class:'graph-edge',tabindex:0,role:'button','aria-label':`${e.label}: ${name(e.from)} to ${name(e.to)}. ${statusLabel(e.status)}.`});diagramIndex.edges.set(e.id,{edge:e,g});
    g.append(svg('title',{},`${e.label} · ${statusLabel(e.status)}`),svg('path',{d:e.d,class:'edge-mask'}),svg('path',{d:e.d,class:'edge-path'}),svg('path',{d:e.d,class:'edge-hit'}));
    g.onclick=()=>select('edge',e.id);g.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select('edge',e.id);}};root.append(g);
  });
  for(const e of r.edges){const label=svg('text',{x:e.labelX,y:e.labelY,class:'edge-label','text-anchor':'middle','data-label':e.id,'data-status':e.status},e.label);diagramIndex.edges.get(e.id).label=label;root.append(label);}
  r.nodes.forEach((n,i)=>{
    const kind=n.sublabel||n.kind||'Component';
    const g=svg('g',{'data-node':n.id,'data-status':n.status,class:'graph-node',tabindex:0,role:'button','aria-label':`${n.label}. ${kind}. ${statusLabel(n.status)}.`});diagramIndex.nodes.set(n.id,{node:n,g});
    g.append(svg('title',{},n.label+' · '+statusLabel(n.status)),svg('rect',{x:n.x-3,y:n.y-3,width:n.width+6,height:n.height+6,rx:5,class:'node-halo'}),svg('rect',{x:n.x,y:n.y,width:n.width,height:n.height,rx:3,class:'node-box'}),svg('rect',{x:n.x+1,y:n.y+1,width:n.width-2,height:23,rx:2,class:'node-head'}),svg('path',{d:`M${n.x} ${n.y+24} H${n.x+n.width}`,class:'node-rule'}));
    const lines=wrappedLabel(n.label,Math.floor((n.width-24)/8.6));
    /* The evidence state always shows: as a status row when the label fits above it (shrinking to 15px lines
       first), otherwise as a glyph in the header band beside the number. */
    const rowLineHeight=Math.min(19,(n.height-52)/lines.length),showStatus=rowLineHeight>=15,lineHeight=showStatus?rowLineHeight:Math.min(19,(n.height-32)/lines.length),fontSize=Math.min(15,lineHeight*.82);
    g.append(svg('text',{x:n.x+12,y:n.y+16.5,class:'node-kind'},kind.toUpperCase().slice(0,Math.max(6,Math.floor((n.width-(showStatus?52:72))/7.4)))),svg('text',{x:n.x+n.width-12,y:n.y+16.5,class:'node-number','text-anchor':'end'},num(i)));
    lines.forEach((line,j)=>g.append(svg('text',{x:n.x+12,y:n.y+30+fontSize+j*lineHeight,class:'node-label',style:`font-size:${fontSize}px`},line)));
    const mark=svg('g',{class:'glyph','data-status':n.status,transform:showStatus?`translate(${n.x+12} ${n.y+n.height-19.5})`:`translate(${n.x+n.width-42} ${n.y+7})`});mark.append(...glyphShapes(n.status));g.append(mark);
    if(showStatus)g.append(svg('text',{x:n.x+27,y:n.y+n.height-11,class:'node-status'},statusLabel(n.status)));
    g.onclick=()=>select('node',n.id);g.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select('node',n.id);}};root.append(g);
  });
  renderMinimap();updateCamera(false);
}
function renderMinimap(){
  const r=route(),map=$('minimap');map.replaceChildren();map.setAttribute('viewBox',r.bounds.join(' '));
  for(const n of r.nodes){const rect=svg('rect',{x:n.x,y:n.y,width:n.width,height:n.height,rx:6,class:'mm-node','data-node':n.id});diagramIndex.nodes.get(n.id).mm=rect;map.append(rect);}
  map.append(svg('rect',{id:'mm-view',class:'mm-view',x:0,y:0,width:0,height:0}));
}
function updateMinimapView(){
  const view=$('mm-view'),canvas=$('canvas');if(!view||!canvas.clientWidth)return;
  const c=getCamera(),b=route().bounds,vw=b[2]/c.zoom,vh=b[3]/c.zoom,scale=Math.min(canvas.clientWidth/vw,canvas.clientHeight/vh);
  const w=canvas.clientWidth/scale,h=canvas.clientHeight/scale,x=c.x-w/2,y=c.y-h/2;
  for(const[k,v]of Object.entries({x,y,width:w,height:h}))view.setAttribute(k,String(v));
  /* The overview only earns its space when part of the diagram is out of view. */
  /* SVG elements have no `hidden` property, so toggle the attribute itself. */
  $('minimap').toggleAttribute('hidden',x<=b[0]+1&&y<=b[1]+1&&x+w>=b[0]+b[2]-1&&y+h>=b[1]+b[3]-1);
}
function highlight(){
  const r=route(),selected=state.selectionType==='node'?r.nodes.find(n=>n.id===state.selected):null;
  const edge=state.selectionType==='edge'?r.edges.find(e=>e.id===state.selected):null;
  const reached=selected?(trace?connected(r,selected.id,trace):new Set([selected.id,...r.edges.flatMap(e=>e.from===selected.id?[e.to]:e.to===selected.id?[e.from]:[])])):null;
  const edgeOn=e=>selected?(trace?reached.has(e.from)&&reached.has(e.to):e.from===selected.id||e.to===selected.id):edge?.id===e.id;
  const filtered=x=>state.filter!=='all'&&x.status!==state.filter;
  const ends=edge?new Set([edge.from,edge.to]):null;
  for(const {node:n,g,mm} of diagramIndex.nodes.values()){
    const isSelected=selected?.id===n.id,near=!isSelected&&Boolean(reached?.has(n.id)||ends?.has(n.id));
    g.dataset.selected=String(isSelected);g.setAttribute('aria-pressed',String(isSelected));g.dataset.near=String(near);
    g.dataset.dim=String(filtered(n)||Boolean(reached&&!reached.has(n.id))||Boolean(ends&&!ends.has(n.id)));
    if(mm){mm.dataset.selected=String(isSelected);mm.dataset.near=String(near);}
  }
  for(const {edge:e,g,label} of diagramIndex.edges.values()){
    const on=edgeOn(e),dim=filtered(e)||((selected||edge)&&!on);
    g.dataset.selected=String(edge?.id===e.id);g.setAttribute('aria-pressed',g.dataset.selected);
    g.dataset.traced=String(Boolean(trace&&on));g.dataset.near=String(Boolean(selected&&on));g.dataset.dim=String(Boolean(dim));
    if(label){label.dataset.dim=String(Boolean(dim));label.dataset.on=String(Boolean(on));}
  }
  $('focus-selection').disabled=!(selected||edge);
}

/* Inspector */
function inspectorHead(kicker,closeLabel,onClose){
  const head=html('div',undefined,'ins-head'),top=html('div',undefined,'kicker');top.append(html('span',kicker));
  const close=html('button',undefined,'icon-button');close.setAttribute('aria-label',closeLabel);close.append(closeIcon());close.onclick=()=>{onClose();$('inspector-toggle').focus({preventScroll:true});};top.append(close);head.append(top);return head;
}
function section(title,...children){const s=html('section');s.append(html('h3',title),...children);return s;}
function openCallout(status,noun){
  if(!isOpen(status))return null;const c=html('div',undefined,'callout');c.dataset.status=status;
  c.append(html('span',status==='failed'?'FAILED':'UNRESOLVED','callout-title'),html('p',status==='failed'?`The supplied evidence failed to confirm this ${noun}.`:`The supplied evidence does not settle this ${noun}. Treat it as an open question.`));return c;
}
function excerpt(lines,from,to,cited){
  const pre=html('pre',undefined,'excerpt');
  for(let i=from;i<=to;i++){const row=html('span');if(cited(i))row.className='cited';row.append(html('span',String(i).padStart(4)+'  ','ln'),lines[i-1]??'');pre.append(row);}
  return pre;
}
function evidenceCards(refs){
  const group=html('div');group.style.cssText='display:flex;flex-direction:column;gap:8px';
  for(const ref of refs||[]){
    const source=data.sources.find(s=>s.id===ref.source),line=ref.line||1,end=ref.end_line>line?ref.end_line:line;
    const card=html('div',undefined,'evidence-card'),head=html('div',undefined,'evidence-head');
    head.append(html('span',ref.path||source?.path||'Source','evidence-path'),html('span',end>line?`L${line}–${end}`:`L${line}`,'evidence-lines'));card.append(head);
    const meta=[ref.scope||source?.scope,source?.repo].filter(Boolean).join(' · ');if(meta)card.append(html('div',meta,'evidence-meta'));
    if(source?.text){
      const lines=source.text.split(/\r?\n/),from=Math.max(1,line-2),to=Math.min(lines.length,Math.max(end+2,from+4),from+15);
      card.append(excerpt(lines,from,to,i=>i>=line&&i<=end));
      const open=html('button',undefined,'card-action');open.append(html('span','Open full source'),html('span','→'));open.onclick=()=>select('source',source.id,state.route,line);card.append(open);
    }else card.append(html('p','Source text was not included in this atlas.','evidence-meta'));
    if(ref.sha256||source?.sha256)card.append(html('p','SHA-256 '+(ref.sha256||source.sha256),'digest evidence-meta'));
    group.append(card);
  }
  return group;
}
function renderBrief(box,r){
  const routeGaps=gaps(data,'route',r.id);
  box.append(inspectorHead('READING THIS DIAGRAM','Close details',()=>{if(isSmall())body.classList.remove('sheet-open');else{body.classList.add('no-inspector');storage.set('inspector',false);}render();}));
  if(r.intent||r.summary)box.append(html('p',r.intent||r.summary,'intent'));
  const facts=html('dl',undefined,'facts');for(const[k,v]of [['Components',r.nodes.length],['Connections',r.edges.length],['Open questions',routeGaps.length]]){const d=html('div');d.append(html('dt',k),html('dd',String(v)));facts.append(d);}box.append(facts);
  if(routeGaps.length){
    const list=html('div');
    for(const g of routeGaps){const row=html(g.type==='note'?'div':'button',undefined,'question-row');row.append(statusMark(g.status),html('span',g.type==='note'?g.detail:`${g.title} · ${g.type==='edge'?'connection':'component'}`));if(g.type!=='note')row.onclick=()=>select(g.type,g.id,g.route);list.append(row);}
    box.append(section('Open questions',list));
  }
  const legend=html('ul',undefined,'legend-list');
  for(const[status,text]of [['documented','Solid: documented, statically located, observed or tested'],['unresolved','Dashed: unresolved, still an open question'],['failed','Dotted: failed, evidence did not confirm it']]){const li=html('li');const line=html('i',undefined,'legend-line');line.dataset.status=status;li.append(line,text);legend.append(li);}
  box.append(section('Reading the lines',legend,html('p','Select a component or connection to read the evidence behind it.','hint')));
}
function renderItem(box,r,item,type){
  const index=r.nodes.indexOf(item);
  box.append(inspectorHead(type==='node'?`COMPONENT · ${num(index)}`:'CONNECTION','Clear selection',clearSelection));
  const head=box.lastChild,chips=html('div',undefined,'chip-row');chips.append(statusChip(item.status));
  if(type==='node'&&(item.sublabel||item.kind))chips.append(html('span',item.sublabel||item.kind,'kind-chip'));
  head.append(html('h2',item.full_label||item.label),chips,html('p',item.detail||'No additional explanation has been authored.','detail'));
  const callout=openCallout(item.status,type==='node'?'component':'relationship');if(callout)box.append(callout);
  if(item.symbols?.length){const list=html('div',undefined,'symbol-list');for(const symbol of item.symbols){const chip=html('span',undefined,'symbol-chip');const copy=html('button');copy.setAttribute('aria-label','Copy '+symbol);copy.append(copyIcon());copy.onclick=()=>copyText(symbol,symbol);chip.append(html('span',symbol),copy);list.append(chip);}box.append(section('Symbols',list));}
  if(type==='node'){
    const group=html('div',undefined,'segmented trace');group.setAttribute('role','group');group.setAttribute('aria-label','Trace direction');
    for(const[d,label]of [['upstream','← Upstream'],['','Neighbors'],['downstream','Downstream →']]){const b=html('button',label);b.dataset.focusKey='trace:'+(d||'neighbors');b.setAttribute('aria-pressed',String(trace===d));b.onclick=()=>{trace=d;highlight();renderInspector();restoreFocus('trace:'+(d||'neighbors'));announce(d?`Tracing authored ${d} reach. This is not a live execution trace.`:'Showing direct neighbors.');};group.append(b);}
    box.append(section('Trace authored reach',group,html('p','Authored paths only, not a live execution trace.','hint')));
    const related=r.edges.filter(e=>e.from===item.id||e.to===item.id),list=html('div');
    for(const e of related){
      const outgoing=e.from===item.id,other=r.nodes.find(n=>n.id===(outgoing?e.to:e.from)),b=html('button',undefined,'relation-row');
      const copy=html('span',undefined,'rel-copy');copy.append(html('span',other.label,'rel-name'),html('span',e.label,'rel-label'));
      const status=html('span',undefined,'rel-status');status.dataset.status=e.status;status.append(glyph(e.status),statusLabel(e.status));
      b.append(html('span',outgoing?'OUT':'IN','rel-dir'),copy,status);b.setAttribute('aria-label',`${outgoing?'Outgoing to':'Incoming from'} ${other.label}: ${e.label}, ${statusLabel(e.status)}`);b.onclick=()=>select('edge',e.id);list.append(b);
    }
    box.append(section(`Connections · ${related.length}`,related.length?list:html('p','No authored relationships.','hint')));
  }else{
    const card=html('div',undefined,'endpoints'),endpoint=(id,role)=>{const n=r.nodes.find(n=>n.id===id),b=html('button',undefined,'endpoint');b.append(html('small',[role,n.sublabel||n.kind].filter(Boolean).join(' · ')),html('span',n.label,'endpoint-name'));b.onclick=()=>select('node',id);return b;};
    const link=html('div',undefined,'endpoint-link');link.dataset.status=item.status;link.setAttribute('aria-hidden','true');link.append(html('span','↓'),html('span',item.label));
    card.append(endpoint(item.from,'From'),link,endpoint(item.to,'To'));box.append(section('Endpoints',card));
  }
  box.append(section(`Source evidence · ${item.sources?.length||0}`,item.sources?.length?evidenceCards(item.sources):html('p','No source citation was supplied for this item.','hint')));
}
function renderSource(box,item){
  box.append(inspectorHead('SOURCE','Clear selection',clearSelection));
  const head=box.lastChild;head.append(html('h2',item.path,'path-title'),html('p',`${item.repo||'Source'} · ${item.scope||'authored source'}`,'detail'));
  if(item.sha256)head.append(html('p','SHA-256 '+item.sha256,'digest'));
  const lines=(item.text||'Source text is not included.').split(/\r?\n/),start=Math.max(1,(state.line||1)-8),end=Math.min(lines.length,start+239);
  const text=excerpt(lines,start,end,i=>i===state.line);text.className='source-text';
  box.append(section(`Lines ${start}–${end} of ${lines.length}${state.line?' · line '+state.line+' cited':''}`,text));
  if(item.text){const save=html('button',undefined,'outline-button');save.textContent='Save complete source text';save.onclick=()=>download(item.text,item.path.split(/[\\/]/).pop()||'source.txt','text/plain');box.append(save);}
  requestAnimationFrame(()=>text.querySelector('.cited')?.scrollIntoView({block:'center'}));
}
function renderInspector(){
  const r=route(),box=$('inspector-content');box.replaceChildren();
  const item=state.selectionType==='node'?r.nodes.find(n=>n.id===state.selected):state.selectionType==='edge'?r.edges.find(e=>e.id===state.selected):data.sources.find(s=>s.id===state.selected);
  body.classList.toggle('has-selection',Boolean(item));
  if(!item)renderBrief(box,r);else if(state.selectionType==='source')renderSource(box,item);else renderItem(box,r,item,state.selectionType);
  box.querySelector('h2')?.setAttribute('tabindex','-1');
  box.append(html('p',data.demonstration?'Illustrative example. Evidence states describe the authored example; no production observation is claimed.':'This is a retained evidence snapshot. Rendering and navigation do not qualify hardware behavior or timing accuracy.','boundary-note'));
}

/* List views */
function dataRow({status,title,tag,detail,action,actionLabel='Show on diagram →',active=false}){
  const row=html(action?'button':'article',undefined,'data-row');row.append(status?statusMark(status):html('span'));
  const copy=html('span',undefined,'row-copy'),line=html('span',undefined,'row-title-line');line.append(html('span',title,'row-title'));if(tag)line.append(html('span',tag,'row-tag'));copy.append(line);
  if(detail)copy.append(html('span',detail,'row-detail'));row.append(copy);
  if(action){row.append(html('span',actionLabel,'row-action'));row.onclick=action;}else row.append(html('span'));
  row.dataset.active=String(active);return row;
}
function renderList(){
  const box=$('list-panel');box.replaceChildren();const r=route(),all=state.scope==='all',scopeText=all?'entire atlas':'this diagram';
  const titles={relationships:'Directed relationships',evidence:'The evidence library',gaps:'Questions still open'};
  const head=html('div',undefined,'list-head'),copy=html('div'),intro=html('p','','list-intro');copy.append(html('h2',titles[state.view]),intro);copy.firstChild.tabIndex=-1;
  const field=html('label',undefined,'list-search');const glass=svg('svg',{viewBox:'0 0 20 20','aria-hidden':'true'});glass.append(svg('circle',{cx:8.5,cy:8.5,r:5.5}),svg('path',{d:'m13 13 4.5 4.5'}));
  const input=html('input');input.type='search';input.value=state.query;input.placeholder='Filter this view';input.setAttribute('aria-label','Filter '+titles[state.view].toLowerCase());field.append(glass,input);
  head.append(copy,field);const results=html('div');box.append(head);
  const routes=data.routes.filter(x=>all||x.id===r.id);
  if(state.view!=='evidence'){const filters=html('div',undefined,'filters list-filters');filters.setAttribute('role','group');filters.setAttribute('aria-label','Filter by evidence state');renderFilters(filters,state.view==='gaps'?routes.flatMap(rr=>gaps(data,'route',rr.id)):routes.flatMap(rr=>rr.edges));box.append(filters);}
  box.append(results);
  const filterNote=state.filter!=='all'&&state.view!=='evidence'?` · only ${statusLabel(state.filter).toLowerCase()}`:'';
  const draw=()=>{
    results.replaceChildren();const q=state.query.toLowerCase();let count=0;
    const groupHead=(rr,n)=>{if(!n)return;const h=html('div',undefined,'group-head');h.append(html('span',`${num(data.routes.indexOf(rr))} · ${rr.title.toUpperCase()}`),html('span',String(n)));return h;};
    if(state.view==='relationships')for(const rr of routes){
      const rows=rr.edges.filter(e=>state.filter==='all'||e.status===state.filter).map(e=>({e,a:rr.nodes.find(n=>n.id===e.from),b:rr.nodes.find(n=>n.id===e.to)})).filter(({e,a,b})=>(a.label+' '+b.label+' '+e.label+' '+(e.detail||'')).toLowerCase().includes(q));
      if(rows.length){results.append(groupHead(rr,rows.length));count+=rows.length;}
      for(const{e,a,b}of rows)results.append(dataRow({status:e.status,title:`${a.label} → ${b.label}`,tag:e.label,detail:e.detail,action:()=>showOnDiagram('edge',e.id,rr.id),active:state.selected===e.id&&state.route===rr.id}));
    }
    if(state.view==='evidence')for(const s of scopedSources(data,state.scope,state.route).filter(s=>(s.path+' '+(s.repo||'')+' '+(s.scope||'')).toLowerCase().includes(q))){count++;results.append(dataRow({title:s.path,tag:s.scope,detail:`${s.repo||'Source'}${s.text?' · '+s.text.split('\n').length+' lines':' · text not included'}`,action:()=>select('source',s.id),actionLabel:'Read source →',active:state.selected===s.id}));}
    if(state.view==='gaps')for(const rr of routes){
      const rows=gaps(data,'route',rr.id).filter(g=>(state.filter==='all'||g.status===state.filter)&&(g.title+' '+g.detail+' '+g.routeTitle).toLowerCase().includes(q));
      if(rows.length){results.append(groupHead(rr,rows.length));count+=rows.length;}
      for(const g of rows){
        if(g.type==='note'){results.append(dataRow({status:g.status,title:g.detail,tag:'Diagram note',detail:'Recorded on the diagram, not attached to one component.'}));continue;}
        const e=g.type==='edge'?rr.edges.find(e=>e.id===g.id):null,name=id=>rr.nodes.find(n=>n.id===id)?.label;
        results.append(dataRow({status:g.status,title:e?`${name(e.from)} → ${name(e.to)}`:g.title,tag:e?'Connection · '+e.label:'Component',detail:g.detail,action:()=>showOnDiagram(g.type,g.id,g.route),active:state.selected===g.id&&state.route===g.route}));
      }
    }
    intro.textContent=`${count} item${count===1?'':'s'} · ${scopeText}${filterNote}`;
    if(!count){const empty=html('div',q?'No matching entries.':'Nothing to show in this scope.','empty');empty.append(html('small',q?'Try a shorter term or choose Entire atlas.':'An empty list means no matching items were supplied; it does not establish completeness.'));results.append(empty);}
  };
  input.oninput=()=>{state.query=input.value.slice(0,500);history.replaceState(null,'',encodeState(state));draw();};draw();
}

function render(){
  const r=route(),focused=document.activeElement,focusKey=focused?.dataset?.focusKey;
  if(currentRoute!==r.id){renderDiagram();currentRoute=r.id;}
  renderDirectory();renderHeading();
  if(state.view==='diagram')renderFilters($('filters'),[...r.nodes,...r.edges]);else $('filters').replaceChildren();
  for(const button of document.querySelectorAll('[data-view]')){const active=button.dataset.view===state.view;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  $('map-panel').hidden=state.view!=='diagram';$('list-panel').hidden=state.view==='diagram';$('list-panel').setAttribute('aria-labelledby','tab-'+state.view);
  highlight();renderInspector();if(state.view!=='diagram')renderList();
  const open=isSmall()?body.classList.contains('sheet-open'):!body.classList.contains('no-inspector');$('inspector-toggle').setAttribute('aria-expanded',String(open));
  restoreFocus(focusKey);if(focused&&focused!==body)ensureFocus();
}

/* Search */
function highlightInto(parent,text,q){
  const lower=text.toLowerCase();let at=0;
  if(q)for(let i=lower.indexOf(q);i!==-1;i=lower.indexOf(q,at)){parent.append(text.slice(at,i),html('mark',text.slice(i,i+q.length)));at=i+q.length;}
  parent.append(text.slice(at));return parent;
}
function snippet(text,q){const i=text.toLowerCase().indexOf(q);if(i<0)return '';const start=Math.max(0,i-24),end=Math.min(text.length,i+q.length+40);return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'');}
function resultCopy(item,q){
  const copy=html('span',undefined,'result-copy');copy.append(highlightInto(html('span',undefined,'result-title'),item.title,q));
  const sub=html('span',undefined,'result-sub'),r=data.routes.find(x=>x.id===item.route),titleHit=item.title.toLowerCase().includes(q);
  if(item.type==='node'){
    const n=r.nodes.find(n=>n.id===item.id),symbol=(n.symbols||[]).find(s=>s.toLowerCase().includes(q));
    if(symbol)sub.append('Symbol ',highlightInto(html('span',undefined,'code'),symbol,q),' · ');
    else if(!titleHit&&n.detail){sub.append('Matched in description: ');highlightInto(sub,snippet(n.detail,q),q);sub.append(' · ');}
    sub.append(item.routeTitle);
  }else if(item.type==='edge'){
    const e=r.edges.find(e=>e.id===item.id),name=id=>r.nodes.find(n=>n.id===id)?.label;
    if(!titleHit&&e.detail){sub.append('Matched in description: ');highlightInto(sub,snippet(e.detail,q),q);sub.append(' · ');}
    sub.append(`${name(e.from)} → ${name(e.to)} · ${item.routeTitle}`);
  }else{
    const source=data.sources.find(s=>s.id===item.id);
    if(!titleHit&&source?.scope?.toLowerCase().includes(q))sub.append('Scope ',highlightInto(html('span',undefined,'code'),source.scope,q),' · ');
    sub.append(item.routeTitle+(item.line?' · line '+item.line:''));
  }
  copy.append(sub);return copy;
}
function performSearch(){
  const query=$('search-input').value,q=query.trim().toLowerCase(),rows=search(data,query,searchScope,state.route,state.filter),box=$('search-results');box.replaceChildren();
  for(const b of document.querySelectorAll('[data-search-scope]'))b.setAttribute('aria-pressed',String(b.dataset.searchScope===searchScope));
  $('search-count').textContent=query.trim()?`${rows.length}${rows.length===100?' (first 100)':''} result${rows.length===1?'':'s'} · ${searchScope==='all'?'entire atlas':'this diagram'}${state.filter==='all'?' · all evidence states':''}`:'Search component names, exact symbols, connections and source paths.';
  /* The status filter applies to search from every view, so search shows it and can clear it. */
  const filterSlot=$('search-filter');filterSlot.replaceChildren();
  if(state.filter!=='all'){const chip=html('button',undefined,'chip');chip.dataset.status=state.filter;chip.setAttribute('aria-pressed','true');chip.setAttribute('aria-label',`Only ${statusLabel(state.filter).toLowerCase()} evidence. Clear this filter`);chip.append(glyph(state.filter),`Only ${statusLabel(state.filter).toLowerCase()}`,closeIcon());chip.onclick=()=>{navigate({filter:'all'});performSearch();$('search-input').focus();};filterSlot.append(chip);}
  const groups={node:'COMPONENTS',edge:'CONNECTIONS',source:'SOURCES'},order=[...new Set(rows.map(r=>r.type))];
  for(const type of order){
    box.append(html('div',groups[type],'result-group'));
    for(const item of rows.filter(r=>r.type===type)){
      const b=html('button',undefined,'search-result'),r=data.routes.find(x=>x.id===item.route),n=item.type==='node'?r.nodes.find(n=>n.id===item.id):null;
      b.append(statusMark(item.status),resultCopy(item,q),html('span',n?(n.sublabel||n.kind||''):item.type==='source'?'source':'','result-meta'));
      b.onclick=()=>{closeDialog('search-dialog');const view=item.type==='source'?'evidence':'diagram';select(item.type,item.id,item.route,item.line,{view,frame:true,focus:true,extra:{query,scope:searchScope}});};
      box.append(b);
    }
  }
  if(query.trim()&&!rows.length)box.append(html('p','No matches. Try a shorter term, another evidence filter, or Entire atlas.','no-results'));
}
function openSearch(){if($('search-dialog').open)return;$('search-input').value=state.query;searchScope=state.scope;performSearch();$('search-dialog').showModal();$('search-input').select();}

/* Export */
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=html('a');a.href=url;a.download=name;body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Export prepared on this device.');}
function exportSVG(){
  const clone=$('diagram').cloneNode(true),r=route();clone.setAttribute('viewBox',r.bounds.join(' '));clone.setAttribute('width',String(r.bounds[2]));clone.setAttribute('height',String(r.bounds[3]));clone.setAttribute('data-theme',document.documentElement.dataset.theme);
  const license=[...document.documentElement.childNodes].find(n=>n.nodeType===8&&n.textContent.includes('MIT License'));if(license)clone.prepend(license.cloneNode(true));
  const css=svg('style',{},document.querySelector('style').textContent);clone.prepend(css);const background=svg('rect',{x:r.bounds[0],y:r.bounds[1],width:r.bounds[2],height:r.bounds[3],style:'fill:var(--canvas)'});css.after(background);
  clone.prepend(svg('desc',{},(r.summary||r.title)+' Evidence states are retained. Built with Archify Studio / Archify, MIT license.'));
  for(const e of clone.querySelectorAll('[data-dim],[data-selected],[data-traced],[data-near],[data-on]'))for(const a of ['data-dim','data-selected','data-traced','data-near','data-on','tabindex','aria-pressed'])e.removeAttribute(a);
  for(const e of clone.querySelectorAll('.edge-hit'))e.remove();
  download(new XMLSerializer().serializeToString(clone),(r.id||'diagram')+'.svg','image/svg+xml');closeDialog('export-dialog');
}

/* Startup and wiring */
function setTheme(name,save=true){document.documentElement.dataset.theme=name;for(const b of document.querySelectorAll('[data-theme-choice]'))b.setAttribute('aria-pressed',String(b.dataset.themeChoice===name));if(save)storage.set('theme',name);}
$('route-count').textContent=`${data.routes.length} diagram${data.routes.length===1?'':'s'}`;
$('edition-label').textContent=data.demonstration?'REFERENCE EDITION':'LOCAL RESEARCH EDITION';
$('dataset-note').textContent=data.demonstration?'An authored example. No live system data.':'Included evidence stays in this offline artifact.';
setTheme(storage.get('theme',null,isTheme)||(matchMedia('(prefers-color-scheme: dark)').matches?'ink':'paper'),false);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',e=>{if(!storage.get('theme',null,isTheme))setTheme(e.matches?'ink':'paper',false);});
const savedWidth=storage.get('panelWidth',null,v=>Number.isFinite(v)&&v>=280&&v<=560);if(savedWidth)document.documentElement.style.setProperty('--panel-width',savedWidth+'px');
if(storage.get('inspector',true,v=>typeof v==='boolean')===false)body.classList.add('no-inspector');
if(storage.get('directory',true,v=>typeof v==='boolean')===false&&!isNarrow())body.classList.add('nav-collapsed');
if(state.selected&&isSmall())body.classList.add('sheet-open');
$('nav-toggle').setAttribute('aria-expanded',String(navIsOpen()));
for(const b of document.querySelectorAll('[data-theme-choice]'))b.onclick=()=>{setTheme(isSmall()?(document.documentElement.dataset.theme==='paper'?'ink':'paper'):b.dataset.themeChoice);ensureFocus(document.querySelector('[data-theme-choice][aria-pressed=false]'));};
$('home').onclick=e=>{e.preventDefault();navigate({route:data.routes[0].id,view:'diagram',selected:'',query:''});};
$('nav-toggle').onclick=()=>setNav(!navIsOpen());$('scrim').onclick=()=>setNav(false);
$('inspector-toggle').onclick=()=>{if(isSmall())body.classList.toggle('sheet-open');else{body.classList.toggle('no-inspector');storage.set('inspector',!body.classList.contains('no-inspector'));}render();};
for(const button of document.querySelectorAll('[data-view]')){button.onclick=()=>navigate({view:button.dataset.view});button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let index=VIEWS.indexOf(state.view);index=e.key==='Home'?0:e.key==='End'?3:(index+(e.key==='ArrowRight'?1:3))%4;navigate({view:VIEWS[index]});$('tab-'+VIEWS[index]).focus();};}
for(const b of document.querySelectorAll('[data-scope]'))b.onclick=()=>navigate({scope:b.dataset.scope});
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);$('zoom-reset').onclick=fit;$('focus-selection').onclick=focusSelection;
$('shortcuts-open').onclick=()=>$('shortcuts-dialog').showModal();
$('search-open').onclick=openSearch;$('search-input').oninput=performSearch;
for(const b of document.querySelectorAll('[data-search-scope]'))b.onclick=()=>{searchScope=b.dataset.searchScope;performSearch();$('search-input').focus();};
$('search-input').onkeydown=e=>{const first=$('search-results').querySelector('button');if(e.key==='ArrowDown'){e.preventDefault();first?.focus();}else if(e.key==='Enter'&&first){e.preventDefault();first.click();}};
$('search-results').onkeydown=e=>{const buttons=[...$('search-results').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();buttons[Math.min(index+1,buttons.length-1)]?.focus();}if(e.key==='ArrowUp'){e.preventDefault();index<=0?$('search-input').focus():buttons[index-1].focus();}};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>closeDialog(b.dataset.close);
for(const dialog of document.querySelectorAll('dialog'))dialog.onclick=e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}};
$('export-open').onclick=()=>$('export-dialog').showModal();$('export-svg').onclick=exportSVG;$('export-html').onclick=()=>{download(originalHTML,'archify-studio-atlas.html','text/html');closeDialog('export-dialog');};
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);announce('View link copied. The recipient needs access to this atlas.');closeDialog('export-dialog');}catch{announce('Clipboard unavailable. Copy the current address from your browser.');}};
function syncFromHistory(){state=decodeState(location.hash,data);trace='';if(isSmall())body.classList.toggle('sheet-open',Boolean(state.selected));render();}
window.addEventListener('popstate',syncFromHistory);window.addEventListener('hashchange',syncFromHistory);
if('ResizeObserver' in window)new ResizeObserver(()=>requestAnimationFrame(updateMinimapView)).observe($('canvas'));else window.addEventListener('resize',updateMinimapView);
matchMedia('(max-width:980px)').addEventListener('change',e=>{const active=document.activeElement;if(!e.matches){body.classList.remove('nav-open');$('scrim').hidden=true;}$('nav-toggle').setAttribute('aria-expanded',String(navIsOpen()));if(active&&active!==body)ensureFocus();});
matchMedia('(max-width:700px)').addEventListener('change',e=>{
  const active=document.activeElement;body.classList.toggle('sheet-open',e.matches&&Boolean(state.selected));render();if(active&&active!==body)ensureFocus();
  if(e.matches&&state.selected&&state.view==='diagram'&&state.selectionType!=='source')requestAnimationFrame(()=>focusSelection(false));
});
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;
  if(e.key==='/'){e.preventDefault();openSearch();}
  else if(e.key==='?'){e.preventDefault();$('shortcuts-dialog').showModal();}
  else if(e.key==='Escape'){if(body.classList.contains('nav-open'))setNav(false);else{clearSelection();$('canvas').focus();}}
  else if(state.view==='diagram'){if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else if(e.key==='0')fit();else if(e.key==='f'||e.key==='F')focusSelection();
    else if(e.key.startsWith('Arrow')&&$('canvas').contains(document.activeElement)){const matrix=$('diagram').getScreenCTM();if(!matrix)return;e.preventDefault();const step=(e.shiftKey?240:60)/matrix.a,c=getCamera();c.x+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;c.y+=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;updateCamera();}}
});

/* Pan with drag or trackpad, pinch or ctrl+wheel to zoom */
const pointers=new Map();let pan,pinch;
const canvas=$('canvas');
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('[data-node],[data-edge]'))return;const matrix=$('diagram').getScreenCTM();if(!matrix)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
  if(pointers.size===2){const[a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:getCamera().zoom};pan=null;}
  else pan={id:e.pointerId,x:e.clientX,y:e.clientY,start:{...getCamera()},scale:matrix.a};
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const c=getCamera();
  if(pinch&&pointers.size===2){const[a,b]=[...pointers.values()];c.zoom=Math.max(.5,Math.min(4,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));updateCamera(false);}
  else if(pan&&pan.id===e.pointerId){c.x=pan.start.x-(e.clientX-pan.x)/pan.scale;c.y=pan.start.y-(e.clientY-pan.y)/pan.scale;updateCamera(false);}
});
const endPointer=e=>{
  pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;
  /* A pinch that loses one finger continues as a pan from the remaining finger. */
  if(pointers.size===1&&!pan){const[[id,p]]=pointers,matrix=$('diagram').getScreenCTM();if(matrix)pan={id,x:p.x,y:p.y,start:{...getCamera()},scale:matrix.a};}
  if(!pointers.size)pan=null;updateCamera();
};
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(e.deltaY<0?1.08:1/1.08);return;}
  if(isSmall())return;const matrix=$('diagram').getScreenCTM();if(!matrix)return;e.preventDefault();
  const c=getCamera();c.x+=e.deltaX/matrix.a;c.y+=e.deltaY/matrix.a;updateCamera();
},{passive:false});
let mapDrag=false;const minimap=$('minimap');
const mapMove=e=>{const m=minimap.getScreenCTM();if(!m)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());const c=getCamera();c.x=p.x;c.y=p.y;updateCamera(false);};
minimap.onpointerdown=e=>{mapDrag=true;minimap.setPointerCapture(e.pointerId);mapMove(e);};minimap.onpointermove=e=>{if(mapDrag)mapMove(e);};minimap.onpointerup=minimap.onpointercancel=()=>{mapDrag=false;updateCamera();};
let resizing=false;const resizeHandle=$('resize-handle');function sizePanel(value){const width=Math.max(280,Math.min(560,value,innerWidth*.45));document.documentElement.style.setProperty('--panel-width',width+'px');storage.set('panelWidth',width);}
if('ResizeObserver' in window)new ResizeObserver(([entry])=>{const width=Math.round(entry.contentRect.width+parseFloat(getComputedStyle($('inspector')).paddingLeft)+parseFloat(getComputedStyle($('inspector')).paddingRight));if(width>0)resizeHandle.setAttribute('aria-valuenow',String(width));}).observe($('inspector'));
resizeHandle.onpointerdown=e=>{resizing=true;resizeHandle.setPointerCapture(e.pointerId);};resizeHandle.onpointermove=e=>{if(resizing)sizePanel($('workbench').getBoundingClientRect().right-e.clientX);};resizeHandle.onpointerup=resizeHandle.onpointercancel=()=>{resizing=false;};resizeHandle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();sizePanel($('inspector').getBoundingClientRect().width+(e.key==='ArrowLeft'?20:-20));}};
render();
if(state.selected&&state.selectionType!=='source'&&state.view==='diagram'&&isSmall())focusSelection(false);
