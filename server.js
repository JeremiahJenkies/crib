import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { URL } from "node:url";

const PORT=process.env.PORT||3000;
const ADMIN_TOKEN=process.env.CRIB_ADMIN_TOKEN||"change-this-admin-token";
const DATA_FILE=path.join(process.cwd(),"data.json");
const RANKS=["Coal","Iron","Copper","Quartz","Amethyst","Jade","Topaz","Opal","Pearl","Sapphire","Emerald","Ruby","Garnet","Onyx","Obsidian","Diamond","Mythic","Astral","Celestial","Radiant"];
const DIVS=["IV","III","II","I"];

const DEFAULT_KITS=[
{name:"None",class:"None",power:0,tier:"NONE",rpMultiplier:1.20,enabled:true,description:"No kit selected; receives the highest Scrim RP modifier."},
{name:"Barbarian",class:"Fighter",power:82,tier:"S",enabled:true,description:"Builds rage through combat and can progress toward the Rageblade."},
{name:"Aery",class:"Fighter",power:80,tier:"S",enabled:true,description:"Collects spirits from defeated enemies that can increase sword damage."},
{name:"Archer",class:"Ranged",power:72,tier:"A",enabled:true,description:"Improves ranged combat and projectile pressure."},
{name:"Grim Reaper",class:"Fighter",power:76,tier:"A",enabled:true,description:"Uses soul/reaper mechanics for temporary combat advantages."},
{name:"Void Knight",class:"Movement",power:78,tier:"A",enabled:true,description:"Void-themed combat and mobility utility."},
{name:"Yuzi",class:"Movement",power:70,tier:"A",enabled:true,description:"Enhanced mobility and aggressive combat utility."},
{name:"Vulcan",class:"Defender",power:68,tier:"A",enabled:true,description:"Remote turret and defensive control utility."},
{name:"Farmer Cletus",class:"Economy",power:58,tier:"B",enabled:true,description:"Economy-focused farming advantage."},
{name:"Miner",class:"Economy",power:55,tier:"B",enabled:true,description:"Mining-focused resource and economy advantage."},
{name:"Melody",class:"Support",power:46,tier:"C",enabled:true,description:"Healing and support utility for teammates."},
{name:"Builder",class:"Defender",power:43,tier:"C",enabled:true,description:"Defensive construction and building utility."}
];

const state={players:[],matches:[],config:{baseWin:30,baseLoss:-24,noKitMultiplier:1.20,minKitMultiplier:.88,maxKitMultiplier:1.16,streakCap:.10,winstreak1v1KitsEnabled:true},kits:DEFAULT_KITS};

