const API="/api";
let players=[],kits=[],matches=[],config={},active=null,adminToken="";
const RANKS=["Coal","Iron","Copper","Quartz","Amethyst","Jade","Topaz","Opal","Pearl","Sapphire","Emerald","Ruby","Garnet","Onyx","Obsidian","Diamond","Mythic","Astral","Celestial","Radiant"];
const DIVS=["IV","III","II","I"];
const $=id=>document.getElementById(id);
const text=(id,v)=>{const e=$(id);if(e)e.textContent=v==null?"—":String(v)};
const show=(id,on=true)=>$(id)?.classList.toggle("open",on);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const prettyKey=k=>String(k).replace(/([A-Z])/g," $1").replace(/_/g," ").replace(/^./,x=>x.toUpperCase());
const prettyValue=v=>v&&typeof v==="object"?Array.isArray(v)?v.join(", "):Object.entries(v).map(([k,x])=>prettyKey(k)+": "+prettyValue(x)).join(" · "):typeof v==="boolean"?(v?"Yes":"No"):String(v);
async function api(path,opt={}){
  const headers={"content-type":"application/json",...(opt.headers||{})};
  const r=await fetch(API+path,{...opt,headers});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw Error(d.error||"Request failed ("+r.status+")");
  return d;
}
function rankData(rp){
  const n=Math.max(0,Math.min(5999,num(rp)));
  const i=Math.min(19,Math.floor(n/300)),d=Math.min(3,Math.floor((n%300)/75));
  const floor=i*300+d*75,next=Math.min(6000,floor+75);
  return {name:RANKS[i],division:DIVS[d],label:RANKS[i]+" "+DIVS[d],floor,next,progress:Math.round(((n-floor)/75)*100),slug:RANKS[i].toLowerCase()};
}
function initials(name){return String(name||"?").trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"--"}
function currentMatches(){return active?matches.filter(m=>m.playerId===active.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)):[]}
function saveActive(){if(active)localStorage.setItem("cribActivePlayer",active.id)}
function fmtDate(d){try{return new Intl.DateTimeFormat(undefined,{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d))}catch{return "—"}}
function modeName(m){return m==="NO_BED_SCRIM"?"NO-BED":m==="WINSTREAK_1V1"?"1V1":m==="LG"?"LATE GAME":"SCRIM"}
function rankImg(rp){return "assets/ranks/"+rankData(rp).slug+".svg"}
function openPage(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  $(page+"-page")?.classList.add("active");
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  text("topTitle",page==="dashboard"?"Overview":page==="profile"?"My Profile":page==="leaderboards"?"Leaderboards":page.replace(/^[a-z]/,x=>x.toUpperCase()));
  window.scrollTo({top:0,behavior:"smooth"});
  if(page==="statistics")drawAnalytics();
}
function toast(msg){
  let t=$("toast");if(!t){t=document.createElement("div");t.id="toast";t.style.cssText="position:fixed;right:22px;bottom:22px;z-index:100;padding:12px 15px;border:1px solid #493460;border-radius:12px;background:#151020;color:#fff;box-shadow:0 15px 50px #000";document.body.appendChild(t)}
  t.textContent=msg;t.style.opacity="1";clearTimeout(t._timer);t._timer=setTimeout(()=>t.style.opacity="0",2200);
}
async function refresh(){
  const [p,k,c,m]=await Promise.all([api("/players"),api("/kits"),api("/config"),api("/matches")]);
  players=p.players||[];kits=k.kits||[];config=c.config||{};matches=m.matches||[];
  active=players.find(x=>x.id===localStorage.getItem("cribActivePlayer"))||players[0]||null;
  if(active)saveActive();
  renderAll();populateKits();drawChart();drawAnalytics();
  text("serverStatus","ONLINE");$("statusDot")?.style.setProperty("background","var(--good)");
}
function renderAll(){renderPlayerSwitch();renderPlayer();renderRecent();renderMatches();renderPlayers();renderKits();renderCompare();renderLeaderboard();renderLate();renderWinstreak();renderStats();renderAdmin();updateModeFields()}
function renderPlayerSwitch(){
  const s=$("activePlayerSelect");if(!s)return;
  s.innerHTML=players.map(p=>`<option value="${esc(p.id)}">${esc(p.displayName)} · ${num(p.rp)} RP</option>`).join("")||'<option value="">No players</option>';
  if(active)s.value=active.id;
}
function renderPlayer(){
  if(!active){
    ["sideName","profileDisplayName","rankTitle"].forEach(x=>text(x,"No player"));
    text("sideRank","Create a profile to begin");return;
  }
  const p=active,rd=rankData(p.rp),games=p.wins+p.losses,wr=games?p.wins/games*100:0,kd=p.deaths?p.kills/p.deaths:p.kills;
  text("sideName",p.displayName);text("sideRank",rd.label+" · "+p.rp+" RP");text("sideAvatar",initials(p.displayName));
  text("currentRankName",rd.label);text("currentRankRP",p.rp+" RP");text("dashboardWinRate",wr.toFixed(1)+"%");text("dashboardWinsMeta",games+" games");text("dashboardKD",kd.toFixed(2));text("dashboardCribRating",p.cribRating??1000);
  text("rankBanner",rd.label.toUpperCase());text("rankTitle",rd.label);text("rankSub",p.rp+" RP · "+(rd.next>=6000?"MAX RANK":(rd.next-p.rp)+" RP to promotion"));
  text("currentRPValue",p.rp);text("progressLow",rd.floor+" RP");text("progressTarget",rd.next>=6000?"MAX":rd.next+" RP");text("rankFootnote",rd.next>=6000?"Maximum visible rank reached.":"Need "+Math.max(0,rd.next-p.rp)+" RP to promote.");
  $("rankProgressBar")?.style.setProperty("width",rd.progress+"%");$("rankArt")?.setAttribute("src",rankImg(p.rp));$("rankArt")?.setAttribute("alt",rd.label+" rank emblem");
  text("profileAvatar",initials(p.displayName));text("profileDisplayName",p.displayName);text("profileUsername","@"+p.username);text("rankChip",rd.label);
  text("profileRP",p.rp);text("profilePeakRP",p.peakRP);text("profileWins",p.wins);text("profileWinsLosses",p.wins+" / "+p.losses);text("profileWinRate",wr.toFixed(1)+"%");text("profileGames",games+" games");text("profileCribRating",p.cribRating??1000);text("profilePercentile",games?"Active competitor":"Unranked · waiting for matches");
  $("profileRankArt")?.setAttribute("src",rankImg(p.rp));$("divisionImg")?.setAttribute("src",rankImg(p.rp));
  text("divisionName",rd.label);text("divisionProgressText",rd.next>=6000?"MAX RANK":p.rp+" / "+rd.next+" RP");$("divisionProgressBar")?.style.setProperty("width",rd.progress+"%");
  text("rankProgressSummary",rd.next>=6000?"You have reached Radiant I.":"You are "+rd.progress+"% through "+rd.label+" toward "+rd.next+" RP.");
  text("profileMMR",p.mmr);text("profilePerformance",p.performanceRating??p.cribRating??1000);text("profileLateELO",p.lateElo);text("profileFormRating",p.recentForm??p.winstreak);text("profileBedStreak",p.bedStreak??0);text("profileBestBedStreak",p.bestBedStreak??0);
  text("profileKills",p.kills);text("profileDeaths",p.deaths);text("profileKD",kd.toFixed(2));text("profileBeds",p.beds);text("profileWinstreak",p.winstreak);text("profileBestStreak",p.bestStreak);
  const h=[...(p.history||[])].reverse().slice(0,20),tb=$("rankHistoryTable");if(tb)tb.innerHTML=h.map(x=>{const r=rankData(x.rp);return `<tr><td>${esc(fmtDate(x.date))}</td><td>${esc(r.label)}</td><td>${num(x.rp)}</td><td class="${num(x.change)>=0?"rp-good":"rp-bad"}">${num(x.change)>=0?"+":""}${num(x.change)}</td><td>${esc(prettyKey(x.event||"Match"))}</td></tr>`}).join("")||'<tr><td colspan="5" class="muted-line">No ranked history yet.</td></tr>';
}
function renderRecent(){
  const box=$("recentMatchesList");if(!box)return;
  const arr=currentMatches().slice(0,6);
  box.innerHTML=arr.map(m=>`<div class="match-row"><div class="match-main"><span class="mode-dot ${m.result==="Loss"?"loss":m.type==="LG"?"lg":""}"></span><div><b>${esc(modeName(m.mode||m.type))}</b><small>${esc(m.kit||m.opponent||"Match")} · ${esc(fmtDate(m.createdAt))}</small></div></div><b class="${m.rp>=0?"rp-good":"rp-bad"}">${m.rp>=0?"+":""}${num(m.rp)} RP</b></div>`).join("")||'<div class="match-row"><span class="muted-line">No matches recorded yet. Start your first competitive record.</span></div>';
  const lb=$("leaderboardPreview");if(lb){lb.innerHTML=[...players].sort((a,b)=>(b.cribRating||0)-(a.cribRating||0)).slice(0,6).map((p,i)=>`<div class="leader-row"><span><b>#${i+1} · ${esc(p.displayName)}</b><small>${esc(rankData(p.rp).label)} · ${num(p.rp)} RP</small></span><strong>${num(p.cribRating)}</strong></div>`).join("")||'<div class="leader-row">No players yet.</div>'}
}
function renderMatches(){
  const tb=$("matchesTableBody");if(!tb)return;
  let arr=currentMatches(),q=($("scrimSearch")?.value||"").toLowerCase(),mode=$("scrimFilterMode")?.value||"all",kitF=$("scrimFilterKit")?.value||"all",res=$("scrimFilterResult")?.value||"all";
  arr=arr.filter(m=>(!q||JSON.stringify(m).toLowerCase().includes(q))&&(mode==="all"||m.mode===mode)&&(kitF==="all"||m.kit===kitF)&&(res==="all"||m.result===res));
  tb.innerHTML=arr.map(m=>`<tr><td><b>#${esc(String(m.id).slice(-7))}</b><small class="muted-line">${esc(fmtDate(m.createdAt))}</small></td><td>${esc(modeName(m.mode||m.type))}</td><td>${esc(m.kit||"—")}</td><td class="${m.result==="Win"?"rp-good":"rp-bad"}"><b>${esc(m.result||"—")}</b></td><td>${num(m.scoreFor)} — ${num(m.scoreAgainst)}</td><td>${num(m.performanceScore??m.perf??0)}</td><td class="${m.rp>=0?"rp-good":"rp-bad"}">${m.rp>=0?"+":""}${num(m.rp)}</td><td>${esc(fmtDate(m.createdAt))}</td></tr>`).join("")||'<tr><td colspan="8" class="muted-line">No matches match those filters.</td></tr>';
}
function populateKits(){
  const opts=kits.map(k=>`<option value="${esc(k.name)}">${esc(k.name)}</option>`).join("");
  ["scrimKitSelect","winstreakOpponentKitSelect","compareKitA","compareKitB"].forEach(id=>{const e=$(id);if(e)e.innerHTML=opts});
  const f=$("scrimFilterKit");if(f){const old=f.value;f.innerHTML='<option value="all">All kits</option>'+opts;f.value=old||"all"}
  const cls=$("kitClassFilter");if(cls){const old=cls.value;cls.innerHTML='<option value="all">All classes</option>'+[...new Set(kits.map(k=>k.class).filter(Boolean))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");cls.value=old||"all"}
  const opp=$("winstreakOpponentSelect");if(opp){opp.innerHTML=players.filter(p=>p.id!==active?.id).map(p=>`<option value="${p.id}">${esc(p.displayName)}</option>`).join("")||'<option value="">No registered opponent</option>'}
}
function renderKits(){
  const tb=$("kitsTableBody");if(!tb)return;
  let a=[...kits],q=($("kitSearch")?.value||"").toLowerCase(),cl=$("kitClassFilter")?.value||"all",ti=$("kitTierFilter")?.value||"all",st=$("kitStatusFilter")?.value||"all",sort=$("kitSort")?.value||"strongest";
  a=a.filter(k=>(!q||JSON.stringify(k).toLowerCase().includes(q))&&(cl==="all"||k.class===cl)&&(ti==="all"||k.tier===ti)&&(st==="all"||(st==="enabled"?k.enabled:!k.enabled)));
  a.sort((x,y)=>sort==="strongest"?num(y.power)-num(x.power):sort==="weakest"?num(x.power)-num(y.power):sort==="highest-rp"?num(y.rpMultiplier)-num(x.rpMultiplier):sort==="lowest-rp"?num(x.rpMultiplier)-num(y.rpMultiplier):String(x.name).localeCompare(String(y.name)));
  tb.innerHTML=a.map(k=>`<tr><td><b>${esc(k.name)}</b></td><td>${esc(k.class||"Other")}</td><td><b>${num(k.power)}</b>/100</td><td><span class="pill">${esc(k.tier||"—")}</span></td><td>×${num(k.rpMultiplier).toFixed(3)}</td><td>${esc(k.description||k.ability||"Mechanic not supplied")}</td><td>${k.enabled?"Enabled":"Disabled"}</td></tr>`).join("")||'<tr><td colspan="7">No kits match.</td></tr>';
  text("kitSourceStatus",kits.length+" kits loaded · modifiers apply to Scrims only · LG ignores kits");
}
function renderCompare(){
  const box=$("kitComparisonResult");if(!box)return;
  const a=kits.find(k=>k.name===$("compareKitA")?.value)||kits[0],b=kits.find(k=>k.name===$("compareKitB")?.value)||kits[1]||kits[0];if(!a||!b)return;
  const card=k=>`<article class="compare-card"><img class="rank-img medium" src="${rankImg(Math.max(0,num(k.power)*60))}" alt=""><span class="pill">${esc(k.tier||"—")} · ${esc(k.class||"Other")}</span><h2>${esc(k.name)}</h2><div class="power">${num(k.power)}<span>/100 power</span></div><p>Scrim RP modifier <b>×${num(k.rpMultiplier).toFixed(3)}</b></p><p>${esc(k.description||"Mechanic not supplied")}</p><div class="muted-line">Compared with ${esc(k.name===a.name?b.name:a.name)}, equivalent performance earns approximately ${Math.abs(num(k.rpMultiplier-(k.name===a.name?b.rpMultiplier:a.rpMultiplier))*100).toFixed(1)} percentage points of RP difference.</div></article>`;
  box.innerHTML=card(a)+card(b);
}
function renderPlayers(){
  const tb=$("playersTableBody");if(!tb)return;
  const q=($("playerSearchInput")?.value||"").toLowerCase();
  tb.innerHTML=players.filter(p=>JSON.stringify(p).toLowerCase().includes(q)).sort((a,b)=>num(b.cribRating)-num(a.cribRating)).map(p=>{const g=p.wins+p.losses,wr=g?p.wins/g*100:0;return `<tr><td><b>${esc(p.displayName)}</b><small class="muted-line">@${esc(p.username)}</small></td><td>${esc(rankData(p.rp).label)}</td><td>${num(p.rp)}</td><td>${num(p.cribRating)}</td><td>${p.wins} — ${p.losses} <small class="muted-line">${wr.toFixed(0)}% WR</small></td><td>${num(p.winstreak)}</td><td><button class="ghost" onclick="selectPlayer('${esc(p.id)}')">Open</button></td></tr>`}).join("")||'<tr><td colspan="7">No players found.</td></tr>';
}
function renderLeaderboard(){
  const box=$("leaderboardTable");if(!box)return;
  const type=$("leaderboardFilter")?.value||"overall";
  const arr=[...players];
  const score=p=>{const g=p.wins+p.losses,wr=g?p.wins/g:0;return type==="highest-rp"?p.rp:type==="highest-streak"?p.bestStreak:type==="highest-performance"?(p.performanceRating||p.cribRating):type==="most-wins"?p.wins:type==="best-winrate"?wr:p.cribRating};
  arr.sort((a,b)=>num(score(b))-num(score(a)));
  box.innerHTML=arr.map((p,i)=>`<div class="leader-row"><span><b>#${i+1} · ${esc(p.displayName)}</b><small>${esc(rankData(p.rp).label)} · ${p.wins}-${p.losses} · ${p.winstreak} streak</small></span><strong>${type==="best-winrate"?(score(p)*100).toFixed(1)+"%":num(score(p))}</strong></div>`).join("")||'<div class="leader-row">No players yet.</div>';
}
function renderWinstreak(){
  const box=$("winstreakSummary");if(!box||!active)return;
  const ms=currentMatches().filter(m=>m.mode==="WINSTREAK_1V1"),wins=ms.filter(m=>m.result==="Win").length;
  box.innerHTML=[["Current streak",active.winstreak],["Best streak",active.bestStreak],["1v1 wins",wins],["1v1 games",ms.length]].map(x=>`<div class="stat"><span>${x[0]}</span><strong>${x[1]}</strong><small>Winstreak ladder</small></div>`).join("");
  const h=$("winstreakHistory");if(h)h.innerHTML=ms.slice(0,12).map(m=>`<div class="match-row"><span><b>${m.result==="Win"?"WIN":"LOSS"}</b><small>${esc(m.opponent||m.opponents?.[0]||"Opponent")} · ${fmtDate(m.createdAt)}</small></span><strong class="${m.rp>=0?"rp-good":"rp-bad"}">${m.rp>=0?"+":""}${m.rp} RP</strong></div>`).join("")||'<div class="match-row">No 1v1 records yet.</div>';
  const lb=$("winstreakLeaderboard");if(lb)lb.innerHTML=[...players].sort((a,b)=>num(b.bestStreak)-num(a.bestStreak)).slice(0,10).map((p,i)=>`<div class="leader-row"><span>#${i+1} · ${esc(p.displayName)}</span><strong>${num(p.bestStreak)}</strong></div>`).join("");
}
function renderLate(){
  if(!active)return;const ms=currentMatches().filter(m=>m.type==="LG"),wins=ms.filter(m=>m.result==="Win").length,diff=ms.reduce((a,m)=>a+num(m.scoreFor)-num(m.scoreAgainst),0);
  const box=$("lateSummaryStats");if(box)box.innerHTML=[["LG wins",wins],["LG games",ms.length],["Win rate",ms.length?(wins/ms.length*100).toFixed(1)+"%":"0%"],["Score differential",(diff>=0?"+":"")+diff]].map(x=>`<div class="stat"><span>${x[0]}</span><strong>${x[1]}</strong><small>Reservoir · Custom Match</small></div>`).join("");
  const list=$("lateGamesList");if(list)list.innerHTML=ms.slice(0,15).map(m=>`<div class="match-row"><span><b>${m.result} · ${m.scoreFor} — ${m.scoreAgainst}</b><small>vs ${esc(m.opponent)} · ${fmtDate(m.createdAt)}</small></span><strong class="${m.rp>=0?"rp-good":"rp-bad"}">${m.rp>=0?"+":""}${m.rp} RP</strong></div>`).join("")||'<div class="match-row">No Late Games recorded.</div>';
  const rivals={};ms.forEach(m=>{const k=m.opponent||"Unknown";rivals[k]??={g:0,w:0,d:0};rivals[k].g++;rivals[k].w+=m.result==="Win"?1:0;rivals[k].d+=num(m.scoreFor)-num(m.scoreAgainst)});const rb=$("lateRivalsList");if(rb)rb.innerHTML=Object.entries(rivals).sort((a,b)=>b[1].w-a[1].w).map(([o,v])=>`<div class="leader-row"><span><b>${esc(o)}</b><small>${v.w}/${v.g} wins · ${v.d>=0?"+":""}${v.d} diff</small></span><strong>${(v.w/v.g*100).toFixed(0)}%</strong></div>`).join("")||'<div class="leader-row">No rivals yet.</div>';
}
function renderStats(){
  if(!active)return;const ms=currentMatches(),g=ms.length,wr=active.wins+active.losses?active.wins/(active.wins+active.losses)*100:0,kd=active.deaths?active.kills/active.deaths:active.kills;
  text("statWinRate",wr.toFixed(1)+"%");text("statKD",kd.toFixed(2));text("statAvgKills",g?(active.kills/g).toFixed(2):"0.00");text("statAvgBeds",g?(active.beds/g).toFixed(2):"0.00");text("statAvgPlacement",g?(ms.reduce((a,m)=>a+num(m.placement||0),0)/g).toFixed(1):"0.0");text("statRPChange",ms.reduce((a,m)=>a+num(m.rp),0));text("statWinstreak",active.winstreak);text("statGames",g);text("statMMR",active.mmr);text("statPerformance",active.performanceRating||active.cribRating);text("statLateELO",active.lateElo);text("statFormRating",active.recentForm??active.winstreak);
  const group=(key)=>{const o={};ms.forEach(m=>{const k=m[key]||"Unknown";o[k]??={g:0,w:0,rp:0};o[k].g++;o[k].w+=m.result==="Win"?1:0;o[k].rp+=num(m.rp)});return o};
  const renderGroup=(id,o)=>{const e=$(id);if(e)e.innerHTML=Object.entries(o).sort((a,b)=>b[1].g-a[1].g).slice(0,8).map(([k,v])=>`<div class="leader-row"><span><b>${esc(k)}</b><small>${v.w}/${v.g} wins</small></span><strong>${v.rp>=0?"+":""}${v.rp}</strong></div>`).join("")||'<div class="leader-row">No data yet.</div>'};
  renderGroup("kitStatsList",group("kit"));renderGroup("mapStatsList",group("map"));renderGroup("roleStatsList",group("role"));
  const opp={};ms.forEach(m=>(m.opponent||m.opponents?.join(", ")).split(",").map(x=>x.trim()).filter(Boolean).forEach(o=>{opp[o]??={g:0,w:0};opp[o].g++;opp[o].w+=m.result==="Win"?1:0}));renderGroup("opponentStatsList",Object.fromEntries(Object.entries(opp).map(([k,v])=>[k,{...v,rp:0}])));
}
function drawCanvas(canvas,values){
  if(!canvas)return;const ctx=canvas.getContext("2d"),rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(300,rect.width),h=Math.max(180,rect.height);canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  ctx.strokeStyle="#211d2c";ctx.lineWidth=1;for(let i=1;i<5;i++){const y=i*h/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  if(values.length<2){ctx.fillStyle="#777187";ctx.font="12px system-ui";ctx.fillText("Record a few matches to see your trend.",15,h/2);return}
  const min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min),pad=18;
  const pts=values.map((v,i)=>[pad+i*(w-pad*2)/(values.length-1),h-pad-(v-min)/span*(h-pad*2)]);
  const grad=ctx.createLinearGradient(0,0,w,0);grad.addColorStop(0,"#8b5cf6");grad.addColorStop(1,"#ec4899");
  ctx.strokeStyle=grad;ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();
  ctx.fillStyle="#fff";pts.slice(-1).forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);ctx.fill()});
}
function drawChart(){
  const ms=currentMatches().slice().reverse(),range=document.querySelector("[data-chart-range].active")?.dataset.chartRange||"7",arr=range==="all"?ms:ms.slice(-Number(range));
  let base=active?.rp??0,vals=[];for(let i=arr.length-1;i>=0;i--)base-=num(arr[i].rp);vals.push(base);base=active?.rp??0;for(let i=0;i<arr.length;i++){}let running=base;vals=arr.slice().reverse().map(m=>running-=num(m.rp)).reverse().concat(arr.length?[active.rp]:[]);drawCanvas($("rpChart"),vals.length?vals:[active?.rp??0]);
}
function drawAnalytics(){const ms=currentMatches().slice().reverse();drawCanvas($("analyticsChart"),ms.length?ms.map(m=>num(m.rp)).reduce((a,v,i)=>{a.push((a[i-1]||active?.rp||0)+v);return a},[]):[active?.rp||0])}
function updateModeFields(){
  const mode=$("scrimModeSelect")?.value||"STANDARD_SCRIM",one=mode==="WINSTREAK_1V1",noBed=mode==="NO_BED_SCRIM";
  ["winstreakOpponentFields","opponentKitFields"].forEach(id=>$(id)?.toggleAttribute("hidden",!one));
  $("standardOpponentFields")?.toggleAttribute("hidden",one);$("scrimBedsFields")?.toggleAttribute("hidden",noBed||one);$("scrimMapFields")?.toggleAttribute("hidden",one);
  if(one&&active)text("winstreakModeHint",active.winstreak);
}
async function createPlayer(){
  const username=$("newPlayerUsername").value.trim(),displayName=$("newPlayerDisplayName").value.trim()||username,password=$("newPlayerPassword").value;
  try{const d=await api("/players",{method:"POST",body:JSON.stringify({username,displayName,password})});show("createPlayerModal",false);localStorage.setItem("cribActivePlayer",d.player.id);await refresh();openPage("dashboard");toast("Player created")}catch(e){text("createPlayerError",e.message)}
}
async function saveScrim(){
  if(!active)return toast("Create a player first.");
  const mode=$("scrimModeSelect").value,op=$("winstreakOpponentSelect")?.value||null;
  const typedOpponents=$("scrimOpponents").value.split(",").map(x=>x.trim()).filter(Boolean);
  const b={playerId:active.id,mode,kit:$("scrimKitSelect").value,map:$("scrimMap").value,scoreFor:num($("scrimScoreFor").value),scoreAgainst:num($("scrimScoreAgainst").value),opponents:typedOpponents,opponentId:op,opponentRP:num($("scrimOpponentRP").value),role:$("scrimRole").value,kills:num($("scrimKills").value),deaths:num($("scrimDeaths").value),bedsDestroyed:num($("scrimBedsDestroyed").value),placement:num($("scrimPlacement").value),duration:num($("scrimDuration").value),verified:$("scrimVerified").value==="1",notes:$("scrimNotes").value};
  try{
    const d=await api("/matches/scrim",{method:"POST",body:JSON.stringify(b)});
    show("scrimModal",false);await refresh();openResult(d);
    const auto=d.autoCreatedPlayers||[];
    toast((d.match?.result==="Loss"?"Loss recorded · ":"Match recorded · ")+(auto.length?auto.length+" opponent profile"+(auto.length===1?"":"s")+" created":""));
  }catch(e){toast(e.message)}
}
async function saveLG(){
  if(!active)return toast("Create a player first.");
  try{const d=await api("/matches/lg",{method:"POST",body:JSON.stringify({playerId:active.id,opponent:$("lateOpponent").value,scoreFor:num($("latePlayerScore").value),scoreAgainst:num($("lateOpponentScore").value)})});show("lateGameModal",false);await refresh();openResult(d);toast("Late Game recorded")}catch(e){toast(e.message)}
}
function openResult(d){
  show("rpResultModal");const bd=d.breakdown||{},delta=num(bd.final);
  text("rpResultValue",(delta>=0?"+":"")+delta);text("rpResultTitle",d.match?.type==="LG"?"Late Game Rating":"Match Rating");text("rpResultSubtitle",d.match?.mode?modeName(d.match.mode)+" · server calculated":"Server-calculated result");
  const rows=Object.entries(bd).filter(([k])=>!["final"].includes(k));$("rpBreakdownRows").innerHTML=rows.map(([k,v])=>`<div class="breakdown-row"><span>${esc(prettyKey(k))}</span><b>${esc(prettyValue(v))}</b></div>`).join("");
  text("rpRankChange",active?rankData(active.rp).label:"");
  const created=d.autoCreatedPlayers||[];
  const box=$("autoProfileResults");
  if(box){
    box.innerHTML=created.length
      ? `<div class="auto-profile-panel"><div class="auto-profile-title">AUTO-CREATED PLAYER PROFILE${created.length===1?"":"S"}</div><p class="muted-line">These credentials were generated automatically for the opponent. Save them now — the password is only shown here.</p>${created.map(p=>`<div class="credential-card"><div><span>PLAYER</span><b>${esc(p.displayName)}</b></div><div><span>USERNAME</span><b>${esc(p.username)}</b></div><div><span>PASSWORD</span><b class="credential-password">${esc(p.password)}</b></div><div><span>STARTING RP</span><b>${num(p.rp)}</b></div></div>`).join("")}</div>`
      : "";
  }
}
async function selectPlayer(id){active=players.find(p=>p.id===id)||active;saveActive();renderAll();openPage("dashboard")}
window.selectPlayer=selectPlayer;
async function adminCall(path,body){return api(path,{method:"PUT",headers:{"x-admin-token":adminToken},body:JSON.stringify(body)})}
function renderAdmin(){
  const f=$("serverConfigFields");if(f)f.innerHTML=["baseWin","baseLoss","noKitMultiplier","minKitMultiplier","maxKitMultiplier","streakCap"].map(k=>`<div class="config-item"><label>${prettyKey(k)}<input id="cfg-${k}" type="number" step="0.01" value="${esc(config[k]??0)}"></label></div>`).join("");
  const tb=$("adminKitsTableBody");if(!tb)return;
  tb.innerHTML=kits.map((k,i)=>`<tr><td><b>${esc(k.name)}</b></td><td>${esc(k.class)}</td><td><input id="power-${i}" type="number" min="0" max="100" value="${num(k.power)}"></td><td><input id="meta-${i}" type="number" step=".1" value="${num(k.metaAdjustment||0)}"></td><td>${esc(k.tier||"—")}</td><td>×${num(k.rpMultiplier).toFixed(3)}</td><td>${k.enabled?"Enabled":"Disabled"}</td><td><button class="ghost" onclick="saveKit(${i})">Save</button></td></tr>`).join("");
}
window.saveKit=async i=>{
  if(!adminToken)return toast("Unlock admin first.");const k=kits[i];try{await adminCall("/admin/kits",{name:k.name,powerScore:num($("power-"+i).value),metaAdjustment:num($("meta-"+i).value)});await refresh();toast(k.name+" balanced")}catch(e){toast(e.message)}
};
async function unlockAdmin(){
  adminToken=$("adminTokenInput").value;try{await api("/config");await adminCall("/admin/config",{});text("adminStatus","Unlocked · token accepted");toast("Admin unlocked")}catch(e){text("adminStatus","Locked · "+e.message)}
}
async function saveConfig(){
  if(!adminToken)return toast("Unlock admin first.");const b={};["baseWin","baseLoss","noKitMultiplier","minKitMultiplier","maxKitMultiplier","streakCap"].forEach(k=>b[k]=num($("cfg-"+k).value));try{await adminCall("/admin/config",b);await refresh();toast("Ranked configuration saved")}catch(e){toast(e.message)}
}
document.addEventListener("click",e=>{
  const n=e.target.closest(".nav");if(n)openPage(n.dataset.page);
  const c=e.target.closest("[data-close-modal]");if(c)show(c.dataset.closeModal,false);
});
$("activePlayerSelect")?.addEventListener("change",e=>selectPlayer(e.target.value));
["newPlayerBtn","playersCreateBtn"].forEach(id=>$(id)?.addEventListener("click",()=>show("createPlayerModal")));
["quickAddBtn","dashboardAddMatchBtn","addScrimBtn","profileRecordBtn"].forEach(id=>$(id)?.addEventListener("click",()=>show("scrimModal")));
$("quickAddLGBtn")?.addEventListener("click",()=>show("lateGameModal"));$("openLateGameBtn")?.addEventListener("click",()=>show("lateGameModal"));
$("openWinstreakBtn")?.addEventListener("click",()=>{show("scrimModal");$("scrimModeSelect").value="WINSTREAK_1V1";updateModeFields()});
$("createPlayerSubmit")?.addEventListener("click",createPlayer);$("saveScrimBtn")?.addEventListener("click",saveScrim);$("saveLateGameBtn")?.addEventListener("click",saveLG);$("adminLoginBtn")?.addEventListener("click",unlockAdmin);$("saveServerConfigBtn")?.addEventListener("click",saveConfig);
$("openProfileBtn")?.addEventListener("click",()=>openPage("profile"));$("recentMatchesBtn")?.addEventListener("click",()=>openPage("scrims"));$("leaderboardOpenBtn")?.addEventListener("click",()=>openPage("leaderboards"));$("globalSearchBtn")?.addEventListener("click",()=>{openPage("scrims");$("scrimSearch")?.focus()});
$("scrimModeSelect")?.addEventListener("change",updateModeFields);
["scrimSearch","scrimFilterMode","scrimFilterKit","scrimFilterResult"].forEach(id=>$(id)?.addEventListener("input",renderMatches));
["kitSearch","kitClassFilter","kitTierFilter","kitStatusFilter","kitSort"].forEach(id=>$(id)?.addEventListener("input",renderKits));
["compareKitA","compareKitB"].forEach(id=>$(id)?.addEventListener("change",renderCompare));
$("playerSearchInput")?.addEventListener("input",renderPlayers);$("leaderboardFilter")?.addEventListener("change",renderLeaderboard);
document.querySelectorAll("[data-chart-range]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-chart-range]").forEach(x=>x.classList.remove("active"));b.classList.add("active");drawChart()}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-backdrop.open").forEach(x=>x.classList.remove("open"));if(e.ctrlKey&&e.key.toLowerCase()==="k"){e.preventDefault();openPage("scrims");$("scrimSearch")?.focus()}if(e.ctrlKey&&e.key.toLowerCase()==="n"){e.preventDefault();show("scrimModal")}});
window.addEventListener("resize",()=>{drawChart();drawAnalytics()});
refresh().catch(e=>{text("serverStatus","OFFLINE");$("statusDot")?.style.setProperty("background","var(--bad)");toast("CRIB server offline — run npm start");console.error(e)});
