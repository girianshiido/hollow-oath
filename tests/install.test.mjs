import {test} from 'node:test';import assert from 'node:assert/strict';
let count=0;
async function setup({ua='Android Chrome',standalone=false,protocol='https:'}={}){
 const media=new Map();globalThis.window=new EventTarget();
 globalThis.matchMedia=query=>{if(!media.has(query))media.set(query,Object.assign(new EventTarget(),{matches:false}));return media.get(query)};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:ua,platform:'',maxTouchPoints:1,standalone}});
 globalThis.location={protocol};const label={textContent:''};const button={hidden:false,disabled:false,hasAttribute:()=>false,querySelector:()=>label};globalThis.document={querySelectorAll:()=>[button]};
 const module=await import('../src/install.ts?test='+count++);return {module,button,media};
}
test('Install prompts are called immediately, consumed once and only browser confirmation hides promotion',async()=>{
 const {module,button}=await setup();let calls=0,choose;
 const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{calls++};event.userChoice=new Promise(resolve=>choose=resolve);
 window.dispatchEvent(event);assert.ok(event.defaultPrevented);
 const request=module.requestInstall();assert.equal(calls,1);assert.equal(button.disabled,true);assert.equal(await module.requestInstall(),'busy');
 choose({outcome:'dismissed'});assert.equal(await request,'dismissed');assert.equal(button.disabled,false);assert.equal(await module.requestInstall(),'guide');assert.equal(calls,1);
 const second=new Event('beforeinstallprompt',{cancelable:true});second.prompt=async()=>{calls++};second.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(second);
 assert.equal(await module.requestInstall(),'accepted');assert.equal(button.hidden,false);
 window.dispatchEvent(new Event('appinstalled'));assert.equal(button.hidden,true);assert.equal(await module.requestInstall(),'installed');
});
test('Standalone iOS and portable files do not offer a redundant or unsupported install button',async()=>{
 let env=await setup({ua:'iPhone Safari',standalone:true});env.module.renderInstall();assert.equal(env.button.hidden,true);
 env=await setup({protocol:'file:'});env.module.renderInstall();assert.equal(env.button.hidden,true);assert.equal(await env.module.requestInstall(),'guide');
 env=await setup({ua:'iPhone Safari'});assert.ok(env.module.installInstructions().steps.some(step=>step.includes('Safari')));
 env.media.get('(display-mode: standalone)').matches=true;env.media.get('(display-mode: standalone)').dispatchEvent(new Event('change'));assert.equal(env.button.hidden,true);
});
test('The deployed manifest has a unique app identity instead of the shared GitHub Pages origin',async()=>{
 const {readFile}=await import('node:fs/promises');const m=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 const manifestUrl='https://girianshiido.github.io/hollow-oath/manifest.webmanifest';const start=new URL(m.start_url,manifestUrl);const identity=new URL(m.id,start.origin);
 assert.equal(identity.href,'https://girianshiido.github.io/hollow-oath/');assert.equal(identity.href,start.href);assert.equal(new URL(m.scope,manifestUrl).href,start.href);assert.equal(m.display,'standalone');
});
