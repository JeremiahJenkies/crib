const API="/api";let players=[],kits=[],active=null,matches=[];
const $=id=>document.getElementById(id);const text=(id,v)=>{const e=$(id);if(e)e.textContent=v??"—"};const show=(id,on=true)=>$(id)?.classList.toggle("open",on);
async function api(path,opt={}){const r=await fetch(API+path,{headers:{"content-type":"application/json",...(opt.headers||{})},...opt});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||"Request failed ("+r.status+")");return d}
function saveLocal(){if(active)localStorage.setItem("cribActivePlayer",active.id)}
function rank(r){return r>=3000?"Radiant":r>=2600?"Diamond":r>=2200?"Emerald":r>=1800?"Ruby":r>=1400?"Sapphire":r>=1000?"Gold":r>=700?"Silver":r>=400?"Bronze":"Unranked"}
function renderPlayers(){const s=$("activePlayerSelect");if(s){s.innerHTML=players.map(p=>`<option value="${p.id}">${p.displayName} · ${p.rp} RP</option>`).join("");if(active)s.value=active.id}const t=$("playersTableBody");if(t)t.innerHTML=players.map(p=>`<tr><td><b>${p.displayName}</b><br><span class="muted">@${p.username}</span></td><td>${rank(p.rp)}</td><td>${p.rp}</td><td>${p.wins}-${p.losses}</td><td>${p.winstreak}</td><td><button class="soft-btn" onclick="window.selectPlayer('${p.id}')">Open</button></td></tr>`).join("")}
function render(){if(!active)return;const p=active;const wr=p.wins+p.losses?(p.wins/(p.wins+p.losses)*100).toFixed(1):"0.0",kd=p.deaths?p.kills/p.deaths:p.kills;const r=rank(p.rp);["sideName","profileDisplayName"].forEach(x=>text(x,p.displayName));text("sideRank",r);text("profileUsername","@"+p.username);text("currentRankName",r);text("currentRankRP",p.rp);text("dashboardWins",p.wins);text("dashboardWinRate",wr+"%");text("dashboardKD",Number(kd).toFixed(2));text("profileRP",p.rp);text("profilePeakRP",p.peakRP);text("profileWins",p.wins);text("profileWinsLosses",p.wins+" / "+p.losses);text("profileWinRate",wr+"%");text("profileGames",p.wins+p.losses);text("profileMMR",p.mmr);text("profileLateELO",p.lateElo);text("profileCribRating",p.cribRating);text("profileBedStreak",p.winstreak);text("profileBestBedStreak",p.bestStreak);text("profileKills",p.kills);text("profileDeaths",p.deaths);text("profileKD",Number(kd).toFixed(2));text("profileBeds",p.beds);text("profileWinstreak",p.winstreak);text("profileBestStreak",p.bestStreak);text("rankTitle",r);text("rankSub",p.rp+" RP");text("currentRPValue",p.rp);text("quickWinstreak",p.winstreak);text("quickPeakRP",p.peakRP);renderPlayers()}
function openPage(name){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(name+"-page")?.classList.add("active");document.querySelectorAll(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.page===name))}
async function refresh(){const [a,b]=await Promise.all([api("/players"),api("/kits")]);players=a.players;kits=b.kits;active=players.find(p=>p.id===localStorage.getItem("cribActivePlayer"))||players[0]||null;render();populateKits()}
function populateKits(){["scrimKitSelect","winstreakOpponentKitSelect","mapModifierKit","compareKitA","compareKitB"].forEach(id=>{const e=$(id);if(e)e.innerHTML=kits.map(k=>`<option value="${k.name}">${k.name}</option>`).join("")})}
window.selectPlayer=async id=>{active=players.find(p=>p.id===id);saveLocal();render();openPage("dashboard")}
async function createPlayer(){const username=$("newPlayerUsername").value.trim(),displayName=$("newPlayerDisplayName").value.trim()||username,password=$("newPlayerPassword").value||"";$("createPlayerError").textContent="";try{const d=await api("/players",{method:"POST",body:JSON.stringify({username,displayName,password})});active=d.player;saveLocal();show("createPlayerModal",false);await refresh();openPage("dashboard")}catch(e){$("createPlayerError").textContent=e.message}}
async function saveScrim(){if(!active)return alert("Create/select a player first.");const b={playerId:active.id,mode:$("scrimModeSelect").value,kit:$("scrimKitSelect").value,map:$("scrimMap").value,scoreFor:$("scrimScoreFor").value,scoreAgainst:$("scrimScoreAgainst").value,opponents:$("scrimOpponents").value,kills:$("scrimKills").value,deaths:$("scrimDeaths").value,bedsDestroyed:$("scrimBedsDestroyed").value,opponentRP:$("scrimOpponentRP").value};try{const d=await api("/matches/scrim",{method:"POST",body:JSON.stringify(b)});show("scrimModal",false);await refresh();openResult(d)}catch(e){alert(e.message)}}
async function saveLG(){if(!active)return alert("Create/select a player first.");try{const d=await api("/matches/lg",{method:"POST",body:JSON.stringify({playerId:active.id,opponent:$("lateOpponent").value,scoreFor:$("latePlayerScore").value,scoreAgainst:$("lateOpponentScore").value})});show("lateGameModal",false);await refresh();openResult(d)}catch(e){alert(e.message)}}
function openResult(d){show("rpResultModal");text("rpResultValue",(d.breakdown.final>=0?"+":"")+d.breakdown.final);text("rpResultTitle",d.match?.type==="LG"?"Late Game Rating":"Scrim Rating");$("rpBreakdownRows").innerHTML=Object.entries(d.breakdown).map(([k,v])=>`<div class="match-row"><span>${k}</span><b>${v}</b></div>`).join("")}
document.addEventListener("click",e=>{const page=e.target.closest(".nav-button")?.dataset.page;if(page)openPage(page);const modal=e.target.closest("[data-close-modal]")?.dataset.closeModal;if(modal)show(modal,false)});
$("newPlayerBtn")?.addEventListener("click",()=>show("createPlayerModal"));$("quickAddBtn")?.addEventListener("click",()=>show("scrimModal"));$("dashboardAddMatchBtn")?.addEventListener("click",()=>show("scrimModal"));$("addScrimBtn")?.addEventListener("click",()=>show("scrimModal"));$("openLateGameBtn")?.addEventListener("click",()=>show("lateGameModal"));$("quickAddLGBtn")?.addEventListener("click",()=>show("lateGameModal"));$("playersCreateBtn")?.addEventListener("click",()=>show("createPlayerModal"));$("createPlayerSubmit")?.addEventListener("click",createPlayer);$("saveScrimBtn")?.addEventListener("click",saveScrim);$("saveLateGameBtn")?.addEventListener("click",saveLG);$("activePlayerSelect")?.addEventListener("change",e=>window.selectPlayer(e.target.value));
refresh().catch(e=>{text("serverStatus","OFFLINE");console.error(e)});


