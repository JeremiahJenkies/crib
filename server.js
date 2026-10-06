import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { URL } from "node:url";

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.CRIB_ADMIN_TOKEN || "change-this-admin-token";
const DATA_FILE = path.join(process.cwd(),"data.json");

const state = {
  players: [],
  matches: [],
  kits: [
    {name:"None",class:"None",power:0,tier:"NONE",rpMultiplier:1.20,enabled:true,description:"No kit selected. Highest Scrim RP modifier."},
    {name:"Barbarian",class:"Fighter",power:82,tier:"S",rpMultiplier:.94,enabled:true,description:"Builds rage through combat and can progress toward the Rageblade."},
    {name:"Aery",class:"Fighter",power:80,tier:"S",rpMultiplier:.944,enabled:true,description:"Collects spirits from defeated enemies that can increase sword damage."},
    {name:"Archer",class:"Ranged",power:72,tier:"A",rpMultiplier:.97,enabled:true,description:"Improves ranged combat and projectile pressure."},
    {name:"Farmer Cletus",class:"Economy",power:58,tier:"B",rpMultiplier:1.014,enabled:true,description:"Provides an economy-focused farming advantage."},
    {name:"Miner",class:"Economy",power:55,tier:"B",rpMultiplier:1.024,enabled:true,description:"Improves resource generation through mining mechanics."},
    {name:"Melody",class:"Support",power:46,tier:"C",rpMultiplier:1.053,enabled:true,description:"Provides healing and support utility."},
    {name:"Builder",class:"Defender",power:43,tier:"C",rpMultiplier:1.062,enabled:true,description:"Specializes in defensive construction and building utility."},
    {name:"Grim Reaper",class:"Fighter",power:76,tier:"A",rpMultiplier:.957,enabled:true,description:"Uses reaper/soul mechanics to gain temporary combat advantages."},
    {name:"Void Knight",class:"Movement",power:78,tier:"A",rpMultiplier:.950,enabled:true,description:"Uses void-themed combat and mobility mechanics."},
    {name:"Yuzi",class:"Movement",power:70,tier:"A",rpMultiplier:.976,enabled:true,description:"Provides enhanced mobility and aggressive combat utility."},
    {name:"Vulcan",class:"Defender",power:68,tier:"A",rpMultiplier:.982,enabled:true,description:"Provides remote turret and defensive control utility."}
  ],
  config:{baseWin:30,baseLoss:-24,noKitMultiplier:1.20,minKitMultiplier:.88,maxKitMultiplier:1.16,streakCap:.10}
};

