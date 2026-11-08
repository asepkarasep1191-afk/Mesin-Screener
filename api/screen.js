'use strict';
// Mesin screening otomatis price action + VWAP (XAUUSD dan forex, M5 dan M15).
// Satu file untuk Vercel: simpan sebagai api/screen.js
//   /api/screen?key=SCAN_KEY            -> pemindaian (dipanggil cron tiap 5 menit)
//   /api/screen?view=dash&key=DASH_KEY  -> dashboard
//   /api/screen?view=state&key=DASH_KEY -> data JSON untuk dashboard
// Mesin screening price action + VWAP. Sama dengan versi halaman, status dipisah ke objek S.
const PAIRS={XAUUSD:{td:'XAU/USD',d:2,pip:.1,pv:10,b:4080},EURUSD:{td:'EUR/USD',d:5,pip:1e-4,pv:10,b:1.085},GBPUSD:{td:'GBP/USD',d:5,pip:1e-4,pv:10,b:1.29},AUDUSD:{td:'AUD/USD',d:5,pip:1e-4,pv:10,b:.66},NZDUSD:{td:'NZD/USD',d:5,pip:1e-4,pv:10,b:.6},USDCAD:{td:'USD/CAD',d:5,pip:1e-4,pv:7.3,b:1.38},USDCHF:{td:'USD/CHF',d:5,pip:1e-4,pv:11,b:.88},USDJPY:{td:'USD/JPY',d:3,pip:.01,j:1,b:152},EURJPY:{td:'EUR/JPY',d:3,pip:.01,j:1,b:165},GBPJPY:{td:'GBP/JPY',d:3,pip:.01,j:1,b:196}};
const TFM={M5:5,M15:15};
function newState(){return{setups:[],hist:[],seen:[],bal:+process.env.BALANCE||1000,rsk:+process.env.RISK_PCT||1,last:{},updated:0}}
function ema(a,n){const k=2/(n+1);let e=a[0];return a.map((x,i)=>i?(e=x*k+e*(1-k)):e)}
function atrS(b,n=14){const o=[];let a=0;for(let i=0;i<b.length;i++){const tr=i?Math.max(b[i].h-b[i].l,Math.abs(b[i].h-b[i-1].c),Math.abs(b[i].l-b[i-1].c)):b[i].h-b[i].l;a=i<n?(a*i+tr)/(i+1):(a*(n-1)+tr)/n;o.push(a)}return o}
function mir(b){return b.map(x=>({t:x.t,o:-x.o,h:-x.l,l:-x.h,c:-x.c,v:x.v}))}
function prep(b){const c=b.map(x=>x.c);let day=-1,pv=0,vv=0,p2=0,cn=0;const vw=[],sd=[],ct=[];
b.forEach(x=>{const d=Math.floor(x.t/864e5);if(d!==day){day=d;pv=vv=p2=cn=0}const tp=(x.h+x.l+x.c)/3;pv+=tp*x.v;vv+=x.v;p2+=tp*tp*x.v;cn++;const m=pv/vv;vw.push(m);sd.push(Math.sqrt(Math.max(0,p2/vv-m*m)));ct.push(cn)});
return{vw,sd,ct,e21:ema(c,21),e50:ema(c,50),at:atrS(b)}}
function rej(b,i,at){const x=b[i],p=b[i-1],r=x.h-x.l;if(r<.5*at)return null;
if((Math.min(x.o,x.c)-x.l)>=.55*r&&(x.c-x.l)/r>=.6)return 'Pin bar';
if(x.c>x.o&&p.c<p.o&&x.c>=p.o&&x.o<=p.c&&(x.c-x.o)>=.4*at)return 'Engulfing';
return null}
function swH(b,upto,w=3){for(let p=upto-w;p>=w&&p>upto-60;p--){let ok=true;for(let j=p-w;j<=p+w;j++){if(j!==p&&b[j].h>=b[p].h){ok=false;break}}if(ok)return p}return -1}
function lvl(entry,sl,at){let R=entry-sl;if(R<.6*at){sl=entry-.6*at;R=.6*at}return R>1.8*at?null:{sl,R}}
function det(b,P,i,L){
const x=b[i],at=P.at[i],vw=P.vw[i],sd=P.sd[i],up=P.e21[i]>P.e50[i];
if(i<60||!(at>0))return null;
const rj=rej(b,i,at);if(!rj)return null;
const nm=rj+(L?' bullish':' bearish'),entry=x.h+.05*at,q=lvl(entry,x.l-.15*at,at);if(!q)return null;
const R=q.R,std=[entry+R,entry+2*R,entry+3*R],mk=(type,tp,why)=>({type,d:1,tSig:x.t,entry,sl:q.sl,tp,why});
const p=swH(b,i-2);
if(p>0&&up&&x.c>vw){const Lv=b[p].h;let j=-1;for(let k=p+1;k<i;k++){const y=b[k];if(y.c>Lv+.1*P.at[k]&&(y.c-y.o)>=.5*(y.h-y.l)){j=k;break}}
if(j>0&&x.l<=Lv+.2*at&&x.l>=Lv-.4*at&&x.c>Lv){let ok=true;for(let k=j;k<=i;k++)if(b[k].c<Lv-.4*at){ok=false;break}
if(ok)return mk('Break & retest',std,['Harga menembus swing '+(L?'high':'low')+' lalu retest dan bertahan',nm+' di area retest','Searah tren dan '+(L?'di atas':'di bawah')+' VWAP'])}}
if(P.ct[i]>=12&&up&&vw>P.vw[i-6]&&x.c>vw&&x.l<=vw+.15*at&&x.l>=vw-.8*at)return mk('VWAP pullback',std,['Tren '+(L?'naik':'turun')+': EMA21 '+(L?'di atas':'di bawah')+' EMA50, VWAP '+(L?'menanjak':'menurun'),'Harga kembali ke VWAP, lalu '+nm+' menutup '+(L?'di atasnya':'di bawahnya')]);
if(P.ct[i]>=12&&Math.abs(P.e21[i]-P.e50[i])<.5*at&&sd>0&&vw-x.l>=1.2*at&&x.l<=vw-2*sd+.1*at&&vw>entry+1.2*R)return mk('VWAP band reversal',[entry+(vw-entry)/2,vw,vw+sd],['Pasar sideways: EMA21 dan EMA50 berdekatan','Harga menembus pita VWAP 2 deviasi sisi '+(L?'bawah':'atas')+', lalu '+nm,'Target kembali ke VWAP']);
return null}
function scanBars(b){const out=[],Pl=prep(b),m=mir(b),Ps=prep(m),n=b.length;
for(let i=Math.max(60,n-3);i<n;i++){const a=det(b,Pl,i,1);if(a)out.push(a);const s=det(m,Ps,i,0);if(s){s.d=-1;s.entry=-s.entry;s.sl=-s.sl;s.tp=s.tp.map(v=>-v);out.push(s)}}
return out}
function parse(t){const out=[];const re=/^\s*(?:(\d{9,13})|(\d{4})[-.\/](\d\d)[-.\/](\d\d)(?:[T\s,;]+(\d\d):(\d\d)(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)?)?)[\s,;]*/;
t.split(/\r?\n/).forEach(r=>{const m=r.match(re);if(!m)return;const nu=(r.slice(m[0].length).match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);if(nu.length<4)return;
const ts=m[1]?(m[1].length>=12?+m[1]:+m[1]*1e3):Date.UTC(+m[2],+m[3]-1,+m[4],+(m[5]||0),+(m[6]||0));
const[o,h,l,c]=nu;out.push({t:ts,o,h:Math.max(o,h,l,c),l:Math.min(o,h,l,c),c,v:nu[4]>0?nu[4]:1})});
out.sort((a,b)=>a.t-b.t);return out.filter((x,i)=>!i||x.t!==out[i-1].t)}
function isEnd(s){return s.st==='SL_HIT'||s.st==='BE_STOP'||s.st==='TP3_HIT'||s.st==='EXPIRED'}
function adv(s,b){const L=s.d>0;
for(const x of b){if(x.t<=s.last)continue;s.last=x.t;
const hit=v=>L?x.h>=v:x.l<=v,stp=v=>L?x.l<=v:x.h>=v,ev=m=>s.ev.push([m,x.t]);
if(s.st==='PENDING'){s.age++;
if(hit(s.entry)){s.st='OPEN';ev('Entry terisi');if(stp(s.cur)){s.st='SL_HIT';ev('Kena SL di candle yang sama')}}
else if(stp(s.cur)||s.age>=4){const bad=stp(s.cur);s.st='EXPIRED';ev(bad?'Batal: harga menembus SL sebelum entry':'Kedaluwarsa: entry tidak terpicu dalam 4 candle')}
if(isEnd(s))break;continue}
if(s.st==='OPEN'){
if(stp(s.cur)){s.st=s.be?'BE_STOP':'SL_HIT';ev(s.be?'Kembali ke BE, ditutup tanpa rugi':'Kena SL');break}
if(!s.be&&hit(s.tp1)){s.be=true;s.cur=s.entry;ev('TP1 kena, SL dipindah ke BE')}
if(s.be&&!s.t2&&hit(s.tp2)){s.t2=true;ev('TP2 kena')}
if(hit(s.tp3)){s.st='TP3_HIT';ev('TP3 kena, ditutup');break}}}}
function lotCalc(S,sym,entry,sl){const P=PAIRS[sym],pips=Math.abs(entry-sl)/P.pip,pv=P.j?1000/(sym==='USDJPY'?entry:150):P.pv,risk=S.bal*S.rsk/100;return{pips,lots:risk/(pips*pv),risk}}
function mkSetup(S,pair,tf,c){const q=lotCalc(S,pair,c.entry,c.sl);return{id:pair+tf+c.tSig+c.type+c.d,pair,tf,type:c.type,d:c.d,tSig:c.tSig,last:c.tSig,entry:c.entry,sl0:c.sl,cur:c.sl,tp1:c.tp[0],tp2:c.tp[1],tp3:c.tp[2],why:c.why,st:'PENDING',be:false,t2:false,age:0,ev:[],pips:q.pips,lots:q.lots,risk:q.risk,r3:Math.abs(c.tp[2]-c.entry)/Math.abs(c.entry-c.sl)}}
function slim(s){return{id:s.id,pair:s.pair,tf:s.tf,type:s.type,d:s.d,tSig:s.tSig,tEnd:s.last,entry:s.entry,sl0:s.sl0,tp1:s.tp1,tp2:s.tp2,tp3:s.tp3,st:s.st,be:s.be,t2:s.t2,r3:s.r3,pips:s.pips}}
function proc(S,key,bars,noNew){const[pair,tf]=key.split('|'),mine=()=>S.setups.filter(s=>s.pair===pair&&s.tf===tf),before=new Map(mine().map(s=>[s.id,s.ev.length])),closed=[],added=[];
for(const s of mine()){adv(s,bars);if(isEnd(s)){S.setups=S.setups.filter(x=>x!==s);S.hist.unshift(slim(s));closed.push(s)}}
if(!noNew)for(const c of scanBars(bars)){const k=pair+'|'+tf+'|'+c.type+'|'+c.d+'|'+c.tSig;
if(S.seen.includes(k)||S.setups.some(x=>x.pair===pair&&x.tf===tf&&x.d===c.d))continue;
S.seen.push(k);const s=mkSetup(S,pair,tf,c);adv(s,bars);if(!isEnd(s)){S.setups.push(s);added.push(s)}}
S.seen=S.seen.slice(-800);S.hist=S.hist.slice(0,800);
const upd=S.setups.filter(s=>before.has(s.id)&&s.ev.length>before.get(s.id)).map(s=>({s,ev:s.ev.slice(before.get(s.id))}));
return{added,upd,closed:closed.map(s=>({s,ev:s.ev.slice(before.get(s.id)||0)}))}}
function stats(h){const f=h.filter(s=>s.st!=='EXPIRED'),c=k=>f.filter(s=>s.st===k).length,r1=s=>Math.abs(s.tp1-s.entry)/Math.abs(s.entry-s.sl0),n=f.length,t1=f.filter(s=>s.be).length,tp=c('TP3_HIT');
const R=f.reduce((a,s)=>a+(s.st==='SL_HIT'?-1:s.st==='TP3_HIT'?s.r3:0),0),R50=f.reduce((a,s)=>a+(s.st==='SL_HIT'?-1:s.st==='BE_STOP'?.5*r1(s):s.st==='TP3_HIT'?.5*r1(s)+.5*s.r3:0),0);
return{n,sl:c('SL_HIT'),be:c('BE_STOP'),tp,t1,expired:h.length-n,wrTp1:n?t1/n:null,wrTp3:n?tp/n:null,netR:R,netR50:R50}}
function agg(h,kf){const m={};for(const s of h){if(s.st==='EXPIRED')continue;(m[kf(s)]=m[kf(s)]||[]).push(s)}return Object.entries(m).map(([k,a])=>Object.assign({k},stats(a))).sort((a,b)=>b.n-a.n)}
function aggregate(b5,k=3){const out=[],step=k*3e5;let cur=null;for(const x of b5){const bt=Math.floor(x.t/step)*step;if(!cur||cur.t!==bt){if(cur&&cur.n===k)out.push(cur);cur={t:bt,o:x.o,h:x.h,l:x.l,c:x.c,v:x.v,n:1}}else{cur.h=Math.max(cur.h,x.h);cur.l=Math.min(cur.l,x.l);cur.c=x.c;cur.v+=x.v;cur.n++}}if(cur&&cur.n===k)out.push(cur);return out.map(x=>({t:x.t,o:x.o,h:x.h,l:x.l,c:x.c,v:x.v}))}
function gen(sym,tf,n,from){const tm=TFM[tf]*6e4,vp=(sym==='XAUUSD'?7e-4:3.5e-4)*Math.sqrt(TFM[tf]/5);
let x=from?from.c:PAIRS[sym].b*(1+(Math.random()-.5)*.01),t=from?from.t+tm:Math.floor(Date.now()/tm)*tm-n*tm,dr=(Math.random()-.5)*vp*.5,ph=0;const out=[];
for(let i=0;i<n;i++){if(ph--<=0){dr=(Math.random()-.5)*vp*.5;ph=8+Math.floor(Math.random()*25)}
const o=x,c=o*(1+dr+(Math.random()-.5)*vp*1.6),h=Math.max(o,c)*(1+Math.random()*vp*.5),l=Math.min(o,c)*(1-Math.random()*vp*.5);x=c;out.push({t,o,h,l,c,v:50+Math.floor(Math.random()*450)});t+=tm}
return out}



