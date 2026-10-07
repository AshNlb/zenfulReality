import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
const directory=mkdtempSync(`${tmpdir()}/zenful-api-`);
const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,DATA_DIR:directory,PORT:'5199',DEV_ADMIN:'true',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
async function ready(){for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:5199/api/health');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('API startup failed')}
const base='http://127.0.0.1:5199/api';
let cookie;
async function request(path,method='GET',body){return fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined})}
test('publishing, chapters, upload, auth and unavailable payment workflow',async()=>{
 try{
 await ready();assert.equal((await request('/admin/content')).status,401);
 const login=await request('/login','POST',{dev:true});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
 const d=await(await request('/admin/content')).json();assert.equal((await(await request('/content')).json()).art.length,0);
 d.art[0].status='published';d.writing[0].status='published';d.writing[0].type='Novel';d.writing[0].chapters=[{title:'One',body:'Chapter one.'},{title:'Two',body:'Chapter two.'}];
 assert.equal((await request('/admin/content','PUT',d)).status,200);const visible=await(await request('/content')).json();assert.equal(visible.art.length,1);assert.equal(visible.writing[0].chapters.length,2);
 assert.equal((await request('/checkout','POST',{artId:d.art[0].id})).status,503);
 const invalid=structuredClone(d);invalid.art[0].price=-1;assert.equal((await request('/admin/content','PUT',invalid)).status,400);
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');const form=new FormData();form.append('file',new Blob([image],{type:'image/png'}),'test.png');const upload=await fetch(base+'/admin/upload',{method:'POST',headers:{Cookie:cookie},body:form});assert.equal(upload.status,200);const {url}=await upload.json();assert.equal((await fetch('http://127.0.0.1:5199'+url)).status,200);
 await request('/logout','POST');assert.equal((await request('/admin/content')).status,401);
 }finally{child.kill();await once(child,'exit');rmSync(directory,{recursive:true,force:true})}
});