async function loadState(){
  try{
    const raw=await fs.readFile(DATA_FILE,"utf8");
    const saved=JSON.parse(raw);
    Object.assign(state,saved);
    state.config={...state.config,...(saved.config||{})};
    if(!state.kits?.length) state.kits=DEFAULT_KITS;
  }catch(e){ await saveState(); }
}
async function saveState(){
  const tmp=DATA_FILE+".tmp";
  await fs.writeFile(tmp,JSON.stringify(state,null,2));
  await fs.rename(tmp,DATA_FILE);
}
function json(res,status,data){
  const body=JSON.stringify(data);
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type,x-admin-token"});
  res.end(body);
}
function id(prefix){return prefix+"_"+crypto.randomUUID().replaceAll("-","").slice(0,12)}
function hash(p){return crypto.createHash("sha256").update(p).digest("hex")}
function rank(rp){if(rp>=3000)return"Radiant";if(rp>=2600)return"Diamond";if(rp>=2200)return"Emerald";if(rp>=1800)return"Ruby";if(rp>=1400)return"Sapphire";if(rp>=1000)return"Gold";if(rp>=700)return"Silver";if(rp>=400)return"Bronze";return"Unranked"}
function kit(name){
  return state.kits.find(k=>k.name.toLowerCase()===String(name||"none").toLowerCase()) || state.kits[0];
}
function calculateRP(body,p){
  const k=kit(body.kit);
  const win=Number(body.scoreFor||0)>Number(body.scoreAgainst||0);
  const diff=Math.abs(Number(body.scoreFor||0)-Number(body.scoreAgainst||0));
  const perf=Math.max(-8,Math.min(8,Math.round(diff*1.5)));
  const opponent=Number(body.opponentRP||p.rp||1000);
  const expected=1/(1+Math.pow(10,(p.rp-opponent)/400));
  const outcome=win?1:0;
  const expectedSwing=Math.round((outcome-expected)*24);
  const streak=Math.min(Number(p.winstreak||0),10);
  const streakBonus=win?Math.round(streak*.5):0;
  const modifier=body.kit==="None"||!body.kit?state.config.noKitMultiplier:k.rpMultiplier;
  const base=win?state.config.baseWin:state.config.baseLoss;
  const raw=base+expectedSwing+perf+streakBonus;
  const final=Math.round(raw*modifier);
  return {final,base,expectedSwing,perf,streakBonus,kitModifier:modifier,kit:k.name,win,expectedWinChance:Math.round(expected*100)};
}
function normalizePlayer(x){
 return {id:x.id,username:x.username,displayName:x.displayName||x.username,rp:x.rp??1000,peakRP:x.peakRP??x.rp??1000,wins:x.wins??0,losses:x.losses??0,kills:x.kills??0,deaths:x.deaths??0,beds:x.beds??0,winstreak:x.winstreak??0,bestStreak:x.bestStreak??0,cribRating:x.cribRating??1000,mmr:x.mmr??1000,lateElo:x.lateElo??1000,matches:x.matches??[],lateGames:x.lateGames??[],history:x.history??[],passwordHash:x.passwordHash};
}
function publicPlayer(p){const q={...p};delete q.passwordHash;return q}
function findPlayer(idOrName){return state.players.find(p=>p.id===idOrName||p.username.toLowerCase()===String(idOrName).toLowerCase())}

async function body(req){
 return await new Promise((resolve,reject)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}});req.on("error",reject)})
}
await loadState();