const E={PAIRS,TFM,newState,proc,stats,agg,aggregate};

// ---------- penyimpanan: Upstash Redis lewat REST ----------
const RURL=()=>process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
const RTOK=()=>process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
async function rcmd(args){
  if(!RURL()||!RTOK())throw new Error('Variabel Upstash Redis belum diisi');
  const r=await fetch(RURL(),{method:'POST',headers:{Authorization:'Bearer '+RTOK(),'Content-Type':'application/json'},body:JSON.stringify(args)});
  const j=await r.json();if(j.error)throw new Error('Redis: '+j.error);return j.result}
const store={
  load:async()=>{const v=await rcmd(['GET','mss:state']);return v?JSON.parse(v):null},
  save:s=>rcmd(['SET','mss:state',JSON.stringify(s)]),
  lock:async()=>(await rcmd(['SET','mss:lock','1','NX','EX','50']))==='OK',
  unlock:()=>rcmd(['DEL','mss:lock'])};

// ---------- data pasar: Twelve Data (M5; M15 dibuat dari M5) ----------
async function fetchM5(pair,apiKey){
  const sym=PAIRS[pair]&&PAIRS[pair].td;if(!sym)throw new Error('Pair tidak dikenal: '+pair);
  const url='https://api.twelvedata.com/time_series?symbol='+encodeURIComponent(sym)+'&interval=5min&outputsize=350&timezone=UTC&apikey='+encodeURIComponent(apiKey);
  const r=await fetch(url),j=await r.json();
  if(j.status==='error'||!Array.isArray(j.values))throw new Error(j.message||'Respons Twelve Data tidak valid');
  const now=Date.now();
  return j.values.map(v=>{const m=String(v.datetime).match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/);if(!m)return null;const vol=+v.volume;
    return{t:Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]),o:+v.open,h:+v.high,l:+v.low,c:+v.close,v:vol>0?vol:1}})
    .filter(b=>b&&isFinite(b.c)&&b.t+3e5<=now).sort((a,b)=>a.t-b.t)}