/* CRIB v2 QoL layer */
const CRIB_RANKS=["Coal","Iron","Copper","Quartz","Amethyst","Jade","Topaz","Opal","Pearl","Sapphire","Emerald","Ruby","Garnet","Onyx","Obsidian","Diamond","Mythic","Astral","Celestial","Radiant"];
function cribRank(rp){const n=Math.max(0,Math.min(6000,Number(rp)||0)),i=Math.min(19,Math.floor(n/300)),d=Math.min(3,Math.floor((n%300)/75));return {name:CRIB_RANKS[i],division:["IV","III","II","I"][d],label:CRIB_RANKS[i]+" "+["IV","III","II","I"][d],floor:i*300+d*75,next:i*300+(d+1)*75,progress:Math.round(((n%75)/75)*100)}}
rank=cribRank;
function renderQoL(){
  if(!active)return;
  const ms=currentMatches();
  const rankData=cribRank(active.rp);
  text("currentRankName",rankData.label);text("currentRankRP",active.rp+" RP");text("rankTitle",rankData.label);text("rankBanner",rankData.name.toUpperCase());text("rankChip",rankData.label);
  text("divisionName",rankData.label);text("divisionProgressText",rankData.next>=6000?"MAX RANK":rankData.next+" RP target");text("divisionIcon",rankData.name[0]);
  $("rankProgressBar")?.style.setProperty("width",rankData.progress+"%");
  $("divisionProgressBar")?.style.setProperty("width",rankData.progress+"%");
  text("progressLow",rankData.floor+" RP");text("progressTarget",rankData.next>=6000?"MAX RANK":rankData.next+" RP");text("rankFootnote",rankData.next>=6000?"MAX RANK":"Need "+Math.max(0,rankData.next-active.rp)+" RP to promote.");
  const recent=ms.slice(0,5),wins=ms.filter(x=>x.result==="Win").length;
  text("quickWinstreak",active.winstreak);text("quickPeakRP",active.peakRP);
  text("quickAvgKills",ms.length?(ms.reduce((a,x)=>a+(Number(x.kills)||0),0)/ms.length).toFixed(1):"0.0");
  text("quickAvgBeds",ms.length?(ms.reduce((a,x)=>a+(Number(x.bedsDestroyed)||0),0)/ms.length).toFixed(1):"0.0");
  const recentBox=$("recentMatchesList");if(recentBox)recentBox.innerHTML=recent.map(m=>`<div class="match-row"><span><b>${m.type==="LG"?"⚡ LG":"▣ SCRIM"}</b> · ${esc(m.result)}<small class="muted"> · ${fmtDate(m.createdAt)}</small></span><b>${m.rp>=0?"+":""}${m.rp} RP</b></div>`).join("")||'<div class="match-row muted">No matches recorded yet.</div>';
}
function renderLeaderboardQoL(){
 const e=$("leaderboardTable"),p=$("leaderboardPreview");if(!e&&!p)return;
 const arr=[...players].sort((a,b)=>b.cribRating-a.cribRating);
 const html=arr.map((x,i)=>`<div class="leaderboard-row"><span><b>#${i+1}</b> · ${esc(x.displayName)} <small class="muted">· ${cribRank(x.rp).label}</small></span><strong>${x.cribRating}</strong></div>`).join("")||'<div class="match-row muted">No players yet.</div>';
 if(e)e.innerHTML=html;if(p)p.innerHTML=html.slice(0,5000);
}
function renderKitQoL(){
 const e=$("kitsTableBody");if(!e)return;
 let a=[...kits],q=($("kitSearch")?.value||"").toLowerCase(),cls=$("kitClassFilter")?.value||"all",tier=$("kitTierFilter")?.value||"all",status=$("kitStatusFilter")?.value||"all";
 a=a.filter(k=>(!q||JSON.stringify(k).toLowerCase().includes(q))&&(cls==="all"||k.class===cls)&&(tier==="all"||k.tier===tier)&&(status==="all"||(status==="enabled"?k.enabled:!k.enabled)));
 const sort=$("kitSort")?.value||"alphabetical";
 a.sort((x,y)=>sort==="strongest"?y.power-x.power:sort==="weakest"?x.power-y.power:sort==="highest-rp"?y.rpMultiplier-x.rpMultiplier:sort==="lowest-rp"?x.rpMultiplier-y.rpMultiplier:x.name.localeCompare(y.name));
 e.innerHTML=a.map(k=>`<tr><td><b>${esc(k.name)}</b></td><td>${esc(k.class)}</td><td>${k.power}</td><td>${k.tier}</td><td>×${Number(k.rpMultiplier).toFixed(3)}</td><td>${esc(k.description||"—")}</td><td>${k.enabled?"Enabled":"Disabled"}</td></tr>`).join("")||'<tr><td colspan="7" class="muted">No kits match those filters.</td></tr>';
 const cs=$("kitClassFilter");if(cs){const old=cls;cs.innerHTML='<option value="all">All classes</option>'+[...new Set(kits.map(k=>k.class))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");cs.value=old}
}
function renderStatsQoL(){
 if(!active)return;const ms=currentMatches(),g=ms.length,wr=active.wins+active.losses?active.wins/(active.wins+active.losses)*100:0,kd=active.deaths?active.kills/active.deaths:active.kills;
 text("statWinRate",wr.toFixed(1)+"%");text("statKD",Number(kd).toFixed(2));text("statAvgKills",g?(active.kills/g).toFixed(2):"0.00");text("statAvgBeds",g?(active.beds/g).toFixed(2):"0.00");text("statGames",g);text("statMMR",active.mmr);text("statLateELO",active.lateElo);text("statPerformance",active.cribRating);text("statFormRating",active.winstreak);
 const kitBox=$("kitStatsList");if(kitBox){const rows={};ms.filter(m=>m.type==="SCRIM").forEach(m=>{rows[m.kit]??={g:0,w:0,rp:0};rows[m.kit].g++;rows[m.kit].w+=m.result==="Win"?1:0;rows[m.kit].rp+=m.rp});kitBox.innerHTML=Object.entries(rows).map(([k,v])=>`<div class="match-row"><span>${esc(k)}<small class="muted"> · ${v.g} games · ${(v.w/v.g*100).toFixed(0)}% WR</small></span><b>${v.rp>=0?"+":""}${v.rp} RP</b></div>`).join("")||'<div class="muted">No kit data yet.</div>'}
 const oppBox=$("opponentStatsList");if(oppBox){const rows={};ms.forEach(m=>{const o=m.opponent||((m.opponents||[]).join(", "));if(!o)return;rows[o]??={g:0,w:0};rows[o].g++;rows[o].w+=m.result==="Win"?1:0});oppBox.innerHTML=Object.entries(rows).map(([o,v])=>`<div class="match-row"><span>${esc(o)}</span><b>${v.w}/${v.g} wins</b></div>`).join("")||'<div class="muted">No opponent data yet.</div>'}
}
const __oldRender=render;
render=function(){__oldRender();renderQoL();renderLeaderboardQoL();renderKitQoL();renderStatsQoL();};
const __oldRefresh=refresh;
refresh=async function(){await __oldRefresh();renderQoL();renderLeaderboardQoL();renderKitQoL();renderStatsQoL();};
function exportCribBackup(){const data={exportedAt:new Date().toISOString(),players,matches,kits,config};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="crib-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Backup downloaded");}
function addQoLControls(){
 const bar=document.querySelector(".topbar-actions");if(!bar)return;
 if(!$("cribBackupBtn")){const b=document.createElement("button");b.id="cribBackupBtn";b.className="soft-btn";b.textContent="↧ Backup";b.onclick=exportCribBackup;bar.append(b)}
 if(!$("cribSearchBtn")){const b=document.createElement("button");b.id="cribSearchBtn";b.className="soft-btn";b.textContent="⌕ Search";b.onclick=()=>{$("scrimSearch")?.focus();openPage("scrims")};bar.append(b)}
 if(!$("cribToast")){const t=document.createElement("div");t.id="cribToast";document.body.append(t)}
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-backdrop.open").forEach(x=>x.classList.remove("open"));if(e.ctrlKey&&e.key.toLowerCase()==="k"){e.preventDefault();$("scrimSearch")?.focus();openPage("scrims")}if(e.ctrlKey&&e.key.toLowerCase()==="n"){e.preventDefault();show("scrimModal")}if(e.ctrlKey&&e.key.toLowerCase()==="b"){e.preventDefault();exportCribBackup()}});
document.querySelectorAll("[data-chart-range]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-chart-range]").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderChart()}));
["scrimSearch","scrimFilterMode","scrimFilterKit","scrimFilterResult","kitSearch","kitClassFilter","kitTierFilter","kitStatusFilter","kitMinPower","kitMaxPower","kitMinRP","kitMaxRP","kitSort","leaderboardFilter"].forEach(id=>$(id)?.addEventListener("input",()=>{render();renderKitQoL();renderLeaderboardQoL()}));
addQoLControls();
renderQoL();
