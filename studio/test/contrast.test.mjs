import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../studio.css',import.meta.url),'utf8');
function luminance(hex){const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
function ratio(a,b){const[x,y]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return(y+.05)/(x+.05);}
for(const [name,pattern]of [['paper',/:root\{([^}]+)\}/],['ink',/:root\[data-theme=ink\]\{([^}]+)\}/]]){
  test(`${name}: base text and diagram boundaries have sufficient contrast`,()=>{
    const vars=Object.fromEntries([...css.match(pattern)[1].matchAll(/--([\w-]+):\s*(#[a-f0-9]{6})/g)].map(m=>[m[1],m[2]]));
    for(const text of ['ink','muted','accent','amber','rose'])assert(ratio(vars[text],vars.paper)>=4.5,`${text} text contrast`);
    assert(ratio(vars['strong-rule'],vars.canvas)>=3,'diagram boundary contrast');
  });
}
