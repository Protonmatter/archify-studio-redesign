import {STATUSES,VIEWS,validateModel,encodeState,decodeState,transitionState,search,gaps,connected,scopedSources} from './model.mjs';

/* This module is assembled inline by build.mjs; all content remains on device. */
const originalHTML='<!doctype html>\n'+document.documentElement.outerHTML;
const data=validateModel(JSON.parse(document.getElementById('studio-data').textContent));
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const html=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const svg=(tag,attrs={},text)=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
let state=decodeState(location.hash,data), currentRoute='', trace='', toastTimer;
const cameras=new Map();
const viewQueries=new Map();
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem('archify-studio:'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('archify-studio:'+key,JSON.stringify(value));}catch{/* Viewer remains usable when storage is unavailable. */}}};
const route=()=>data.routes.find(r=>r.id===state.route);
const statusLabel=s=>s.replaceAll('-',' ');
const statusBadge=s=>{const e=html('span',statusLabel(s),'evidence-status');e.dataset.status=s;return e;};
const announce=message=>{$('announcement').textContent=message;$('announcement').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('announcement').classList.remove('visible'),3000);};
const closeDialog=id=>$(id).close();

function navigate(patch,{replace=false}={}){
  const next=transitionState(state,patch,viewQueries);
  if(patch.route&&patch.route!==state.route&&!Object.hasOwn(patch,'selected')){next.selected='';next.selectionType='node';}
  state=decodeState(encodeState(next),data);trace='';
  const hash=encodeState(state);if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);
  render();
}
function select(type,id,routeId=state.route,line=undefined){
  document.body.classList.remove('no-inspector');
  navigate({route:routeId,selected:id,selectionType:type,line});
}
function renderDirectory(){
  const nav=$('routes');nav.replaceChildren();let group='';
  data.routes.forEach((r,i)=>{if(r.group!==group){group=r.group;nav.append(html('div',group,'route-group'));}
    const b=html('button',undefined,'route-link');b.dataset.route=r.id;b.setAttribute('aria-current',r.id===state.route?'page':'false');
    b.append(html('span',String(i+1).padStart(2,'0'),'number'),html('span',r.shortTitle||r.title));
    if(r.nodes.some(n=>['unresolved','failed'].includes(n.status))||r.edges.some(e=>['unresolved','failed'].includes(e.status))){const mark=html('i',undefined,'gap-mark');mark.title='Contains open questions';b.append(mark);}
    b.onclick=()=>{navigate({route:r.id});if(matchMedia('(max-width:980px)').matches)document.body.classList.remove('nav-hidden');};nav.append(b);
  });
}
function cameraKey(){return `${data.subtitle||data.title}:${state.route}`;}
function getCamera(){
  if(!cameras.has(state.route)){
    const saved=storage.get(cameraKey(),null),[x,y,w,h]=route().bounds;
    const valid=saved&&['x','y','zoom'].every(k=>Number.isFinite(saved[k]))&&saved.zoom>=.5&&saved.zoom<=4&&Math.abs(saved.x)<100000&&Math.abs(saved.y)<100000;
    cameras.set(state.route,valid?saved:{x:x+w/2,y:y+h/2,zoom:1});
  }return cameras.get(state.route);
}
function updateCamera(save=true){const c=getCamera(),bounds=route().bounds;$('diagram').setAttribute('viewBox',[c.x-bounds[2]/c.zoom/2,c.y-bounds[3]/c.zoom/2,bounds[2]/c.zoom,bounds[3]/c.zoom].join(' '));$('zoom-value').textContent=Math.round(c.zoom*100)+'%';$('zoom-out').disabled=c.zoom<=.5;$('zoom-in').disabled=c.zoom>=4;if(save)storage.set(cameraKey(),c);}
function zoom(factor){getCamera().zoom=Math.max(.5,Math.min(4,getCamera().zoom*factor));updateCamera();}
function fit(){const[x,y,w,h]=route().bounds;cameras.set(state.route,{x:x+w/2,y:y+h/2,zoom:1});updateCamera();}
function wrappedLabel(label,max=26){if(label.length<=max)return[label];const words=label.split(/\s+/);const lines=[''];for(const word of words){if((lines.at(-1)+' '+word).trim().length>max&&lines.at(-1))lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim();}return lines;}
function renderDiagram(){
  const r=route(),root=$('diagram');root.replaceChildren();root.setAttribute('aria-label',r.title+' interactive diagram');
  const defs=svg('defs');const marker=svg('marker',{id:'arrow',markerWidth:7,markerHeight:7,refX:6.5,refY:3.5,orient:'auto',markerUnits:'userSpaceOnUse'});marker.append(svg('path',{d:'M0 0 L7 3.5 L0 7 Z',class:'arrow-fill'}));defs.append(marker);root.append(defs);
  root.append(svg('text',{x:r.bounds[0]+45,y:Math.min(...r.nodes.map(n=>n.y))-30,class:'sheet-label'},'DIRECTED SYSTEM MAP / '+String(data.routes.indexOf(r)+1).padStart(2,'0')));
  r.edges.forEach(e=>{
    const g=svg('g',{'data-edge':e.id,'data-status':e.status,class:'graph-edge',tabindex:0,role:'button','aria-label':`${e.label}: ${e.from} to ${e.to}. ${statusLabel(e.status)}.`});
    g.append(svg('title',{},`${e.label} · ${statusLabel(e.status)}`),svg('path',{d:e.d,class:'edge-mask'}),svg('path',{d:e.d,class:'edge-path','marker-end':'url(#arrow)'}),svg('path',{d:e.d,class:'edge-hit'}));
    g.onclick=()=>select('edge',e.id);g.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select('edge',e.id);}};root.append(g);
  });
  for(const e of r.edges){const label=svg('text',{x:e.labelX,y:e.labelY,class:'edge-label','text-anchor':'middle'},e.label);root.append(label);}
  r.nodes.forEach((n,i)=>{
    const g=svg('g',{'data-node':n.id,class:'graph-node',tabindex:0,role:'button','aria-label':`${n.label}. ${statusLabel(n.status)}.`});
    g.append(svg('title',{},n.label+' · '+statusLabel(n.status)),svg('rect',{x:n.x,y:n.y,width:n.width,height:n.height,class:'node-box'}),svg('path',{d:`M${n.x} ${n.y+25} H${n.x+n.width}`,class:'node-top'}));
    g.append(svg('text',{x:n.x+13,y:n.y+17,class:'node-kind'},(n.sublabel||n.kind||'COMPONENT').toUpperCase().slice(0,26)),svg('text',{x:n.x+n.width-13,y:n.y+17,class:'node-number','text-anchor':'end'},String(i+1).padStart(2,'0')));
    const lines=wrappedLabel(n.label,Math.floor((n.width-24)/9));
    const lineHeight=Math.min(19,(n.height-39)/lines.length),fontSize=Math.min(17,lineHeight*.86);
    lines.forEach((line,j)=>g.append(svg('text',{x:n.x+13,y:n.y+29+fontSize+j*lineHeight,class:'node-label',style:`font-size:${fontSize}px`},line)));
    if(lines.length<3)g.append(svg('text',{x:n.x+13,y:n.y+n.height-9,class:'node-status','data-status':n.status},statusLabel(n.status)));
    g.onclick=()=>select('node',n.id);g.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select('node',n.id);}};root.append(g);
  });
  updateCamera(false);
}
function highlight(){
  const r=route(),selected=state.selectionType==='node'?r.nodes.find(n=>n.id===state.selected):null;
  const edge=state.selectionType==='edge'?r.edges.find(e=>e.id===state.selected):null;
  const reached=selected?(trace?connected(r,selected.id,trace):new Set([selected.id,...r.edges.flatMap(e=>e.from===selected.id?[e.to]:e.to===selected.id?[e.from]:[])])):null;
  for(const g of $('diagram').querySelectorAll('[data-node]')){const n=r.nodes.find(n=>n.id===g.dataset.node);g.dataset.selected=String(selected?.id===n.id);g.setAttribute('aria-pressed',g.dataset.selected);g.dataset.dim=String((state.filter!=='all'&&n.status!==state.filter)||(reached&&!reached.has(n.id))||(edge&&![edge.from,edge.to].includes(n.id)));}
  for(const g of $('diagram').querySelectorAll('[data-edge]')){const e=r.edges.find(e=>e.id===g.dataset.edge);g.dataset.selected=String(edge?.id===e.id);g.setAttribute('aria-pressed',g.dataset.selected);g.dataset.traced=String(Boolean(trace&&reached?.has(e.from)&&reached?.has(e.to)));g.dataset.dim=String((state.filter!=='all'&&e.status!==state.filter)||(selected&&!(trace?reached.has(e.from)&&reached.has(e.to):e.from===selected.id||e.to===selected.id))||(edge&&edge.id!==e.id));}
}
function sourceRefs(refs){
  const group=html('div');
  for(const ref of refs||[]){const source=data.sources.find(s=>s.id===ref.source);const d=html('details',undefined,'source-ref');d.append(html('summary',`${ref.path||source?.path||'Source'} · ${ref.line||1}${ref.end_line>ref.line?'–'+ref.end_line:''}`));
    d.append(html('small',`${ref.scope||source?.scope||'Authored source'}${source?.repo?' · '+source.repo:''}`));
    if(source?.text){const lines=source.text.split(/\r?\n/),start=Math.max(0,(ref.line||1)-4),end=Math.min(lines.length,Math.max(ref.end_line||ref.line||1,start+8)+3,start+90);d.append(html('pre',lines.slice(start,end).map((line,i)=>`${String(start+i+1).padStart(4)}  ${line}`).join('\n')));
      const b=html('button','Read source →','relation-link');b.onclick=()=>select('source',source.id,state.route,ref.line);d.append(b);
    }else d.append(html('p','Source text was not included in this atlas.'));
    if(ref.sha256||source?.sha256)d.append(html('small','SHA-256 '+(ref.sha256||source.sha256)));group.append(d);
  }return group;
}
function renderInspector(){
  const r=route(),box=$('inspector-content');box.replaceChildren();
  const item=state.selectionType==='node'?r.nodes.find(n=>n.id===state.selected):state.selectionType==='edge'?r.edges.find(e=>e.id===state.selected):data.sources.find(s=>s.id===state.selected);
  const top=html('div',undefined,'kicker');top.append(html('span',item?state.selectionType==='edge'?'RELATIONSHIP':state.selectionType==='source'?'SOURCE EVIDENCE':'COMPONENT DETAILS':'READING THIS DIAGRAM'));
  if(item){const clear=html('button','×','icon-button');clear.setAttribute('aria-label','Clear selection');clear.onclick=()=>navigate({selected:''});top.append(clear);}box.append(top);
  if(!item){box.append(html('h2','Diagram brief'),html('p',r.intent||r.summary,'intent'));const facts=[['Components',r.nodes.length],['Relationships',r.edges.length],['Open questions',gaps(data,'route',r.id).length]];for(const[k,v]of facts){const row=html('div',undefined,'fact');row.append(html('span',k),html('strong',String(v).padStart(2,'0')));box.append(row);}box.append(html('h3','Start exploring'),html('p','Select a component to understand its role. Select a connection to inspect exactly what the relationship claims.'),html('h3','Evidence boundaries'),html('p','A documented or statically located path is not proof of live execution. Unresolved and failed relationships remain visibly distinct.'));}
  else if(state.selectionType==='source'){
    box.append(html('h2',item.path),html('p',`${item.repo||'Source'} · ${item.scope||'authored source'}`));if(item.sha256)box.append(html('div','SHA-256 '+item.sha256,'symbols'));
    const lines=(item.text||'Source text is not included.').split(/\r?\n/),start=Math.max(0,(state.line||1)-8),end=Math.min(lines.length,start+240);box.append(html('p',`Lines ${start+1}–${end} of ${lines.length}${state.line?' · selected line '+state.line:''}`));
    const pre=html('pre',undefined,'source-text');lines.slice(start,end).forEach((l,i)=>{const span=html('span',`${String(start+i+1).padStart(4)}  ${l}\n`);if(start+i+1===state.line)span.className='source-line-selected';pre.append(span);});box.append(pre);
    if(item.text){const save=html('button','Save complete source text ↗','relation-link');save.onclick=()=>download(item.text,item.path.split(/[\\/]/).pop()||'source.txt','text/plain');box.append(save);}
  }else{
    box.append(html('h2',item.full_label||item.label),statusBadge(item.status),html('p',item.detail||'No additional explanation has been authored.'));
    if(item.symbols?.length)box.append(html('div',item.symbols.join('\n'),'symbols'));
    if(state.selectionType==='node'){
      const actions=html('div',undefined,'trace-actions');for(const[d,label]of [['upstream','← Upstream'],['downstream','Downstream →']]){const b=html('button',label);b.setAttribute('aria-pressed',String(trace===d));b.onclick=()=>{trace=trace===d?'':d;highlight();renderInspector();announce(trace?'Tracing authored '+trace+' reach. This is not a live execution trace.':'Trace cleared.');};actions.append(b);}box.append(actions,html('h3','Connections'));
      const list=html('div',undefined,'relations-list');for(const e of r.edges.filter(e=>e.from===item.id||e.to===item.id)){const outgoing=e.from===item.id;const other=r.nodes.find(n=>n.id===(outgoing?e.to:e.from));const b=html('button',undefined,'relation-link');b.append(html('span',(outgoing?'→ ':'← ')+other.label),html('small',e.label+' · '+statusLabel(e.status)));b.onclick=()=>select('edge',e.id);list.append(b);}if(!list.children.length)list.append(html('p','No authored relationships.'));box.append(list);
    }else{box.append(html('h3','Endpoints'));for(const[id,label]of [[item.from,'From'],[item.to,'To']]){const n=r.nodes.find(n=>n.id===id),b=html('button',undefined,'relation-link');b.append(html('small',label),html('span',n.label));b.onclick=()=>select('node',id);box.append(b);}}
    box.append(html('h3','Source evidence'));box.append(item.sources?.length?sourceRefs(item.sources):html('p','No source citation was supplied for this item.'));
  }
  box.append(html('p',data.demonstration?'Illustrative example. Evidence states describe the authored example; no production observation is claimed.':'This is a retained evidence snapshot. Rendering and navigation do not qualify hardware behavior or timing accuracy.','boundary-note'));
  $('selection-status').textContent=item?(item.label||item.path):'Select a component or a connection';
}
function dataRow(title,detail,action,{status,active=false}={}){const row=html(action?'button':'article',undefined,'data-row');const copy=html('span');copy.append(html('strong',title));if(detail)copy.append(html('small',detail));row.append(copy);if(status)row.append(statusBadge(status));if(action){row.append(html('span','↗','row-arrow'));row.onclick=action;}row.dataset.active=String(active);return row;}
function renderList(){
  const box=$('list-panel');box.replaceChildren();const r=route(),all=state.scope==='all',scopeText=all?'Entire atlas':r.shortTitle||r.title;
  const titles={relationships:'Directed relationships',evidence:'The evidence library',gaps:'Questions still open'};box.append(html('h2',titles[state.view]),html('p',scopeText+' · '+(all?'Across all diagrams.':'Only this diagram.'),'list-intro'));
  const input=html('input',undefined,'list-search');input.type='search';input.value=state.query;input.placeholder='Filter this view…';input.setAttribute('aria-label','Filter '+titles[state.view].toLowerCase());box.append(input);const results=html('div');box.append(results);
  const draw=()=>{
    results.replaceChildren();const q=state.query.toLowerCase();
    if(state.view==='relationships')for(const rr of data.routes.filter(rr=>all||rr.id===r.id))for(const e of rr.edges){const a=rr.nodes.find(n=>n.id===e.from),b=rr.nodes.find(n=>n.id===e.to);if(!(a.label+' '+b.label+' '+e.label+' '+e.detail).toLowerCase().includes(q))continue;if(state.filter!=='all'&&e.status!==state.filter)continue;results.append(dataRow(`${a.label} → ${b.label}`,e.label+(all?' · '+(rr.shortTitle||rr.title):''),()=>select('edge',e.id,rr.id),{status:e.status,active:state.selected===e.id&&state.route===rr.id}));}
    if(state.view==='evidence')for(const s of scopedSources(data,state.scope,state.route).filter(s=>(s.path+' '+s.repo+' '+s.scope).toLowerCase().includes(q))){results.append(dataRow(s.path,`${s.repo||'Source'} · ${s.scope||'authored source'}${s.text?' · '+s.text.split('\n').length+' lines':''}`,()=>select('source',s.id),{active:state.selected===s.id}));}
    if(state.view==='gaps')for(const g of gaps(data,state.scope,state.route).filter(g=>(g.title+' '+g.detail+' '+g.routeTitle).toLowerCase().includes(q))){if(state.filter!=='all'&&g.status!==state.filter)continue;results.append(dataRow(g.title,g.detail+(all?' · '+g.routeTitle:''),g.type==='note'?null:()=>select(g.type,g.id,g.route),{status:g.status,active:state.selected===g.id&&state.route===g.route}));}
    if(!results.children.length){const empty=html('div',q?'No matching entries.':'Nothing to show in this scope.','empty');empty.append(html('small',q?'Try a shorter term or choose Entire atlas.':'An empty list means no matching items were supplied; it does not establish completeness.'));results.append(empty);}
  };
  input.oninput=()=>{state.query=input.value.slice(0,500);history.replaceState(null,'',encodeState(state));draw();};draw();
}
function render(){
  const r=route();document.title=(r.shortTitle||r.title)+' · Archify Studio';
  $('route-title').textContent=r.title;$('route-summary').textContent=r.summary;$('group-name').textContent=r.group;$('sheet-number').textContent='FIG. '+String(data.routes.indexOf(r)+1).padStart(2,'0');
  $('diagram-caption').textContent=`${r.nodes.length} COMPONENTS / ${r.edges.length} CONNECTIONS`;$('provenance').textContent=r.provenance||'Authored evidence snapshot';
  $('scope').value=state.scope;$('status-filter').value=state.filter;$('gap-count').textContent=gaps(data,state.scope,state.route).length;
  for(const button of document.querySelectorAll('[data-view]')){const active=button.dataset.view===state.view;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  $('map-panel').hidden=state.view!=='diagram';$('list-panel').hidden=state.view==='diagram';$('list-panel').setAttribute('aria-labelledby','tab-'+state.view);
  if(currentRoute!==r.id){renderDiagram();currentRoute=r.id;renderDirectory();}
  highlight();renderInspector();if(state.view!=='diagram')renderList();
  const open=!document.body.classList.contains('no-inspector');$('inspector-toggle').setAttribute('aria-expanded',String(open));
}
function performSearch(){
  const query=$('search-input').value,scope=$('search-scope').value;const rows=search(data,query,scope,state.route,state.filter);const box=$('search-results');box.replaceChildren();$('search-count').textContent=query?`${rows.length}${rows.length===100?' (first 100)':''} results · ${scope==='all'?'entire atlas':'this diagram'}${state.filter!=='all'?' · '+state.filter:''}`:'Search component names, exact symbols, connections and source paths.';
  for(const item of rows){const b=html('button',undefined,'search-result');b.append(html('strong',item.title),html('small',`${item.type.toUpperCase()} · ${item.routeTitle}`));b.onclick=()=>{closeDialog('search-dialog');navigate({route:item.route,view:item.type==='source'?'evidence':'diagram',selected:item.id,selectionType:item.type,line:item.line,query,scope});document.body.classList.remove('no-inspector');render();$('inspector-toggle').focus();};box.append(b);}if(query&&!rows.length)box.append(html('p','No matches. Try a shorter term, another evidence filter, or Entire atlas.','list-intro'));
}
function openSearch(){if($('search-dialog').open)return;$('search-input').value=state.query;$('search-scope').value=state.scope;performSearch();$('search-dialog').showModal();$('search-input').focus();}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=html('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Export prepared on this device.');}
function exportSVG(){
  const clone=$('diagram').cloneNode(true),r=route();clone.setAttribute('viewBox',r.bounds.join(' '));clone.setAttribute('width',String(r.bounds[2]));clone.setAttribute('height',String(r.bounds[3]));clone.setAttribute('data-theme',document.documentElement.dataset.theme);
  const license=[...document.documentElement.childNodes].find(n=>n.nodeType===8&&n.textContent.includes('MIT License'));if(license)clone.prepend(license.cloneNode(true));
  const css=svg('style',{},document.querySelector('style').textContent);clone.prepend(css);const background=svg('rect',{x:r.bounds[0],y:r.bounds[1],width:r.bounds[2],height:r.bounds[3],fill:'var(--canvas)'});css.after(background);
  clone.prepend(svg('desc',{},r.summary+' Evidence states are retained. Built with Archify Studio / Archify, MIT license.'));
  for(const e of clone.querySelectorAll('[data-dim],[data-selected],[data-traced]')){e.removeAttribute('data-dim');e.removeAttribute('data-selected');e.removeAttribute('data-traced');e.removeAttribute('tabindex');e.removeAttribute('aria-pressed');}for(const e of clone.querySelectorAll('.edge-hit'))e.remove();
  download(new XMLSerializer().serializeToString(clone),(r.id||'diagram')+'.svg','image/svg+xml');closeDialog('export-dialog');
}

