import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
if(Number(process.versions.node.split('.')[0])<24){console.error('Install Node.js 24 LTS, then run npm ci and npm run local.');process.exit(1)}
if(!existsSync(join(root,'node_modules/vite/bin/vite.js'))){console.error('Run npm ci first.');process.exit(1)}
// Never load .env or inherit configured payment credentials in this local test workflow.
const env={...process.env,NODE_ENV:'development',DEV_ADMIN:'true',HOST:'127.0.0.1',PORT:'5100',SITE_URL:'http://localhost:3100',DATA_DIR:join(root,'.local-test'),GOOGLE_CLIENT_ID:'',ADMIN_EMAIL:'',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:''};
const children=[];let stopping=false;
function stop(code){if(stopping)return;stopping=true;for(const child of children)child.kill();setTimeout(()=>process.exit(code),300).unref()}
for(const args of [['server/index.js'],['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3100','--strictPort']]){
 const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'});children.push(child);child.on('error',err=>{console.error(err.message);stop(1)});child.on('exit',code=>{if(!stopping)stop(code||1)});
}
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0));
console.log('\nLocal test only. Open http://localhost:3100 in your browser.\nUse Artist studio → Enter local test studio.\nPayments and Google authentication are disabled; test data stays in .local-test.\nPress Ctrl+C to stop both servers.\n');