function rankData(rp){
 const n=Math.max(0,Math.min(5999,Number(rp)||0)),i=Math.min(19,Math.floor(n/300)),d=Math.min(3,Math.floor((n%300)/75));
 return {name:RANKS[i],division:DIVS[d],label:RANKS[i]+" "+DIVS[d]};
}
function id(prefix){return prefix+"_"+crypto.randomUUID().replaceAll("-","").slice(0,12)}
function hash(v){return crypto.createHash("sha256").update(String(v)).digest("hex")}
function normalizeUsername(v){
 const base=String(v||"player").trim().toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,18)||"player";
 let u=base,i=2;
 while(state.players.some(p=>String(p.username).toLowerCase()===u.toLowerCase()))u=base+i++;
 return u;
}
function generatePassword(username){
 const suffix=crypto.randomBytes(4).toString("hex");
 return username+"-"+suffix;
}
function ensureOpponentProfiles(names,excludeId,startingRP=1000){
 const created=[];
 for(const raw of names||[]){
  const displayName=String(raw||"").trim();if(!displayName)continue;
  if(findPlayer(displayName)||state.players.some(p=>String(p.displayName||"").toLowerCase()===displayName.toLowerCase()))continue;
  const username=normalizeUsername(displayName),password=generatePassword(username);
  const p=normalizePlayer({id:id("p"),username,displayName,passwordHash:hash(password),rp:Math.max(0,startingRP)});
  p.autoCreated=true;p.createdFromMatch=true;p.initialCredentialsIssuedAt=new Date().toISOString();
  state.players.push(p);
  created.push({id:p.id,displayName:p.displayName,username,password,rp:p.rp});
 }
 return created;
}
function kit(name){return state.kits.find(k=>String(k.name).toLowerCase()===String(name||"None").toLowerCase())||state.kits[0]}
function kitMultiplierFor(k){
 if(!k||k.name==="None")return Number(state.config.noKitMultiplier??1.20);
 if(Number.isFinite(Number(k.manualRpMultiplier)))return Number(k.manualRpMultiplier);
 const power=Math.max(0,Math.min(100,Number(k.powerScore??k.power??50)+Number(k.metaAdjustment||0)));
 return Math.max(Number(state.config.minKitMultiplier??.88),Math.min(Number(state.config.maxKitMultiplier??1.16),1.20-(power/100)*.32));
}
function normalizeKit(k){const x={...k,power:Number(k.powerScore??k.power??0)};x.rpMultiplier=kitMultiplierFor(x);return x}
function normalizePlayer(x){
 return {id:x.id,username:x.username,displayName:x.displayName||x.username,rp:Number(x.rp??1000),peakRP:Number(x.peakRP??x.rp??1000),wins:Number(x.wins??0),losses:Number(x.losses??0),kills:Number(x.kills??0),deaths:Number(x.deaths??0),beds:Number(x.beds??0),winstreak:Number(x.winstreak??0),bestStreak:Number(x.bestStreak??0),bedStreak:Number(x.bedStreak??0),bestBedStreak:Number(x.bestBedStreak??0),cribRating:Number(x.cribRating??1000),performanceRating:Number(x.performanceRating??1000),recentForm:Number(x.recentForm??0),mmr:Number(x.mmr??1000),lateElo:Number(x.lateElo??1000),matches:x.matches??[],lateGames:x.lateGames??[],history:x.history??[],passwordHash:x.passwordHash};
}
function publicPlayer(p){const q={...p};delete q.passwordHash;return q}
function findPlayer(v){return state.players.find(p=>p.id===v||String(p.username).toLowerCase()===String(v||"").toLowerCase())}
function calculateRP(body,p){
 const mode=body.mode||"STANDARD_SCRIM",k=kit(body.kit),forScore=Number(body.scoreFor||0),against=Number(body.scoreAgainst||0),win=forScore>against,diff=Math.abs(forScore-against);
 const opponent=Number(body.opponentRP||p.rp||1000),expected=1/(1+Math.pow(10,(p.rp-opponent)/400));
 const expectedSwing=Math.round(((win?1:0)-expected)*24);
 const combat=Math.max(-5,Math.min(8,Math.round((Number(body.kills||0)-Number(body.deaths||0))*.75)));
 const objective=mode==="NO_BED_SCRIM"?0:Math.min(5,Number(body.bedsDestroyed||0));
 const scorePerf=Math.max(-8,Math.min(10,Math.round(diff*1.25)));
 const streak=Math.min(Number(p.winstreak||0),15);
 const streakBonus=win?Math.round(streak*.5):0;
 const base=win?Number(state.config.baseWin??30):Number(state.config.baseLoss??-24);
 const raw=base+expectedSwing+combat+objective+scorePerf+streakBonus;
 const modifier=mode==="WINSTREAK_1V1"&&!state.config.winstreak1v1KitsEnabled?1:kitMultiplierFor(k);
 const final=Math.max(-100,Math.min(100,Math.round(raw*modifier)));
 return {final,base,expectedSwing,combatPerformance:combat,objectivePerformance:objective,scoreDifferential:scorePerf,streakBonus,kitModifier:modifier,kit:k?.name||"None",kitPowerAtMatch:Number(k?.powerScore??k?.power??0),kitMultiplierAtMatch:modifier,win,expectedWinChance:Math.round(expected*100)};
}
async function saveState(){const tmp=DATA_FILE+".tmp";await fs.writeFile(tmp,JSON.stringify(state,null,2));await fs.rename(tmp,DATA_FILE)}
async function loadState(){
 try{const saved=JSON.parse(await fs.readFile(DATA_FILE,"utf8"));Object.assign(state,saved);state.config={...state.config,...(saved.config||{})};state.players=(state.players||[]).map(normalizePlayer);state.kits=(state.kits?.length?state.kits:DEFAULT_KITS).map(normalizeKit)}catch{state.kits=DEFAULT_KITS.map(normalizeKit);await saveState()}
}
function json(res,status,data){res.writeHead(status,{"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,OPTIONS","access-control-allow-headers":"content-type,x-admin-token"});res.end(JSON.stringify(data))}
async function body(req){return await new Promise((resolve,reject)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on("error",reject)})}