$('project-name').textContent=data.subtitle||data.title;$('route-count').textContent=String(data.routes.length).padStart(2,'0');$('dataset-note').textContent=data.demonstration?'REFERENCE EDITION\nAn authored example. No live system data.':'LOCAL RESEARCH EDITION\nIncluded evidence stays in this offline artifact.';
const savedTheme=storage.get('theme','paper');document.documentElement.dataset.theme=['paper','ink'].includes(savedTheme)?savedTheme:'paper';
const savedWidth=storage.get('panelWidth',310);if(Number.isFinite(savedWidth)&&savedWidth>=260&&savedWidth<=520)document.documentElement.style.setProperty('--panel-width',savedWidth+'px');
if(storage.get('inspector',true)===false)document.body.classList.add('no-inspector');
$('theme').onclick=()=>{const next=document.documentElement.dataset.theme==='paper'?'ink':'paper';document.documentElement.dataset.theme=next;storage.set('theme',next);$('theme').setAttribute('aria-label','Switch to '+(next==='paper'?'ink':'paper')+' theme');};
$('home').onclick=e=>{e.preventDefault();navigate({route:data.routes[0].id,view:'diagram',selected:'',query:''});};
$('nav-toggle').onclick=()=>{document.body.classList.toggle('nav-hidden');$('nav-toggle').setAttribute('aria-expanded',String(matchMedia('(max-width:980px)').matches?document.body.classList.contains('nav-hidden'):!document.body.classList.contains('nav-hidden')));};
$('inspector-toggle').onclick=()=>{document.body.classList.toggle('no-inspector');storage.set('inspector',!document.body.classList.contains('no-inspector'));render();};
for(const button of document.querySelectorAll('[data-view]')){button.onclick=()=>navigate({view:button.dataset.view});button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let index=VIEWS.indexOf(state.view);index=e.key==='Home'?0:e.key==='End'?3:(index+(e.key==='ArrowRight'?1:3))%4;navigate({view:VIEWS[index]});$('tab-'+VIEWS[index]).focus();};}
$('scope').onchange=()=>navigate({scope:$('scope').value});$('status-filter').onchange=()=>navigate({filter:$('status-filter').value});
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);$('zoom-reset').onclick=fit;
$('search-open').onclick=openSearch;$('search-input').oninput=performSearch;$('search-scope').onchange=performSearch;
$('search-input').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();$('search-results').querySelector('button')?.focus();}};
$('search-results').onkeydown=e=>{const buttons=[...$('search-results').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();buttons[Math.min(index+1,buttons.length-1)]?.focus();}if(e.key==='ArrowUp'){e.preventDefault();index<=0?$('search-input').focus():buttons[index-1].focus();}};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>closeDialog(b.dataset.close);
for(const dialog of document.querySelectorAll('dialog'))dialog.onclick=e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}};
$('export-open').onclick=()=>$('export-dialog').showModal();$('export-svg').onclick=exportSVG;$('export-html').onclick=()=>{download(originalHTML,'archify-studio-atlas.html','text/html');closeDialog('export-dialog');};
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);announce('View link copied. The recipient needs access to this atlas.');closeDialog('export-dialog');}catch{announce('Clipboard unavailable. Copy the current address from your browser.');}};
window.addEventListener('popstate',()=>{state=decodeState(location.hash,data);trace='';render();});window.addEventListener('hashchange',()=>{state=decodeState(location.hash,data);trace='';render();});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='/'){e.preventDefault();openSearch();}else if(e.key==='Escape'){navigate({selected:''});$('canvas').focus();}else if(state.view==='diagram'){if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else if(e.key==='0')fit();}});
let pan;
$('canvas').addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('[data-node],[data-edge]'))return;const matrix=$('diagram').getScreenCTM();if(!matrix)return;pan={id:e.pointerId,x:e.clientX,y:e.clientY,start:{...getCamera()},scale:matrix.a};$('canvas').setPointerCapture(e.pointerId);});
$('canvas').addEventListener('pointermove',e=>{if(!pan||pan.id!==e.pointerId)return;const c=getCamera();c.x=pan.start.x-(e.clientX-pan.x)/pan.scale;c.y=pan.start.y-(e.clientY-pan.y)/pan.scale;updateCamera(false);});
const endPan=()=>{if(pan){pan=null;updateCamera();}};$('canvas').addEventListener('pointerup',endPan);$('canvas').addEventListener('pointercancel',endPan);
$('canvas').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(e.deltaY<0?1.08:1/1.08);}},{passive:false});
let resizing=false;const resizeHandle=$('resize-handle');function sizePanel(value){const width=Math.max(260,Math.min(520,value,innerWidth*.42));document.documentElement.style.setProperty('--panel-width',width+'px');resizeHandle.setAttribute('aria-valuenow',String(Math.round(width)));storage.set('panelWidth',width);}
resizeHandle.onpointerdown=e=>{if(matchMedia('(max-width:980px)').matches)return;resizing=true;resizeHandle.setPointerCapture(e.pointerId);};resizeHandle.onpointermove=e=>{if(resizing)sizePanel($('workbench').getBoundingClientRect().right-e.clientX);};resizeHandle.onpointerup=resizeHandle.onpointercancel=()=>{resizing=false;};resizeHandle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();sizePanel($('inspector').getBoundingClientRect().width+(e.key==='ArrowLeft'?20:-20));}};
renderDirectory();render();