async function notify(text){
  const tok=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;if(!tok||!chat)return false;
  const r=await fetch('https://api.telegram.org/bot'+tok+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat,text})});return r.ok}

// ---------- pemindai ----------
const env=(k,d)=>process.env[k]||d;
const num=(k,d)=>(process.env[k]!=null&&process.env[k]!==''&&isFinite(+process.env[k]))?+process.env[k]:d;
function inSession(now){const d=new Date(now),day=d.getUTCDay(),h=d.getUTCHours();if(day===0||day===6)return false;return h>=num('SESSION_START',7)&&h<num('SESSION_END',20)}
const hmT=t=>new Date(t).toISOString().slice(11,16);
const head=s=>(s.d>0?'BUY ':'SELL ')+s.pair+' '+s.tf;
function msgNew(s){const f=v=>v.toFixed(PAIRS[s.pair].d);
  return (s.d>0?'🟢':'🔴')+' SETUP BARU '+head(s)+'\n'+s.type+'\nEntry ('+(s.d>0?'buy stop':'sell stop')+'): '+f(s.entry)+'\nSL: '+f(s.sl0)+'\nTP1: '+f(s.tp1)+'\nTP2: '+f(s.tp2)+'\nTP3: '+f(s.tp3)+'\nLot '+(s.lots<0.01?'<0.01':s.lots.toFixed(2))+', risiko $'+s.risk.toFixed(2)+'\n'+s.why.join('\n')+'\nBerlaku 4 candle.'}
