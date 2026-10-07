import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
export const directory=process.env.DATA_DIR||'.data';
mkdirSync(directory,{recursive:true});
export const db=new DatabaseSync(`${directory}/studio.sqlite`);
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reservations(art_id TEXT PRIMARY KEY, session_id TEXT, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sales(session_id TEXT PRIMARY KEY,art_id TEXT NOT NULL);`);
const initial={settings:{name:'Ashley J. Phoenix',bio:'This is a space for your story. Add your artist biography in the studio dashboard.',photo:'',shipping:70,eurRate:0.134,amazon:'',contact:''},art:[{id:'study-01',title:'Between shadow & light',year:'2026',medium:'Original painting',dimensions:'Dimensions to be added',price:2400,image:'',description:'Sample listing for layout testing. Replace with your original artwork before publishing.',status:'draft'},{id:'study-02',title:'The quiet becoming',year:'2026',medium:'Original painting',dimensions:'Dimensions to be added',price:1800,image:'',description:'Sample listing for layout testing.',status:'draft'}],writing:[{id:'a-place-to-begin',title:'A place to begin',type:'Poem',excerpt:'An open page. A place for the things that ask to be felt.',body:'This is sample text for testing the reading experience.\n\nYour words belong here.',chapters:[],status:'draft'}]};
if(!db.prepare('SELECT id FROM content').get()) db.prepare('INSERT INTO content VALUES(1,?)').run(JSON.stringify(initial));
export function read(){return JSON.parse(db.prepare('SELECT value FROM content WHERE id=1').get().value)}
export function write(data){db.prepare('UPDATE content SET value=? WHERE id=1').run(JSON.stringify(data))}
export const EU=['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
export function validate(data){
 if(!data?.settings||!Array.isArray(data.art)||!Array.isArray(data.writing)) throw Error('Invalid content structure');
 if(!Number.isFinite(data.settings.shipping)||data.settings.shipping<0||!Number.isFinite(data.settings.eurRate)||data.settings.eurRate<=0) throw Error('Invalid shipping or exchange rate');
 for(const list of [data.art,data.writing]){const ids=new Set();for(const x of list){if(!x.id||ids.has(x.id)||!x.title||!['draft','published','sold'].includes(x.status))throw Error('Each entry needs a unique ID, title and valid status');ids.add(x.id)}}
 for(const a of data.art)if(!Number.isFinite(a.price)||a.price<=0)throw Error('Painting prices must be positive');
 for(const url of [data.settings.amazon,...data.art.map(a=>a.image),data.settings.photo]) if(url&&!url.startsWith('/media/')&&!/^https:\/\//.test(url))throw Error('Use HTTPS links or uploaded media');
 return data;
}