await loadState();
const server=http.createServer(async(req,res)=>{
 if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,OPTIONS","access-control-allow-headers":"content-type,x-admin-token"});return res.end()}
 const u=new URL(req.url,"http://localhost");
 try{
  if(u.pathname==="/api/health")return json(res,200,{ok:true,service:"CRIB",players:state.players.length,matches:state.matches.length});
  if(u.pathname==="/api/players"&&req.method==="GET")return json(res,200,{players:state.players.map(publicPlayer)});
  if(u.pathname==="/api/kits"&&req.method==="GET")return json(res,200,{kits:state.kits,config:state.config});
  if(u.pathname==="/api/config"&&req.method==="GET")return json(res,200,{config:state.config,ranks:RANKS,divisions:DIVS});
  if(u.pathname==="/api/export"&&req.method==="GET")return json(res,200,{exportedAt:new Date().toISOString(),players:state.players.map(publicPlayer),matches:state.matches,kits:state.kits,config:state.config});
  if(u.pathname==="/api/players"&&req.method==="POST"){
   const b=await body(req),username=String(b.username||"").trim();
   if(username.length<2)return json(res,400,{error:"Username must contain at least 2 characters."});
   if(state.players.some(p=>p.username.toLowerCase()===username.toLowerCase()))return json(res,409,{error:"That player already exists."});
   const p=normalizePlayer({id:id("p"),username,displayName:String(b.displayName||username).trim(),passwordHash:hash(b.password||"")});
   state.players.push(p);await saveState();return json(res,201,{player:publicPlayer(p)});
  }
  if(u.pathname.match(/^\/api\/players\/[^/]+\/login$/)&&req.method==="POST"){
   const pid=decodeURIComponent(u.pathname.split("/")[3]),p=findPlayer(pid),b=await body(req);
   if(!p||p.passwordHash!==hash(b.password||""))return json(res,401,{error:"Invalid player or password."});
   return json(res,200,{player:publicPlayer(p)});
  }
  if(u.pathname==="/api/matches/scrim"&&req.method==="POST"){
   const b=await body(req),p=findPlayer(b.playerId||b.player||"");if(!p)return json(res,404,{error:"Player not found."});
   const mode=b.mode||"STANDARD_SCRIM";
   if(!["STANDARD_SCRIM","NO_BED_SCRIM","WINSTREAK_1V1"].includes(mode))return json(res,400,{error:"Invalid Scrim mode."});
   if(mode==="WINSTREAK_1V1"){if(!b.opponentId)return json(res,400,{error:"Winstreak 1v1 requires a registered opponent."});if(!findPlayer(b.opponentId)||b.opponentId===p.id)return json(res,400,{error:"Choose another registered player."});if(!state.config.winstreak1v1KitsEnabled)b.kit="None"}
   if(mode==="NO_BED_SCRIM")b.bedsDestroyed=0;
   const calc=calculateRP(b,p);
   const opponentNames=Array.isArray(b.opponents)?b.opponents:(b.opponents?[String(b.opponents)]:[]);
   const autoCreatedPlayers=!calc.win?ensureOpponentProfiles(opponentNames,p.id,Math.max(0,1000+Math.abs(calc.final))):[];
   const op=findPlayer(b.opponentId||"");
   if(!calc.win&&autoCreatedPlayers.length){
    for(const created of autoCreatedPlayers){
     const cp=findPlayer(created.id);
     if(cp){
      cp.wins+=1;
      cp.winstreak+=1;
      cp.bestStreak=Math.max(cp.bestStreak,cp.winstreak);
      cp.cribRating=Math.max(0,Math.round(cp.cribRating+Math.abs(calc.final)*.65));
      cp.performanceRating=Math.max(0,Math.round(cp.performanceRating+Math.abs(calc.final)*.6));
      cp.history.push({date:new Date().toISOString(),rp:cp.rp,change:Math.abs(calc.final),event:"AUTO OPPONENT WIN"});
     }
    }
   }
   const resolvedOpponents=opponentNames.map(name=>findPlayer(name)?.displayName||name);
   const match={id:id("scrim"),type:"SCRIM",mode,playerId:p.id,opponentId:op?.id||null,opponent:op?.displayName||null,opponents:resolvedOpponents,kit:calc.kit,map:String(b.map||""),role:String(b.role||"Flex"),scoreFor:Number(b.scoreFor||0),scoreAgainst:Number(b.scoreAgainst||0),kills:Number(b.kills||0),deaths:Number(b.deaths||0),bedsDestroyed:mode==="NO_BED_SCRIM"?0:Number(b.bedsDestroyed||0),placement:Number(b.placement||0),duration:Number(b.duration||0),result:calc.win?"Win":"Loss",rp:calc.final,lossRP:calc.win?0:Math.abs(calc.final),performanceScore:calc.combatPerformance+calc.objectivePerformance+calc.scoreDifferential,kitPowerAtMatch:calc.kitPowerAtMatch,kitMultiplierAtMatch:calc.kitMultiplierAtMatch,verified:Boolean(b.verified),notes:String(b.notes||""),autoCreatedOpponentProfiles:autoCreatedPlayers.map(x=>x.id),createdAt:new Date().toISOString()};
   const oldStreak=p.winstreak;p.rp=Math.max(0,p.rp+calc.final);p.peakRP=Math.max(p.peakRP,p.rp);p.wins+=calc.win?1:0;p.losses+=calc.win?0:1;p.kills+=match.kills;p.deaths+=match.deaths;p.beds+=match.bedsDestroyed;p.winstreak=calc.win?p.winstreak+1:0;p.bestStreak=Math.max(p.bestStreak,p.winstreak);p.bedStreak=match.bedsDestroyed>0?p.bedStreak+match.bedsDestroyed:0;p.bestBedStreak=Math.max(p.bestBedStreak,p.bedStreak);p.cribRating=Math.max(0,Math.round(p.cribRating+calc.final*.65));p.performanceRating=Math.max(0,Math.round((p.performanceRating*.85)+((1000+calc.final*4)*.15)));p.recentForm=Math.round(p.recentForm*.7+(calc.final>0?100:0)*.3);p.mmr=Math.max(0,Math.round(p.mmr+calc.expectedSwing));p.matches.push(match.id);p.history.push({date:match.createdAt,rp:p.rp,change:calc.final,event:mode,fromStreak:oldStreak});
   state.matches.push(match);
   if(op){op.winstreak=calc.win?0:op.winstreak+1;op.bestStreak=Math.max(op.bestStreak,op.winstreak);op.matches.push(match.id);op.history.push({date:match.createdAt,rp:op.rp,change:0,event:"OPPONENT"})}
   await saveState();return json(res,201,{match,player:publicPlayer(p),breakdown:calc,rank:rankData(p.rp),autoCreatedPlayers});
  }
  if(u.pathname==="/api/matches/lg"&&req.method==="POST"){
   const b=await body(req),p=findPlayer(b.playerId||b.player||"");if(!p)return json(res,404,{error:"Player not found."});
   const a=Number(b.scoreFor),z=Number(b.scoreAgainst);if(!Number.isFinite(a)||!Number.isFinite(z)||a===z)return json(res,400,{error:"LG requires two different scores."});
   const diff=a-z,win=diff>0,rp=Math.max(-60,Math.min(60,Math.round((win?24:-22)+diff*2)));
   const match={id:id("lg"),type:"LG",playerId:p.id,opponent:String(b.opponent||"Unknown"),map:"Reservoir",matchType:"Custom Match",scoreFor:a,scoreAgainst:z,result:win?"Win":"Loss",rp,createdAt:new Date().toISOString()};
   p.rp=Math.max(0,p.rp+rp);p.peakRP=Math.max(p.peakRP,p.rp);p.lateElo=Math.max(0,p.lateElo+Math.round(diff*12));p.lateGames.push(match.id);p.history.push({date:match.createdAt,rp:p.rp,change:rp,event:"LATE GAME"});state.matches.push(match);await saveState();return json(res,201,{match,player:publicPlayer(p),breakdown:{base:win?24:-22,scoreDifferential:diff*2,final:rp}});
  }
  if(u.pathname==="/api/matches"&&req.method==="GET"){const pid=u.searchParams.get("playerId");return json(res,200,{matches:state.matches.filter(m=>!pid||m.playerId===pid).slice().reverse()})}
  if(u.pathname==="/api/admin/config"&&req.method==="PUT"){
   if(req.headers["x-admin-token"]!==ADMIN_TOKEN)return json(res,403,{error:"Admin token required."});
   Object.assign(state.config,await body(req));await saveState();return json(res,200,{config:state.config});
  }
  if(u.pathname==="/api/admin/kits"&&req.method==="PUT"){
   if(req.headers["x-admin-token"]!==ADMIN_TOKEN)return json(res,403,{error:"Admin token required."});
   const b=await body(req),k=kit(b.name);if(!k)return json(res,404,{error:"Kit not found."});Object.assign(k,b);k.power=Number(k.powerScore??k.power??0);k.rpMultiplier=kitMultiplierFor(k);await saveState();return json(res,200,{kit:k});
  }
  if(req.method==="GET"&&!u.pathname.startsWith("/api/")){
   const requested=decodeURIComponent(u.pathname==="/"?"index.html":u.pathname.slice(1)),safe=path.normalize(requested).replace(/^([.][.][\\/])+/, ""),file=path.join(process.cwd(),safe);
   const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml"};
   try{const data=await fs.readFile(file);res.writeHead(200,{"content-type":types[path.extname(file).toLowerCase()]||"application/octet-stream","cache-control":"no-cache"});return res.end(data)}catch{}
  }
  return json(res,404,{error:"API route not found",path:u.pathname});
 }catch(e){console.error(e);return json(res,500,{error:"Server error",detail:e.message})}
});
server.listen(PORT,()=>console.log("CRIB server running on port "+PORT));