const msgEv=(s,ev)=>'ℹ️ '+head(s)+' ('+s.type+')\n'+ev.map(e=>hmT(e[1])+' '+e[0]).join('\n');
function msgEnd(s,ev){const icon={SL_HIT:'❌',BE_STOP:'➖',TP3_HIT:'✅',EXPIRED:'⌛'}[s.st];return icon+' '+head(s)+' ('+s.type+') selesai\n'+ev.map(e=>hmT(e[1])+' '+e[0]).join('\n')}

async function scanHandler(req,res){
  const given=(req.query&&req.query.key)||String(req.headers.authorization||'').replace('Bearer ','');
  const ok=[process.env.SCAN_KEY,process.env.CRON_SECRET].filter(Boolean);
  if(!ok.length||!ok.includes(given))return res.status(401).json({error:'kunci salah'});
  const apiKey=process.env.TWELVEDATA_API_KEY;
  if(!apiKey)return res.status(500).json({error:'TWELVEDATA_API_KEY belum diisi'});
  let locked=false;
  try{
    locked=await store.lock();
    if(!locked)return res.status(200).json({skipped:'pemindaian sebelumnya masih berjalan'});
    const now=Date.now(),force=req.query&&req.query.force==='1';
    const S=(await store.load())||E.newState();
    S.bal=num('BALANCE',S.bal);S.rsk=num('RISK_PCT',S.rsk);
    const pairs=env('PAIRS','XAUUSD,EURUSD,GBPUSD,USDJPY').split(',').map(x=>x.trim()).filter(x=>E.PAIRS[x]);
    const tfs=env('TIMEFRAMES','M5,M15').split(',').map(x=>x.trim()).filter(x=>E.TFM[x]);
    const sess=force||inSession(now),notes=[],errors=[],scanned=[];
    const todo=pairs.filter(p=>sess||S.setups.some(s=>s.pair===p)); // luar sesi: hanya pantau setup yang berjalan
    const got=await Promise.allSettled(todo.map(p=>fetchM5(p,apiKey)));
    todo.forEach((pair,i)=>{
      const g=got[i];if(g.status!=='fulfilled'){errors.push(pair+': '+g.reason.message);return}
      const b5=g.value;if(b5.length<100){errors.push(pair+': data kurang ('+b5.length+' candle)');return}
      S.last[pair]=b5[b5.length-1].t;
      for(const tf of tfs){
        const bars=tf==='M5'?b5:E.aggregate(b5,E.TFM[tf]/5);if(bars.length<70)continue;
        const r=E.proc(S,pair+'|'+tf,bars,!sess);
        r.added.forEach(s=>notes.push(msgNew(s)));r.upd.forEach(u=>notes.push(msgEv(u.s,u.ev)));r.closed.forEach(c=>notes.push(msgEnd(c.s,c.ev)))}
      scanned.push(pair)});
    S.updated=now;await store.save(S);
    for(const n of notes){try{await notify(n)}catch(e){errors.push('telegram: '+e.message)}}
    return res.status(200).json({ok:true,session:sess,scanned,notes:notes.length,active:S.setups.length,history:S.hist.length,errors});
  }catch(e){return res.status(500).json({error:e.message})}
  finally{if(locked){try{await store.unlock()}catch(e){}}}}

