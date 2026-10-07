import express from 'express';
import multer from 'multer';
import Stripe from 'stripe';
import {OAuth2Client} from 'google-auth-library';
import {randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {db,read,write,validate,directory,EU} from './store.js';
const app=express(), production=process.env.NODE_ENV==='production';
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;
const google=new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const sessions=new Map();
app.post('/api/stripe/webhook',express.raw({type:'application/json'}),(req,res)=>{
 try{
 if(!stripe||!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).send('Webhook not configured');
 const event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);
 if(event.type==='checkout.session.completed'&&event.data.object.payment_status==='paid'){
 const s=event.data.object;
 const reservation=db.prepare('SELECT * FROM reservations WHERE art_id=? AND session_id=?').get(s.metadata.artId,s.id);
 if(reservation){const data=read();const art=data.art.find(a=>a.id===s.metadata.artId);if(art){art.status='sold';write(data)}db.prepare('INSERT OR IGNORE INTO sales VALUES(?,?)').run(s.id,s.metadata.artId);db.prepare('DELETE FROM reservations WHERE art_id=?').run(s.metadata.artId)}
 }
 res.json({received:true});
 }catch{res.status(400).send('Invalid webhook')}
});
app.use(express.json({limit:'3mb'}));
app.get('/api/config',(req,res)=>res.json({googleClientId:process.env.GOOGLE_CLIENT_ID||'',devLogin:!production&&process.env.DEV_ADMIN==='true',payments:!!stripe&&!!process.env.STRIPE_WEBHOOK_SECRET}));
app.get('/api/content',(req,res)=>{const d=read();d.art=d.art.filter(x=>x.status!=='draft');d.writing=d.writing.filter(x=>x.status==='published');res.json(d)});
app.post('/api/login',async(req,res)=>{
 try{if(!(req.body.dev&&!production&&process.env.DEV_ADMIN==='true')){if(!process.env.GOOGLE_CLIENT_ID||!process.env.ADMIN_EMAIL)return res.status(503).json({error:'Google sign-in is not configured yet'});const ticket=await google.verifyIdToken({idToken:req.body.credential,audience:process.env.GOOGLE_CLIENT_ID});const p=ticket.getPayload();if(!p.email_verified||!process.env.ADMIN_EMAIL||p.email.toLowerCase()!==process.env.ADMIN_EMAIL.toLowerCase())return res.status(403).json({error:'This Google account is not authorized'});}
 const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600e3);res.cookie('studio',token,{httpOnly:true,sameSite:'strict',secure:production,maxAge:8*3600e3,path:'/'});res.json({ok:true});}catch{res.status(401).json({error:'Sign-in failed'})}
});
function admin(req,res,next){const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('studio='))?.slice(7);if(!token||!(sessions.get(token)>Date.now()))return res.status(401).json({error:'Sign in to the studio'});if(req.method!=='GET'&&req.headers.origin&&![new URL(process.env.SITE_URL||'http://localhost:3100').origin,...(!production?['http://127.0.0.1:3100']:[])].includes(req.headers.origin))return res.status(403).json({error:'Invalid request origin'});next()}
app.post('/api/logout',admin,(req,res)=>{const token=req.headers.cookie?.match(/studio=([^;]+)/)?.[1];sessions.delete(token);res.clearCookie('studio');res.json({ok:true})});
app.get('/api/admin/content',admin,(req,res)=>res.json(read()));
app.put('/api/admin/content',admin,(req,res)=>{try{const d=validate(req.body);const previous=read();for(const r of db.prepare('SELECT art_id FROM reservations').all()){const old=previous.art.find(a=>a.id===r.art_id),next=d.art.find(a=>a.id===r.art_id);if(!next||next.price!==old?.price||next.status!==old?.status)throw Error('A painting at checkout cannot be removed, repriced or change availability yet');}const sold=new Set(db.prepare('SELECT art_id FROM sales').all().map(x=>x.art_id));for(const a of d.art)if(sold.has(a.id))a.status='sold';write(d);res.json({ok:true})}catch(e){res.status(400).json({error:e.message})}});
mkdirSync(join(directory,'media'),{recursive:true});
const upload=multer({dest:join(directory,'media'),limits:{fileSize:10*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
app.post('/api/admin/upload',admin,upload.single('file'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Upload a JPG, PNG or WebP image (up to 10 MB)'});const b=readFileSync(req.file.path);const valid=(b[0]===255&&b[1]===216)||(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP');if(!valid){unlinkSync(req.file.path);return res.status(400).json({error:'Invalid image file'})}res.json({url:`/media/${req.file.filename}`})});
app.use('/media',express.static(join(directory,'media'),{setHeaders:res=>res.setHeader('X-Content-Type-Options','nosniff')}));
app.post('/api/checkout',async(req,res)=>{
 if(!stripe||!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).json({error:'Purchases are not enabled yet. Please check back soon.'});
 const d=read(),art=d.art.find(a=>a.id===req.body.artId&&a.status==='published');if(!art)return res.status(409).json({error:'This painting is unavailable'});
 const now=Date.now();
 const expired=db.prepare('SELECT * FROM reservations WHERE expires<?').all(now);
 for(const r of expired){
  if(!r.session_id){db.prepare('DELETE FROM reservations WHERE art_id=? AND session_id IS NULL').run(r.art_id);continue;}
  try{const session=await stripe.checkout.sessions.retrieve(r.session_id);
   if(session.payment_status==='paid'){const latest=read();const paid=latest.art.find(a=>a.id===r.art_id);if(paid){paid.status='sold';write(latest)}db.prepare('INSERT OR IGNORE INTO sales VALUES(?,?)').run(r.session_id,r.art_id);}
   if(session.status==='expired'||session.payment_status==='paid')db.prepare('DELETE FROM reservations WHERE art_id=? AND session_id=?').run(r.art_id,r.session_id);
  }catch{/* Keep the reservation when Stripe cannot confirm its state. */}
 }
 if(read().art.find(a=>a.id===art.id)?.status!=='published')return res.status(409).json({error:'This painting is unavailable'});
 try{db.prepare('INSERT INTO reservations VALUES(?,NULL,?)').run(art.id,now+31*60e3)}catch{return res.status(409).json({error:'This original is currently reserved at checkout. Please try again later.'})}
 try{const base=process.env.SITE_URL;if(!base)throw Error('SITE_URL is required');
 const s=await stripe.checkout.sessions.create({mode:'payment',expires_at:Math.floor(now/1000)+30*60,success_url:`${base}/?payment=success`,cancel_url:`${base}/?payment=cancelled`,metadata:{artId:art.id},shipping_address_collection:{allowed_countries:EU},shipping_options:[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:Math.round(d.settings.shipping*100),currency:'dkk'},display_name:'EU shipping'}}],line_items:[{price_data:{currency:'dkk',unit_amount:Math.round(art.price*100),product_data:{name:art.title,description:'Original painting by Ashley J. Phoenix'}},quantity:1}],payment_method_types:['card']});db.prepare('UPDATE reservations SET session_id=? WHERE art_id=?').run(s.id,art.id);res.json({url:s.url});}catch(e){db.prepare('DELETE FROM reservations WHERE art_id=? AND session_id IS NULL').run(art.id);res.status(502).json({error:'Checkout could not be started. Please try again later.'})}
});
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.use(express.static('dist'));
app.use((err,req,res,next)=>res.status(400).json({error:err.message||'Request failed'}));
app.listen(process.env.PORT||5100,process.env.HOST||'0.0.0.0',()=>console.log('Zenful Reality API ready'));