const server=http.createServer(async(req,res)=>{
 if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type,x-admin-token"});return res.end()}
 const u=new URL(req.url,"http://localhost");
 try{
  if(u.pathname==="/api/health") return json(res,200,{ok:true,service:"CRIB",players:state.players.length,matches:state.matches.length});
  if(u.pathname==="/api/players"&&req.method==="GET") return json(res,200,{players:state.players.map(publicPlayer)});
  if(u.pathname==="/api/kits"&&req.method==="GET") return json(res,200,{kits:state.kits,config:state.config});
  if(u.pathname==="/api/config"&&req.method==="GET") return json(res,200,{config:state.config});
  if(u.pathname==="/api/players"&&req.method==="POST"){
    const b=await body(req); const username=String(b.username||"").trim();
    if(username.length<2)return json(res,400,{error:"Username must contain at least 2 characters."});
    if(state.players.some(p=>p.username.toLowerCase()===username.toLowerCase()))return json(res,409,{error:"That player already exists."});
    const p=normalizePlayer({id:id("p"),username,displayName:String(b.displayName||username).trim(),passwordHash:hash(String(b.password||""))});
    state.players.push(p); await saveState(); return json(res,201,{player:publicPlayer(p)});
  }
  if(u.pathname.match(/^\/api\/players\/[^/]+\/login$/)&&req.method==="POST"){
    const pid=decodeURIComponent(u.pathname.split("/")[3]); const p=findPlayer(pid); const b=await body(req);
    if(!p||p.passwordHash!==hash(String(b.password||"")))return json(res,401,{error:"Invalid player or password."});
    return json(res,200,{player:publicPlayer(p)});
  }
  if(u.pathname==="/api/matches/scrim"&&req.method==="POST"){
    const b=await body(req); const p=findPlayer(b.playerId||b.player||"");
    if(!p)return json(res,404,{error:"Player not found."});
    const mode=b.mode||"STANDARD_SCRIM";
    if(!["STANDARD_SCRIM","NO_BED_SCRIM","WINSTREAK_1V1"].includes(mode))return json(res,400,{error:"Invalid Scrim mode."});
    if(mode==="WINSTREAK_1V1"&&!findPlayer(b.opponentId||b.opponent||""))return json(res,400,{error:"Winstreak 1v1 requires a registered opponent."});
    const calc=calculateRP(b,p); const match={id:id("scrim"),type:"SCRIM",mode,playerId:p.id,opponentId:b.opponentId||null,opponents:b.opponents||[],kit:calc.kit,map:b.map||"",scoreFor:Number(b.scoreFor||0),scoreAgainst:Number(b.scoreAgainst||0),kills:Number(b.kills||0),deaths:Number(b.deaths||0),bedsDestroyed:mode==="NO_BED_SCRIM"?0:Number(b.bedsDestroyed||0),result:calc.win?"Win":"Loss",rp:calc.final,kitMultiplier:calc.kitModifier,createdAt:new Date().toISOString(),verified:Boolean(b.verified)};
    p.rp=Math.max(0,p.rp+calc.final); p.peakRP=Math.max(p.peakRP,p.rp); p.wins+=calc.win?1:0;p.losses+=calc.win?0:1;p.kills+=match.kills;p.deaths+=match.deaths;p.beds+=match.bedsDestroyed;
    p.winstreak=calc.win?p.winstreak+1:0;p.bestStreak=Math.max(p.bestStreak,p.winstreak);p.cribRating=Math.max(0,Math.round(p.cribRating+calc.final*.65));p.mmr=Math.max(0,Math.round(p.mmr+calc.expectedSwing));p.matches.push(match.id);p.history.push({date:match.createdAt,rp:p.rp,change:calc.final,event:mode});
    state.matches.push(match); await saveState(); return json(res,201,{match,player:publicPlayer(p),breakdown:calc});
  }
  if(u.pathname==="/api/matches/lg"&&req.method==="POST"){
    const b=await body(req); const p=findPlayer(b.playerId||b.player||""); if(!p)return json(res,404,{error:"Player not found."});
    const a=Number(b.scoreFor),z=Number(b.scoreAgainst); if(!Number.isFinite(a)||!Number.isFinite(z)||a===z)return json(res,400,{error:"LG requires two different kill scores."});
    const win=a>z; const diff=a-z; const rp=Math.max(-60,Math.min(60,Math.round((win?24:-22)+diff*2)));
    const match={id:id("lg"),type:"LG",playerId:p.id,opponent:String(b.opponent||"Unknown"),map:"Reservoir",matchType:"Custom Match",scoreFor:a,scoreAgainst:z,result:win?"Win":"Loss",rp,createdAt:new Date().toISOString()};
    p.rp=Math.max(0,p.rp+rp);p.peakRP=Math.max(p.peakRP,p.rp);p.lateElo=Math.max(0,p.lateElo+Math.round(diff*12));p.lateGames.push(match.id);state.matches.push(match);
    return json(res,201,{match,player:publicPlayer(p),breakdown:{base:win?24:-22,differential:diff*2,final:rp}});
  }
  if(u.pathname==="/api/matches"&&req.method==="GET"){
    const pid=u.searchParams.get("playerId");return json(res,200,{matches:state.matches.filter(m=>!pid||m.playerId===pid).slice().reverse()});
  }
  if(u.pathname==="/api/admin/config"&&req.method==="PUT"){
    if(req.headers["x-admin-token"]!==ADMIN_TOKEN)return json(res,403,{error:"Admin token required."});
    Object.assign(state.config,await body(req));await saveState();return json(res,200,{config:state.config});
  }
  if(u.pathname==="/api/admin/kits"&&req.method==="PUT"){
    if(req.headers["x-admin-token"]!==ADMIN_TOKEN)return json(res,403,{error:"Admin token required."});
    const b=await body(req);const k=kit(b.name);if(!k)return json(res,404,{error:"Kit not found."});Object.assign(k,b);if(k.name==="None")k.rpMultiplier=state.config.noKitMultiplier;await saveState();return json(res,200,{kit:k});
  }
  return json(res,404,{error:"API route not found",path:u.pathname});
 }catch(e){console.error(e);return json(res,500,{error:"Server error",detail:e.message})}
});
server.listen(PORT,()=>console.log("CRIB server running on port "+PORT));