async function stateHandler(req,res){
  const dk=process.env.DASH_KEY;
  if(dk&&(req.query&&req.query.key)!==dk)return res.status(401).json({error:'kunci salah'});
  try{
    const S=(await store.load())||E.newState();res.setHeader('Cache-Control','no-store');
    return res.status(200).json({updated:S.updated,last:S.last,
      setups:S.setups.map(s=>({pair:s.pair,tf:s.tf,type:s.type,d:s.d,tSig:s.tSig,entry:s.entry,cur:s.cur,sl0:s.sl0,tp1:s.tp1,tp2:s.tp2,tp3:s.tp3,st:s.st,be:s.be,t2:s.t2,pips:s.pips,lots:s.lots,risk:s.risk,why:s.why,ev:s.ev.slice(-3)})),
      hist:S.hist.slice(0,100),stats:E.stats(S.hist),byPair:E.agg(S.hist,s=>s.pair+' '+s.tf),byType:E.agg(S.hist,s=>s.type),
      decimals:Object.fromEntries(Object.entries(E.PAIRS).map(([k,v])=>[k,v.d]))});
  }catch(e){return res.status(500).json({error:e.message})}}

// ---------- dashboard ----------
const DASH=String.raw`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Dashboard Screening</title>
<style>
:root{--bg:#EDF1F4;--card:#fff;--ink:#16222E;--mut:#5B6B7A;--line:#D5DDE4;--gold:#A8741A;--up:#17785A;--dn:#BF3B35;color-scheme:light light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
@media (prefers-color-scheme:dark){:root{--bg:#101820;--card:#18232E;--ink:#E8EEF3;--mut:#93A3B2;--line:#2A3846;--gold:#E0B04E;--up:#46C597;--dn:#F0716A;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
.wrap{max-width:1000px;margin:0 auto;padding:18px 16px 40px}
h1{font-size:24px;margin:0 0 2px}h2{font-size:18px;margin:0 0 8px}
.sub{color:var(--mut);margin:0 0 14px;font-size:13.5px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:14px}
.kp{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media(min-width:700px){.kp{grid-template-columns:repeat(4,1fr)}}
.kp div{border:1px solid var(--line);border-radius:8px;padding:10px}
.kp b{display:block;font-size:22px}.kp span{font-size:12.5px;color:var(--mut)}
.up{color:var(--up)}.dn{color:var(--dn)}.gd{color:var(--gold)}
.tk{border-left:6px solid var(--mut)}.tk.long{border-left-color:var(--up)}.tk.short{border-left-color:var(--dn)}
.th{display:flex;justify-content:space-between;align-items:center;gap:8px}
.dir{font-size:20px;font-weight:700;margin:0}.long .dir{color:var(--up)}.short .dir{color:var(--dn)}
.bd{font-size:12px;border:1px solid var(--line);border-radius:99px;padding:2px 10px;color:var(--mut);white-space:nowrap}
.meta{color:var(--mut);margin:2px 0 8px;font-size:13.5px}
.lv{display:grid;grid-template-columns:1fr auto;margin:0}.lv>div{display:contents}
.lv dt,.lv dd{margin:0;padding:6px 0;border-top:1px solid var(--line)}.lv dd{text-align:right;font-weight:600}
ul{margin:6px 0 0;padding-left:18px;font-size:13.5px}
table{width:100%;border-collapse:collapse;font-size:13.5px}th,td{padding:7px 4px;border-top:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}th{color:var(--mut);font-weight:500;border-top:0}
.sc{overflow-x:auto}
.cr{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line)}.cr p{margin:0}
.empty{color:var(--mut);margin:0}
.warn{font-size:12.5px;color:var(--mut)}
</style>
</head>
<body>
<div class="wrap">
<h1>Dashboard Screening</h1>
<p class="sub" id="upd">Memuat…</p>
<section class="card"><h2>Statistik</h2><div class="kp" id="kp"></div><p class="warn" id="note" style="margin:10px 0 0"></p></section>
<section><h2>Setup aktif</h2><div id="act"><p class="empty">Memuat…</p></div></section>
<section class="card"><h2>Per pair dan timeframe</h2><div class="sc" id="bp"></div></section>
<section class="card"><h2>Per jenis setup</h2><div class="sc" id="bt"></div></section>
<section class="card"><h2>Log riwayat</h2><div id="hist"><p class="empty">Memuat…</p></div></section>
<p class="warn">Statistik dihitung dari log mesin dan hanya berarti setelah puluhan setup selesai. Bukan nasihat keuangan.</p>
</div>
<script>
const $=id=>document.getElementById(id),Q=new URLSearchParams(location.search).get('key')||'';
const hm=t=>new Date(t).toISOString().slice(0,16).replace('T',' ');
const STL={PENDING:'Menunggu entry',OPEN:'Berjalan',SL_HIT:'Kena SL',BE_STOP:'Berhenti di BE',TP3_HIT:'TP3 kena',EXPIRED:'Kedaluwarsa'};
const pc=v=>v==null?'-':(v*100).toFixed(0)+'%',rr=v=>(v>=0?'+':'')+v.toFixed(1)+'R';
let D={};
function f(p,v){return v.toFixed(D.decimals&&D.decimals[p]!=null?D.decimals[p]:2)}
function card(s){const L=s.d>0,on=s.st==='OPEN'&&s.be;
return '<article class="card tk '+(L?'long':'short')+'"><div class="th"><p class="dir">'+(L?'BUY ':'SELL ')+s.pair+' '+s.tf+'</p><span class="bd">'+(on?'BE aktif':STL[s.st])+'</span></div><p class="meta">'+s.type+', sinyal '+hm(s.tSig).slice(11)+' UTC</p><dl class="lv">'
+'<div><dt class="gd">Entry ('+(L?'buy stop':'sell stop')+')</dt><dd class="gd">'+f(s.pair,s.entry)+'</dd></div>'
+'<div><dt class="dn">'+(s.be?'SL (BE)':'Stop loss')+'</dt><dd class="dn">'+f(s.pair,s.cur)+'</dd></div>'
+'<div><dt class="up">TP1'+(s.be?' (kena)':'')+'</dt><dd class="up">'+f(s.pair,s.tp1)+'</dd></div>'
+'<div><dt class="up">TP2'+(s.t2?' (kena)':'')+'</dt><dd class="up">'+f(s.pair,s.tp2)+'</dd></div>'
+'<div><dt class="up">TP3</dt><dd class="up">'+f(s.pair,s.tp3)+'</dd></div>'
+'<div><dt>Jarak SL</dt><dd>'+f(s.pair,Math.abs(s.entry-s.sl0))+' ('+s.pips.toFixed(1)+' pip)</dd></div>'
+'<div><dt>Ukuran posisi</dt><dd>'+(s.lots<.01?'kurang dari 0,01':s.lots.toFixed(2))+' lot</dd></div></dl><ul>'+s.why.map(w=>'<li>'+w+'</li>').join('')+'</ul>'
+s.ev.map(e=>'<p class="meta" style="margin:2px 0">'+hm(e[1]).slice(11)+' '+e[0]+'</p>').join('')+'</article>'}
function tbl(a){return a.length?'<table><tr><th>Grup</th><th>Trade</th><th>SL</th><th>BE</th><th>TP3</th><th>WR TP1</th><th>R</th></tr>'+a.map(r=>'<tr><td>'+r.k+'</td><td>'+r.n+'</td><td class="dn">'+r.sl+'</td><td>'+r.be+'</td><td class="up">'+r.tp+'</td><td>'+pc(r.wrTp1)+'</td><td>'+rr(r.netR50)+'</td></tr>').join('')+'</table>':'<p class="empty">Belum ada data.</p>'}
function render(){const s=D.stats||{n:0},k=[['Trade selesai',s.n,''],['Kena SL',s.sl,'dn'],['Kena BE',s.be,''],['TP3 penuh',s.tp,'up'],['Capai TP1',s.t1,'gd'],['Win rate TP1',pc(s.wrTp1),'gd'],['Win rate TP3',pc(s.wrTp3),'up'],['Total R (tutup 50% di TP1)',s.n?rr(s.netR50):'-',s.netR50>=0?'up':'dn']];
$('kp').innerHTML=k.map(x=>'<div><b class="'+x[2]+'">'+x[1]+'</b><span>'+x[0]+'</span></div>').join('');
$('note').textContent='Win rate TP1 = trade yang mencapai TP1 dibagi trade yang entry-nya terisi. Trade yang kedaluwarsa ('+(s.expired||0)+') tidak dihitung. Total R mengandaikan setengah posisi ditutup di TP1 dan sisanya lanjut ke TP3 atau BE; kalau semua posisi dipertahankan sampai akhir, totalnya '+(s.n?rr(s.netR):'-')+'.';
$('upd').textContent=D.updated?'Pembaruan terakhir '+hm(D.updated)+' UTC. Halaman menyegarkan diri tiap 30 detik.':'Belum ada pemindaian. Panggil /api/scan dulu.';
$('act').innerHTML=D.setups&&D.setups.length?D.setups.map(card).join(''):'<p class="empty">Tidak ada setup aktif. Mesin menunggu sinyal baru.</p>';
$('bp').innerHTML=tbl(D.byPair||[]);$('bt').innerHTML=tbl(D.byType||[]);
$('hist').innerHTML=D.hist&&D.hist.length?D.hist.slice(0,50).map(s=>{const r=s.st==='SL_HIT'?'-1R':s.st==='BE_STOP'?'0R':s.st==='TP3_HIT'?'+'+s.r3.toFixed(1)+'R':'tidak terisi',c=s.st==='TP3_HIT'?'up':s.st==='SL_HIT'?'dn':'';
return '<div class="cr"><div><b>'+(s.d>0?'BUY ':'SELL ')+s.pair+' '+s.tf+'</b><p class="meta" style="margin:0">'+s.type+', '+hm(s.tSig)+' UTC'+(s.be&&s.st!=='TP3_HIT'?', sempat TP1':'')+'</p></div><div style="text-align:right"><b class="'+c+'">'+STL[s.st]+'</b><p class="meta" style="margin:0">'+r+'</p></div></div>'}).join(''):'<p class="empty">Belum ada setup yang selesai.</p>'}
async function load(){try{const r=await fetch(location.pathname+'?view=state&key='+encodeURIComponent(Q));if(!r.ok)throw new Error(r.status===401?'Kunci dashboard salah. Tambahkan ?key=KUNCI di alamat.':'Gagal memuat ('+r.status+')');D=await r.json();render()}catch(e){$('upd').textContent=e.message}}
load();setInterval(load,30000);
</script>
</body>
</html>
`;

module.exports=async(req,res)=>{
  const v=req.query&&req.query.view;
  if(v==='dash'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.status(200).send(DASH)}
  if(v==='state')return stateHandler(req,res);
  return scanHandler(req,res)};
