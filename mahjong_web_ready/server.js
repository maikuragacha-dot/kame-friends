const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const SUITS = ["m","p","s"];
const HONORS = ["E","S","W","N","P","F","C"];
const HONOR_NAMES = {E:"東",S:"南",W:"西",N:"北",P:"白",F:"發",C:"中"};
const rooms = new Map();
const tileName = t => t.kind === "honor" ? HONOR_NAMES[t.code] : `${t.n}${({m:"萬",p:"筒",s:"索"})[t.suit]}`;
function tileKey(t){ return t.kind==="honor" ? t.code : `${t.suit}${t.n}`; }
function makeWall(playerCount=4){
  const w=[];
  for(const suit of SUITS) for(let n=1;n<=9;n++) { if(playerCount===3&&suit==="m"&&n>=2&&n<=8) continue; for(let i=0;i<4;i++) w.push({kind:"num",suit,n,code:`${suit}${n}`,red:n===5&&i===0&&(suit!=="m"||playerCount===4)}); }
  for(const code of HONORS) for(let i=0;i<4;i++) w.push({kind:"honor",code});
  for(let i=w.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[w[i],w[j]]=[w[j],w[i]];}
  return w;
}
function isTerminalOrHonor(t){return t.kind==="honor" || t.n===1 || t.n===9;}
function counts(tiles){const c={}; for(const t of tiles)c[tileKey(t)]=(c[tileKey(t)]||0)+1; return c;}
function isSevenPairs(tiles){const c=Object.values(counts(tiles));return tiles.length===14&&c.length===7&&c.every(n=>n===2);}
function allSimple(tiles){return tiles.every(t=>t.kind==="num"&&t.n>=2&&t.n<=8);}
function allTileTypes(playerCount=4){const a=[];for(const suit of SUITS)for(let n=1;n<=9;n++){if(playerCount===3&&suit==="m"&&n>=2&&n<=8)continue;a.push({kind:"num",suit,n,code:`${suit}${n}`});}for(const code of HONORS)a.push({kind:"honor",code});return a;}
function seatWindOf(player,room){const winds=["E","S","W","N"];const count=room?.players?.length||4;return winds[((player.seat-(room?.dealer||0)+count)%count)%4]||"E";}
function hasYakuhai(tiles, seatWind, roundWind){const c=counts(tiles);return ["P","F","C",seatWind,roundWind].some(k=>(c[k]||0)>=3);}
function waitsFor(player,room=null){
  const waits=[];
  for(const t of allTileTypes(room?.rules?.playerCount||4)) if(isComplete([...player.hand,t])) waits.push(tileKey(t));
  return waits;
}
function isFuriten(player){
  const waits=new Set(player.riichi&&player.riichiWaits?.length?player.riichiWaits:waitsFor(player));
  return (player.discards||[]).some(d=>waits.has(tileKey(d.tile))) || !!player.temporaryFuriten || !!player.riichiFuriten;
}
function tenpaiInfo(player,room=null){
  if(!player) return {waits:[],noYaku:false,furiten:false};
  // In discard phase a player normally has 14 tiles. Show waits for any discard
  // that leaves a 13-tile tenpai hand; after riichi, use the locked wait set.
  let candidateHands=[];
  if(player.riichi && player.riichiWaits?.length){
    const locked=player.riichiWaits.map(k=>allTileTypes(room?.rules?.playerCount||4).find(t=>tileKey(t)===k)).filter(Boolean);
    return {waits:locked.map(t=>({...t,face:tileName(t)})),noYaku:false,furiten:isFuriten(player)};
  }
  if(player.hand.length%3===1) candidateHands=[player.hand];
  else if(player.hand.length%3===2) candidateHands=player.hand.map((_,i)=>player.hand.filter((__,j)=>i!==j));
  const unique=new Map();
  for(const hand of candidateHands){
    if(hand.length%3!==1) continue;
    for(const t of allTileTypes(room?.rules?.playerCount||4)) if(isComplete([...hand,t])) unique.set(tileKey(t),{tile:t,hand});
  }
  const waits=[...unique.values()];
  let hasAnyYaku=false;
  for(const {tile:t,hand} of waits){
    const old=player._winningTile;player._winningTile=t;
    try{const completed=[...hand,t];const ron=evaluate(completed,player,room,false),tsumo=evaluate(completed,player,room,true);if(ron.yakuHan>0||ron.yakumanUnits>0||tsumo.yakuHan>0||tsumo.yakumanUnits>0){hasAnyYaku=true;break;}}
    finally{player._winningTile=old;}
  }
  const waitKeys=new Set(waits.map(x=>tileKey(x.tile)));
  const furiten=(player.discards||[]).some(d=>waitKeys.has(tileKey(d.tile)))||!!player.temporaryFuriten||!!player.riichiFuriten;
  return {waits:waits.map(x=>({...x.tile,face:tileName(x.tile)})),noYaku:waits.length>0&&!hasAnyYaku,furiten};
}
function canRiichiDiscard(p,index,room=null){if(p.riichi||p.score<1000||p.melds.length||p.hand.length!==14)return false;const hand=p.hand.filter((_,i)=>i!==index);return allTileTypes(room?.rules?.playerCount||4).some(t=>isComplete([...hand,t]));}
function riichiAvailable(p,room=null){return !!p&&!p.riichi&&p.score>=1000&&(room?.wall?.length??0)>4&&p.melds.length===0&&p.hand.length===14&&!canWin(p,null,true,room)&&p.hand.some((_,i)=>canRiichiDiscard(p,i,room));}
const KEYRANK=k=>k.length===1?300+"ESWNPFC".indexOf(k):"mps".indexOf(k[0])*10+(+k[1]);
function sortedKeys(c){return Object.keys(c).sort((a,b)=>KEYRANK(a)-KEYRANK(b));}
function isKokushi(tiles){if(tiles.length!==14)return false;return Object.keys(counts(tiles)).length===13&&tiles.every(isTerminalOrHonor);}
function isComplete(tiles){
  if(tiles.length%3!==2)return false;
  if(isSevenPairs(tiles)||isKokushi(tiles))return true;
  const c=counts(tiles),keys=sortedKeys(c);
  const meldsLeft=()=>{
    const k=keys.find(x=>c[x]>0);if(!k)return true;
    if(c[k]>=3){c[k]-=3;const r=meldsLeft();c[k]+=3;if(r)return true;}
    const m=/^([mps])(\d)$/.exec(k);
    if(m&&+m[2]<=7){const k2=m[1]+(+m[2]+1),k3=m[1]+(+m[2]+2);if(c[k2]>0&&c[k3]>0){c[k]--;c[k2]--;c[k3]--;const r=meldsLeft();c[k]++;c[k2]++;c[k3]++;if(r)return true;}}
    return false;};
  for(const k of keys){if(c[k]>=2){c[k]-=2;const r=meldsLeft();c[k]+=2;if(r)return true;}}
  return false;
}
function getDecompositions(tiles){
  if(tiles.length%3!==2)return [];
  const c=counts(tiles),keys=sortedKeys(c),rep={};tiles.forEach(t=>rep[tileKey(t)]=t);
  const out=[],seen=new Set();
  function rec(melds,pair){
    const k=keys.find(x=>c[x]>0);
    if(!k){const sig=pair+"|"+melds.map(m=>m.type[0]+m.key).sort().join(",");if(!seen.has(sig)){seen.add(sig);out.push({pair,melds:[...melds]});}return;}
    const t=rep[k];
    if(c[k]>=3){c[k]-=3;melds.push({type:"triplet",key:k,tile:t});rec(melds,pair);melds.pop();c[k]+=3;}
    if(t.kind==="num"&&t.n<=7){const k2=t.suit+(t.n+1),k3=t.suit+(t.n+2);if(c[k2]>0&&c[k3]>0){c[k]--;c[k2]--;c[k3]--;melds.push({type:"sequence",key:k,tile:t});rec(melds,pair);melds.pop();c[k]++;c[k2]++;c[k3]++;}}
  }
  for(const k of keys){if(c[k]>=2){c[k]-=2;rec([],k);c[k]+=2;}}
  return out;
}
// ---- 副露を面子として扱う ----
function openMeldInfo(player){
  return (player.melds||[]).map(m=>{const ts=m.tiles,k0=tileKey(ts[0]);
    if(ts.every(t=>tileKey(t)===k0))return {type:"triplet",kan:ts.length===4,key:k0,tile:ts[0],open:true};
    const s=[...ts].sort((a,b)=>a.n-b.n);return {type:"sequence",key:tileKey(s[0]),tile:s[0],open:true};});
}
// 和了牌がどこで完成したか（待ちの形）ごとに解釈を列挙する
function interpretations(hand,player,winTile){
  const open=openMeldInfo(player),res=[],wk=tileKey(winTile);
  for(const d of getDecompositions(hand)){
    const all=[...d.melds.map(m=>({...m,open:false})),...open],placed=new Set();
    if(d.pair===wk)res.push({pair:d.pair,melds:all,wait:"tanki",winMeld:-1});
    d.melds.forEach((m,i)=>{
      let wait=null;
      if(m.type==="triplet"&&m.key===wk)wait="shanpon";
      else if(m.type==="sequence"&&winTile.kind==="num"&&winTile.suit===m.tile.suit){
        const n=m.tile.n,w=winTile.n;
        if(w===n)wait=n===7?"penchan":"ryanmen";else if(w===n+2)wait=n===1?"penchan":"ryanmen";else if(w===n+1)wait="kanchan";}
      if(!wait)return;const sig=wait+m.type+m.key;if(placed.has(sig))return;placed.add(sig);
      res.push({pair:d.pair,melds:all,wait,winMeld:i});
    });
  }
  if(isSevenPairs(hand))res.push({chiitoi:true,pair:null,melds:[],wait:"tanki",winMeld:-1});
  if(isKokushi(hand))res.push({kokushi:true,pair:null,melds:[],wait:"tanki",winMeld:-1});
  return res;
}
function withoutOne(hand,w){const i=hand.findIndex(t=>tileKey(t)===tileKey(w));return hand.filter((_,j)=>j!==i);}
const WIND_NAME={E:"東",S:"南",W:"西",N:"北"},DRAGON_NAME={P:"白",F:"發",C:"中"};
const GREEN_KEYS=new Set(["s2","s3","s4","s6","s8","F"]);
function scoreInterp(it,x){
  const {player,room,tsumo,closed,all,hand,winTile}=x,Y=[],YM=[];
  const add=(name,han)=>Y.push({name,han}),addM=(name,units=1)=>YM.push({name,yakuman:units});
  const hasHonor=all.some(t=>t.kind==="honor"),suits=new Set(all.filter(t=>t.kind==="num").map(t=>t.suit));
  const melds=it.melds,tris=melds.filter(m=>m.type==="triplet"),seqs=melds.filter(m=>m.type==="sequence"),kans=tris.filter(m=>m.kan).length;
  const noMelds=(room?.players||[]).every(p=>!(p.melds||[]).length);
  let ankou=0;if(!it.chiitoi&&!it.kokushi)ankou=melds.filter((m,i)=>m.type==="triplet"&&!m.open&&!(!tsumo&&i===it.winMeld)).length;
  // ---- 役満 ----
  if(tsumo&&closed&&room?.firstTurn&&player.seat===room.dealer&&(room.players||[]).every(p=>(p.discards||[]).length===0))addM("天和");
  if(tsumo&&closed&&room?.noCalls===true&&player.seat!==room?.dealer&&(player.discards||[]).length===0)addM("地和");
  if(all.every(t=>t.kind==="honor"))addM("字一色");
  if(all.every(t=>GREEN_KEYS.has(tileKey(t))))addM("緑一色");
  if(all.every(t=>t.kind==="num"&&(t.n===1||t.n===9)))addM("清老頭");
  if(it.kokushi){const pre=counts(withoutOne(hand,winTile));addM(Object.keys(pre).length===13?"国士無双十三面待ち":"国士無双",Object.keys(pre).length===13?2:1);}
  if(!it.chiitoi&&!it.kokushi){
    const tk=tris.map(m=>m.key);
    if(["P","F","C"].every(k=>tk.includes(k)))addM("大三元");
    const wt=["E","S","W","N"].filter(k=>tk.includes(k)).length;
    if(wt===4)addM("大四喜",2);else if(wt===3&&["E","S","W","N"].includes(it.pair))addM("小四喜");
    if(ankou===4)addM(it.wait==="tanki"?"四暗刻単騎":"四暗刻",it.wait==="tanki"?2:1);
    if(kans===4)addM("四槓子");
    if(closed&&suits.size===1&&!hasHonor&&hand.length===14){
      const c=counts(all),s=[...suits][0],need=[3,1,1,1,1,1,1,1,3];
      if(need.every((n,i)=>(c[s+(i+1)]||0)>=n)){const pc=counts(withoutOne(hand,winTile));addM(need.every((n,i)=>(pc[s+(i+1)]||0)===n)?"純正九蓮宝燈":"九蓮宝燈",need.every((n,i)=>(pc[s+(i+1)]||0)===n)?2:1);}
    }
  }
  if(YM.length)return {Y:[],YM,fu:0};
  // ---- 通常役 ----
  const seatWind=x.seatWind,roundWind=x.roundWind;
  if(player.riichi){player.doubleRiichi?add("ダブル立直",2):add("立直",1);if(player.ippatsu)add("一発",1);}
  if(tsumo&&closed)add("門前清自摸和",1);
  if(Array.isArray(room?.wall)&&room.wall.length===0&&!player.rinshan)add(tsumo?"海底摸月":"河底撈魚",1);
  if(tsumo&&player.rinshan)add("嶺上開花",1);
  if(all.every(t=>t.kind==="num"&&t.n>=2&&t.n<=8))add("断么九",1);
  const allTO=all.every(isTerminalOrHonor);
  if(allTO&&hasHonor)add("混老頭",2);
  if(suits.size===1)hasHonor?add("混一色",closed?3:2):add("清一色",closed?6:5);
  if(it.chiitoi)add("七対子",2);
  else if(!it.kokushi){
    tris.forEach(m=>{if(DRAGON_NAME[m.key])add("役牌 "+DRAGON_NAME[m.key],1);if(m.key===seatWind)add("自風 "+WIND_NAME[m.key],1);if(m.key===roundWind)add("場風 "+WIND_NAME[m.key],1);});
    const pairValue=["P","F","C",seatWind,roundWind].includes(it.pair);
    if(closed&&seqs.length===4&&it.wait==="ryanmen"&&!pairValue)add("平和",1);
    if(closed){const cs={};seqs.forEach(m=>cs[m.key]=(cs[m.key]||0)+1);const dup=Object.values(cs).reduce((a,n)=>a+Math.floor(n/2),0);if(dup>=2)add("二盃口",3);else if(dup===1)add("一盃口",1);}
    if(tris.length===4)add("対々和",2);
    if(ankou===3)add("三暗刻",2);
    if(kans===3)add("三槓子",2);
    const nt={};tris.forEach(m=>{if(m.tile.kind==="num"){(nt[m.tile.n]=nt[m.tile.n]||new Set()).add(m.tile.suit);}});
    if(Object.values(nt).some(s=>s.size===3))add("三色同刻",2);
    const ns={};seqs.forEach(m=>{(ns[m.tile.n]=ns[m.tile.n]||new Set()).add(m.tile.suit);});
    if(Object.values(ns).some(s=>s.size===3))add("三色同順",closed?2:1);
    const st={};seqs.forEach(m=>{(st[m.tile.suit]=st[m.tile.suit]||new Set()).add(m.tile.n);});
    if(Object.values(st).some(s=>[1,4,7].every(n=>s.has(n))))add("一気通貫",closed?2:1);
    const pairTO=it.pair&&isTerminalOrHonor(it.pair.length===1?{kind:"honor"}:{kind:"num",n:+it.pair[1]});
    if(seqs.length>=1&&pairTO&&melds.every(m=>m.type==="sequence"?(m.tile.n===1||m.tile.n===7):isTerminalOrHonor(m.tile)))hasHonor?add("混全帯么九",closed?2:1):add("純全帯么九",closed?3:2);
    if(["P","F","C"].filter(k=>tris.some(m=>m.key===k)).length===2&&["P","F","C"].includes(it.pair))add("小三元",2);
  }
  // ---- 符 ----
  let fu;
  if(it.chiitoi)fu=25;
  else if(Y.some(y=>y.name==="平和")&&tsumo)fu=20;
  else{
    fu=20;if(tsumo)fu+=2;else if(closed)fu+=10;
    if(["P","F","C"].includes(it.pair))fu+=2;if(it.pair===seatWind)fu+=2;if(it.pair===roundWind)fu+=2;
    melds.forEach((m,i)=>{if(m.type!=="triplet")return;let f=isTerminalOrHonor(m.tile)?4:2;if(!m.open&&!(!tsumo&&i===it.winMeld))f*=2;if(m.kan)f*=4;fu+=f;});
    if(["tanki","kanchan","penchan"].includes(it.wait))fu+=2;
    if(!closed&&!tsumo&&fu===20)fu=30;
    fu=Math.ceil(fu/10)*10;
  }
  return {Y,YM:[],fu};
}
function baseOf(han,fu,units){if(units)return 8000*units;if(han>=13)return 8000;if(han>=11)return 6000;if(han>=8)return 4000;if(han>=6)return 3000;if(han>=5)return 2000;return Math.min(2000,fu*Math.pow(2,han+2));}
const EMPTY_EVAL={yaku:[],yakuList:[],yakuHan:0,yakumanUnits:0,han:0,fu:0,dora:0,aka:0,basePoints:0,points:0};
// 手牌・副露・和了牌から、最も得点の高い解釈で役・符・点数を返す
function evaluate(hand,player,room,tsumo){
  const winTile=player._winningTile||(tsumo?(hand.includes(player.lastDrawnTile)?player.lastDrawnTile:hand[hand.length-1]):null);
  if(!winTile||hand.length%3!==2)return {...EMPTY_EVAL};
  const open=player.melds||[],closed=open.length===0,all=[...hand,...open.flatMap(m=>m.tiles)];
  const x={player,room,tsumo,closed,all,hand,winTile,seatWind:seatWindOf(player,room),roundWind:room?.roundWind||"E"};
  const pc=room?.rules?.playerCount||4,inds=room?.dora||[];
  const dk=inds.map(i=>tileKey(nextDora(i,pc))),uk=(player.riichi?(room?.uraDora||[]).slice(0,inds.length):[]).map(i=>tileKey(nextDora(i,pc)));
  let dora=(player.nuki||[]).length,aka=0;
  for(const t of [...all,...(player.nuki||[])]){if(t.red)aka++;const k=tileKey(t);dora+=dk.filter(d=>d===k).length+uk.filter(d=>d===k).length;}
  let best=null;
  for(const it of interpretations(hand,player,winTile)){
    const r=scoreInterp(it,x),units=r.YM.reduce((n,y)=>n+y.yakuman,0),yh=r.Y.reduce((n,y)=>n+y.han,0);
    if(!units&&!yh)continue;
    const han=units?units*13:yh+dora+aka,base=baseOf(han,r.fu,units),cand={r,units,yh,han,base};
    if(!best||base>best.base||(base===best.base&&(han>best.han||(han===best.han&&r.fu>best.r.fu))))best=cand;
  }
  if(!best)return {...EMPTY_EVAL,dora,aka};
  const list=best.units?best.r.YM:best.r.Y;
  return {yaku:list.map(y=>y.name),yakuList:list,yakuHan:best.yh,yakumanUnits:best.units,han:best.han,fu:best.r.fu,dora,aka,basePoints:best.base,points:best.base*4};
}
function detectYaku(hand,player,room,tsumo){return evaluate(hand,player,room,tsumo).yaku;}
function calcFu(hand,player,room,tsumo){return evaluate(hand,player,room,tsumo).fu;}
function estimatePoints(hand,player,room,tsumo){const r=evaluate(hand,player,room,tsumo);return {points:r.points,basePoints:r.basePoints,yaku:r.yaku,yakuList:r.yakuList,han:r.han,fu:r.fu,dora:r.dora,aka:r.aka,yakumanUnits:r.yakumanUnits};}
function canWin(player,tile,tsumo=false,room=null){
  if(!tsumo&&isFuriten(player))return false;
  const hand=tsumo?player.hand:[...player.hand,tile];
  if(!isComplete(hand))return false;
  const old=player._winningTile;player._winningTile=tile||null;
  try{const r=evaluate(hand,player,room,tsumo);return r.yakuHan>0||r.yakumanUnits>0;}finally{player._winningTile=old;}
}
function nextDora(ind,pc=4){
  if(ind.kind==="honor"){const order=["E","S","W","N"],dr=["P","F","C"];if(order.includes(ind.code))return {kind:"honor",code:order[(order.indexOf(ind.code)+1)%4]};return {kind:"honor",code:dr[(dr.indexOf(ind.code)+1)%3]};}
  let n=ind.n===9?1:ind.n+1;if(pc===3&&ind.suit==="m")n=ind.n===1?9:1; // 三麻: 萬子は1と9のみ
  return {kind:"num",suit:ind.suit,n,code:`${ind.suit}${n}`};
}

function sameTile(a,b){return tileKey(a)===tileKey(b);}
function legalCalls(room,p){
  if(room.phase!=="response"||!room.lastDiscard||room.lastDiscard.playerId===p.id)return [];
  const tile=room.lastDiscard.tile, c=counts(p.hand), k=tileKey(tile), opts=[];
  if(canWin(p,tile,false,room))opts.push("ron");
  if(p.riichi)return opts;
  if((c[k]||0)>=2)opts.push("pon");
  if((room.rules?.playerCount||4)===4&&tile.kind==="num"&&p.seat===(room.players.find(x=>x.id===room.lastDiscard.playerId).seat+1)%room.players.length){
    for(let n=Math.max(1,tile.n-2);n<=Math.min(7,tile.n);n++){
      const a={kind:"num",suit:tile.suit,n,code:`${tile.suit}${n}`},b={kind:"num",suit:tile.suit,n:n+1,code:`${tile.suit}${n+1}`},d={kind:"num",suit:tile.suit,n:n+2,code:`${tile.suit}${n+2}`};
      if(sameTile(tile,a)&&(c[tileKey(b)]||0)>0&&(c[tileKey(d)]||0)>0 || sameTile(tile,b)&&(c[tileKey(a)]||0)>0&&(c[tileKey(d)]||0)>0 || sameTile(tile,d)&&(c[tileKey(a)]||0)>0&&(c[tileKey(b)]||0)>0){opts.push("chi");break;}
    }
  }
  if((c[k]||0)>=3)opts.push("kan");
  return opts;
}
function visiblePlayer(p, viewerId, room){
  return {id:p.id,name:p.name,seat:p.seat,score:p.score,ready:p.ready,connected:p.connected,
    handCount:p.hand.length,hand:p.id===viewerId?p.hand.map(t=>({...t,face:tileName(t)})):[],lastDrawnIndex:p.id===viewerId&&p.lastDrawnTile?p.hand.findIndex(t=>t===p.lastDrawnTile):-1,
    waits:p.id===viewerId?tenpaiInfo(p,room).waits:[],
    tenpaiInfo:p.id===viewerId?tenpaiInfo(p,room):null,
    discards:p.discards.map(t=>({...t,face:tileName(t.tile),tile:t.tile,riichi:t.riichi,called:t.called})),
    melds:p.melds.map(m=>({type:m.type,tiles:m.tiles.map(t=>m.type==="ankan"&&p.id!==viewerId?{hidden:true,face:"裏向き"}:{...t,face:tileName(t)})})),
    nuki:(p.nuki||[]).map(t=>({...t,face:tileName(t)})),
    riichi:p.riichi,riichiPending:p.riichiPending,riichiChoiceMade:!!p.riichiChoiceMade,furiten:isFuriten(p)};
}
function broadcastRoom(room){
  for(const p of room.players) io.to(p.id).emit("room:update",{
    code:room.code,name:room.name,hostId:room.hostId,started:room.started,
    rules:room.rules,players:room.players.map(x=>({id:x.id,name:x.name,seat:x.seat,score:x.score,ready:x.ready,isCPU:x.isCPU,connected:x.connected}))
  });
}
function emitState(room){
  for(const p of room.players){
    io.to(p.id).emit("game:state",{
      roomName:room.name,roundWind:room.roundWind,roundNumber:room.roundNumber,honba:room.honba,
      dealer:room.dealer,dealerId:room.players.find(p=>p.seat===room.dealer)?.id,turnId:room.players[room.turn]?.id,wallCount:room.wall.length,
      dora:room.dora.map(t=>({...t,face:tileName(t)})),playerCount:room.rules?.playerCount||4,gameLength:room.rules?.gameLength||"south",startingScore:room.rules?.startingScore||25000,players:room.players.map(x=>visiblePlayer(x,p.id,room)),pendingCall:room.phase==="response"&&room.pendingResponses?.includes(p.id),canPass:room.phase==="response"&&room.pendingResponses?.includes(p.id),
      lastDiscard:room.lastDiscard?{playerId:room.lastDiscard.playerId,tile:room.lastDiscard.tile,face:tileName(room.lastDiscard.tile)}:null,
      phase:room.phase,canCalls:legalCalls(room,p),canTsumo:room.phase==="discard"&&room.players[room.turn]?.id===p.id&&canWin(p,null,true,room),
      canNuki:room.rules?.playerCount===3&&room.phase==="discard"&&room.players[room.turn]?.id===p.id&&(p.hand||[]).some(t=>t.kind==="honor"&&t.code==="N")&&(!p.riichi||(p.lastDrawnTile?.kind==="honor"&&p.lastDrawnTile.code==="N")),
      canAnkan:room.phase==="discard"&&room.players[room.turn]?.id===p.id&&!p.riichi&&Object.values(counts(p.hand)).some(n=>n>=4),
      canKakan:room.phase==="discard"&&room.players[room.turn]?.id===p.id&&!p.riichi&&(p.melds||[]).some(m=>m.type==="pon"&&p.hand.some(t=>tileKey(t)===tileKey(m.tiles[0]))),
      canRiichi:room.phase==="discard"&&room.players[room.turn]?.id===p.id&&riichiAvailable(p,room),
      riichiChoiceMade:!!p.riichiChoiceMade,
      notice:room.notice||""
    });
  }
}
function message(room,name,text,system=false){io.to(room.code).emit("chat:message",{name,text,system});}
function discard(room,p,index,declareRiichi=false){
  if(!room.started||room.phase!=="discard"||room.players[room.turn]?.id!==p.id)return false;
  if(!Number.isInteger(index)||index<0||index>=p.hand.length)return false;
  const canOfferRiichi=riichiAvailable(p,room);
  if(canOfferRiichi&&!p.riichiChoiceMade&&!declareRiichi)return false;
  if(declareRiichi&&!canRiichiDiscard(p,index,room))return false;
  if(declareRiichi)p.riichiChoiceMade=true;
  if(p.riichi&&!declareRiichi&&p.lastDrawnTile&&p.hand[index]!==p.lastDrawnTile)return false; // リーチ後はツモ切りのみ
  const tile=p.hand.splice(index,1)[0];
  p.lastDrawnTile=null;
  room.firstTurn=false;
  p.ippatsu=false;p.rinshan=false; // 自分の次の打牌で一発は消える
  if(declareRiichi){p.doubleRiichi=p.discards.length===0&&room.players.every(x=>!(x.melds||[]).length);p.riichi=true;p.riichiPending=true;p.riichiWaits=waitsFor(p,room);p.score-=1000;room.kyotaku=(room.kyotaku||0)+1000;p.ippatsu=true;}
  p.discards.push({tile,riichi:declareRiichi,called:false});
  room.lastDiscard={playerId:p.id,tile};room.phase="response";room.notice=`${p.name}が${tileName(tile)}を捨てました。`;
  emitState(room);
  // Pause the table until every eligible human explicitly responds; CPUs pass automatically.
  const eligible=room.players.filter(x=>x.id!==p.id&&legalCalls(room,x).length>0);
  room.pendingResponses=eligible.filter(x=>!x.isCPU).map(x=>x.id);
  room.cpuResponses=eligible.filter(x=>x.isCPU).map(x=>x.id);
  for(const cpu of eligible.filter(x=>x.isCPU)) setTimeout(()=>{if(room.started&&room.phase==="response"&&room.cpuResponses?.includes(cpu.id))respondCall(room,cpu,"pass");},350);
  if(!room.pendingResponses.length&&!room.cpuResponses.length)resolveNoCall(room); else emitState(room);
  return true;
}
function setDraw(room,p){p.riichiChoiceMade=false;if(!room.wall.length){endHand(room,"荒牌流局");return;}p.temporaryFuriten=false;const drawn=room.wall.pop();p.hand.push(drawn);p.lastDrawnTile=drawn;p.rinshan=false;room.turn=p.seat;room.phase="discard";emitState(room);}
function isCompleteTenpai(p,room){
  if(!p)return false;
  return allTileTypes(room?.rules?.playerCount||4).some(t=>isComplete([...p.hand,t]));
}
function beginHand(room){
  room.handStartScores=room.players.map(p=>p.score);room.noCalls=true;
  room.wall=makeWall(room.rules?.playerCount||4); room.players.forEach(p=>{p.hand=[];p.doubleRiichi=false;p.rinshan=false;p.discards=[];p.melds=[];p.nuki=[];p.lastDrawnTile=null;p.riichi=false;p.riichiPending=false;p.riichiWaits=[];p.riichiChoiceMade=false;p.furiten=false;p.temporaryFuriten=false;p.riichiFuriten=false;p.ippatsu=false;p.ready=true;});
  room.dora=[room.wall.pop()]; room.uraDora=[room.wall.pop()]; room.kanCount=0; room.firstTurn=true; room.players.forEach(p=>{p.hand=room.wall.splice(0,13);});
  room.turn=room.dealer;room.roundWind=room.roundWind||"E";room.roundNumber=room.roundNumber||1;room.honba=room.honba||0;
  room.phase="discard";room.started=true;room.lastDiscard=null;room.notice=`${room.roundWind==="E"?"東":"南"}${room.roundNumber}局・${room.rules?.playerCount===3?"3人麻雀":"4人麻雀"}・${room.rules?.gameLength==="east"?"東風戦":"半荘戦"}で対局中。点数計算は一部簡易対応です。`;
  const firstDraw=room.wall.pop();room.players[room.turn].hand.push(firstDraw);room.players[room.turn].lastDrawnTile=firstDraw;
  emitState(room);
}
function rankedPlayers(room,base){
  const rows=room.players.map((p,i)=>({id:p.id,name:p.name,seat:p.seat,isCPU:p.isCPU,before:base[i],after:p.score,delta:p.score-base[i],dealer:p.seat===room.dealer}));
  [...rows].sort((a,b)=>b.after-a.after||a.seat-b.seat).forEach((r,i)=>r.rank=i+1);
  return rows;
}
function endHand(room,result,winner=null,loser=null,tile=null){
  room.phase="result";room.notice=result;let detail=null;
  const dealerPlayer=room.players.find(p=>p.seat===room.dealer);
  let dealerContinues=false;
  if(winner){dealerContinues=winner===dealerPlayer?.id;}
  else if(result.includes("流局")){
    const tenpai=room.players.filter(p=>isCompleteTenpai(p,room));
    dealerContinues=tenpai.some(p=>p.id===dealerPlayer?.id);
    if(tenpai.length>0&&tenpai.length<room.players.length){const pool=(room.players.length===3?2000:3000),gain=Math.floor(pool/tenpai.length),loss=Math.floor(pool/(room.players.length-tenpai.length));room.players.forEach(p=>{if(tenpai.includes(p))p.score+=gain;else p.score-=loss;});}
  }
  room.dealerContinues=dealerContinues;
  const honbaBonus=room.honba||0; // 本場の加算は更新前の本場数で計算する
  room.honba=dealerContinues?(room.honba||0)+1:0;
  if(winner){
    const w=room.players.find(p=>p.id===winner);
    if(w){const winningHand=tile?[...w.hand,tile]:w.hand;const oldWinningTile=w._winningTile;w._winningTile=tile||winningHand[winningHand.length-1]||null;const estimate=estimatePoints(winningHand,w,room,!loser);w._winningTile=oldWinningTile;const value=estimate.points;
      const winRecord={winnerId:w.id,winnerName:w.name,points:value,han:estimate.han,fu:estimate.fu,yaku:[...estimate.yaku],yakumanUnits:estimate.yakumanUnits||0,roundWind:room.roundWind,roundNumber:room.roundNumber,tsumo:!loser};
      if(!room.highestWin||winRecord.points>room.highestWin.points) room.highestWin=winRecord;
      {const fc=t=>({...t,face:tileName(t)});const tsumoTile=loser?null:w.lastDrawnTile;detail={winnerId:w.id,loserId:loser||null,tsumo:!loser,yaku:estimate.yaku,yakuList:estimate.yakuList,han:estimate.han,fu:estimate.fu,dora:estimate.dora,aka:estimate.aka,yakumanUnits:estimate.yakumanUnits,open:(w.melds||[]).length>0,hand:w.hand.filter(t=>t!==tsumoTile).map(fc),winTile:(tile||tsumoTile)?fc(tile||tsumoTile):null,melds:(w.melds||[]).map(m=>({type:m.type,tiles:m.tiles.map(fc)})),nuki:(w.nuki||[]).map(fc),doraInd:(room.dora||[]).map(fc),uraInd:w.riichi?(room.uraDora||[]).slice(0,(room.dora||[]).length).map(fc):[]};}
      const round100=n=>Math.ceil(n/100)*100; const dealerWin=w.seat===room.dealer;
      if(loser){const l=room.players.find(p=>p.id===loser);if(l){const pay=round100(estimate.basePoints*(dealerWin?6:4))+honbaBonus*300;l.score-=pay;w.score+=pay;}}
      else {for(const o of room.players.filter(p=>p.id!==winner)){let pay;if(dealerWin)pay=round100(estimate.basePoints*2);else pay=o.seat===room.dealer?round100(estimate.basePoints*2):round100(estimate.basePoints);pay+=honbaBonus*100;o.score-=pay;w.score+=pay;}}
      w.score+=room.kyotaku||0;room.kyotaku=0; // リーチ棒（供託）は和了者が受け取る
      message(room,"システム",`成立役：${estimate.yaku.join("・")}（${estimate.yakumanUnits?`役満${estimate.yakumanUnits>1?`×${estimate.yakumanUnits}`:""}`:`${estimate.han}翻・${estimate.fu}符`}／ドラ${estimate.dora}・赤ドラ${estimate.aka}）`,true);
    }
    message(room,"システム",`${w?.name||"プレイヤー"}の${loser?"ロン":"ツモ"}！ ${tile?tileName(tile):""}`,true);
  } else message(room,"システム",result,true);
  const negativeScore=room.players.some(p=>p.score<0);
  const lastRound=room.rules?.gameLength==="east" ? room.roundWind==="E"&&room.roundNumber>=4 : room.roundWind==="S"&&room.roundNumber>=2;
  const final=negativeScore||lastRound;
  const finalRows=rankedPlayers(room,room.players.map(p=>p.score));
  if(final){room.phase="finished";room.started=false;room.notice=negativeScore?"持ち点がマイナスになったため対局終了":"規定の最終局が終了しました";}
  emitState(room);
  io.to(room.code).emit("game:result",{final,title:final?(negativeScore?"持ち点マイナス・対局終了":"最終結果"):result,detail,honba:room.honba,roundWind:room.roundWind,roundNumber:room.roundNumber,players:rankedPlayers(room,room.handStartScores||room.players.map(()=>room.rules?.startingScore||25000)),highestWin:room.highestWin||null,finishReason:negativeScore?"持ち点がマイナス":lastRound?"規定の最終局終了":null});
  room.started=false;
  setTimeout(()=>{if(rooms.has(room.code)&&room.players.length>=2){room.notice="次局を開始できます。";emitState(room);}},2500);
}
function nextTurn(room){
  if(!room.started)return;
  room.turn=(room.turn+1)%room.players.length;
  const p=room.players[room.turn]; if(!p){endHand(room,"流局");return;}
  setDraw(room,p);
  if(p.isCPU)cpuPlay(room,true);
}
function cpuPlay(room,alreadyDrew=false){
  if(!room.started)return;
  const p=room.players[room.turn]; if(!p)return;
  setTimeout(()=>{
    if(!room.started||room.players[room.turn]?.id!==p.id||room.phase!=="discard")return;
    if(canWin(p,null,true,room)){endHand(room,"ツモ",p.id,null,null);return;}
    if(!alreadyDrew){if(!room.wall.length){endHand(room,"流局");return;}const drawn=room.wall.pop();p.hand.push(drawn);p.lastDrawnTile=drawn;}
    if(room.rules?.playerCount===3&&p.hand.some(t=>t.kind==="honor"&&t.code==="N")&&(!p.riichi||(p.lastDrawnTile?.kind==="honor"&&p.lastDrawnTile.code==="N"))){extractNorth(room,p,true);return;}
    let riichiIndex=-1;
    if(!p.riichi&&p.melds.length===0&&p.score>=1000&&room.wall.length>4){
      for(let i=0;i<p.hand.length;i++)if(canRiichiDiscard(p,i,room)){riichiIndex=i;break;}
    }
    let idx=riichiIndex>=0?riichiIndex:(p.riichi?p.hand.indexOf(p.lastDrawnTile):Math.floor(Math.random()*p.hand.length));if(idx<0)idx=p.hand.length-1;
    discard(room,p,idx,riichiIndex>=0);
  },500);
}
function resolveNoCall(room){
  if(!room.started||room.phase!=="response")return;
  room.pendingResponses=[];room.cpuResponses=[];room.phase="discard";
  nextTurn(room);
}
function respondCall(room,p,type){
  if(!room.started||room.phase!=="response")return false;
  if(type==="pass"){
    if(legalCalls(room,p).includes("ron")){if(p.riichi)p.riichiFuriten=true;else p.temporaryFuriten=true;}
    room.pendingResponses=(room.pendingResponses||[]).filter(id=>id!==p.id);
    room.cpuResponses=(room.cpuResponses||[]).filter(id=>id!==p.id);
    if(!(room.pendingResponses||[]).length&&!(room.cpuResponses||[]).length)resolveNoCall(room);else emitState(room);
    return true;
  }
  if(!legalCalls(room,p).includes(type))return false;
  if(type==="ron"){const tile=room.lastDiscard.tile;endHand(room,"ロン",p.id,room.lastDiscard.playerId,tile);return true;}
  room.pendingResponses=[];room.cpuResponses=[];
  const ok=doCall(room,p,type);if(ok){room.responseToken=(room.responseToken||0)+1;}
  return ok;
}
function doCall(room,p,type){
  if(!room.started||room.phase!=="response"||!legalCalls(room,p).includes(type))return false;
  const discarder=room.players.find(x=>x.id===room.lastDiscard.playerId);if(!discarder)return false;
  const tile=room.lastDiscard.tile,k=tileKey(tile),taken=[];
  for(let i=p.hand.length-1;i>=0&&taken.length<(type==="pon"?2:type==="kan"?3:0);i--){if(tileKey(p.hand[i])===k)taken.push(p.hand.splice(i,1)[0]);}
  if(type==="chi"){
    // Player selects a valid sequence automatically from the hand.
    let seq=null;
    for(let n=Math.max(1,tile.n-2);n<=Math.min(7,tile.n)&&!seq;n++){
      const nums=[n,n+1,n+2];if(!nums.includes(tile.n))continue;
      const need=nums.filter(x=>x!==tile.n);const indices=[];
      for(const num of need){const ix=p.hand.findIndex(t=>t.kind==="num"&&t.suit===tile.suit&&t.n===num);if(ix<0){indices.length=0;break;}indices.push(ix);}
      if(indices.length===2)seq=indices;
    }
    if(!seq)return false;
    for(const ix of seq.sort((a,b)=>b-a))taken.push(p.hand.splice(ix,1)[0]);
  }
  const meldTiles=[...taken,tile];p.melds.push({type,tiles:meldTiles});room.firstTurn=false;room.noCalls=false;room.players.forEach(x=>x.ippatsu=false);
  const last=discarder.discards[discarder.discards.length-1];if(last)last.called=true;
  room.turn=p.seat;room.phase="discard";room.lastDiscard=null;room.notice=`${p.name}が${type==="pon"?"ポン":type==="chi"?"チー":"カン"}しました。手牌を1枚捨ててください。`;
  if(type==="kan"){
    room.kanCount=(room.kanCount||0)+1;
    if(room.kanCount<=4 && room.wall.length>=2){room.dora.push(room.wall.pop());room.uraDora.push(room.wall.pop());}
    if(room.wall.length){const drawn=room.wall.pop();p.hand.push(drawn);p.lastDrawnTile=drawn;p.rinshan=true;}
    else {emitState(room);endHand(room,"流局");return true;}
  }
  message(room,p.name,`${type==="pon"?"ポン":type==="chi"?"チー":"カン"}！`);emitState(room);return true;
}
function performKan(room,p,type,key){
  if(!room.started||room.phase!=="discard"||room.players[room.turn]?.id!==p.id||p.riichi||room.wall.length<2)return false;
  if(riichiAvailable(p,room)&&!p.riichiChoiceMade)return false;
  let meld=null;
  if(type==="ankan"){
    const k=String(key||"");const matches=p.hand.filter(t=>tileKey(t)===k);
    if(matches.length<4)return false;
    const tiles=[];for(let i=p.hand.length-1;i>=0&&tiles.length<4;i--){if(tileKey(p.hand[i])===k)tiles.push(p.hand.splice(i,1)[0]);}
    meld={type:"ankan",tiles,concealed:true};p.melds.push(meld);
  }else if(type==="kakan"){
    const ix=p.melds.findIndex(m=>m.type==="pon"&&tileKey(m.tiles[0])===String(key||""));
    if(ix<0)return false;
    const hi=p.hand.findIndex(t=>tileKey(t)===String(key||""));if(hi<0)return false;
    const extra=p.hand.splice(hi,1)[0];p.melds[ix]={...p.melds[ix],type:"kakan",tiles:[...p.melds[ix].tiles,extra],addedTile:extra};meld=p.melds[ix];
  }else return false;
  room.kanCount=(room.kanCount||0)+1;
  if(room.kanCount<=4){room.dora.push(room.wall.pop());if(room.wall.length)room.uraDora.push(room.wall.pop());}
  p.ippatsu=false;room.firstTurn=false;room.noCalls=false;
  if(!room.wall.length){emitState(room);endHand(room,"流局（槓後に補充牌なし）");return true;}
  const drawn=room.wall.pop();p.hand.push(drawn);p.lastDrawnTile=drawn;p.rinshan=true;room.notice=`${p.name}が${type==="ankan"?"暗槓":"加槓"}しました。補充牌を引きました。`;
  message(room,p.name,`${type==="ankan"?"暗槓":"加槓"}！`,true);emitState(room);return true;
}
function createRoom(name, playerName, socket, dataRules){
  const code=crypto.randomBytes(3).toString("hex").toUpperCase();
  const raw=dataRules; const rules={playerCount:raw?.playerCount===3?3:4,gameLength:raw?.gameLength==="east"?"east":"south",startingScore:[25000,30000,35000].includes(Number(raw?.startingScore))?Number(raw.startingScore):25000}; const room={code,name:(name||"友達の部屋").slice(0,24),hostId:socket.id,players:[],rules,started:false,wall:[],dora:[],turn:0,dealer:0,roundWind:"E",roundNumber:1,honba:0,phase:"lobby",lastDiscard:null,pendingResponses:[],cpuResponses:[],uraDora:[],notice:"友達を招待するか、CPUを追加してください。"};
  rooms.set(code,room);
  room.players.push(newPlayer(socket.id,playerName,0,false,rules.startingScore));socket.join(code);socket.data.roomCode=code;
  socket.emit("room:created",{code});broadcastRoom(room);
}
function extractNorth(room,p,fromCPU=false){
  if(!room.started||room.rules?.playerCount!==3||room.phase!=="discard"||room.players[room.turn]?.id!==p.id)return false;
  if(riichiAvailable(p,room)&&!p.riichiChoiceMade)return false;
  const index=p.hand.findIndex(t=>t.kind==="honor"&&t.code==="N");
  if(index<0)return false;
  if(p.riichi&&!(p.lastDrawnTile?.kind==="honor"&&p.lastDrawnTile.code==="N"))return false;
  const north=p.hand.splice(index,1)[0];
  p.nuki=p.nuki||[];p.nuki.push(north);p.lastDrawnTile=null;
  room.firstTurn=false;room.noCalls=false;p.ippatsu=false;
  if(!room.wall.length){emitState(room);endHand(room,"荒牌流局（北抜き後に補充牌なし）");return true;}
  const replacement=room.wall.pop();p.hand.push(replacement);p.lastDrawnTile=replacement;p.rinshan=true;
  room.notice=`${p.name}が北抜きしました。補充牌を引きました。`;
  message(room,p.name,"北抜き！ 北は抜きドラとして加算されます。",true);
  emitState(room);
  if(fromCPU)setTimeout(()=>cpuPlay(room,true),350);
  return true;
}
function newPlayer(id,name,seat,isCPU,startingScore=25000){return {id,name:(name||"プレイヤー").slice(0,12),seat,score:startingScore,ready:false,connected:!isCPU,isCPU,hand:[],discards:[],melds:[],nuki:[],lastDrawnTile:null,riichi:false,riichiPending:false,riichiWaits:[],riichiChoiceMade:false,furiten:false,temporaryFuriten:false,riichiFuriten:false,ippatsu:false};}
function leave(socket){
  const code=socket.data.roomCode,room=rooms.get(code);if(!room)return;
  room.players=room.players.filter(p=>p.id!==socket.id);socket.leave(code);delete socket.data.roomCode;
  if(!room.players.length)rooms.delete(code);else{if(room.hostId===socket.id)room.hostId=room.players.find(p=>!p.isCPU)?.id||room.players[0].id;room.players.forEach((p,i)=>p.seat=i);if(room.started){room.started=false;room.phase="lobby";message(room,"システム","プレイヤーが退出したため対局を停止しました。",true);}broadcastRoom(room);}
}
io.on("connection",socket=>{
  socket.on("room:create",data=>createRoom(data?.name,data?.playerName,socket,data?.rules));
  socket.on("room:join",data=>{
    const code=String(data?.code||"").trim().toUpperCase(),room=rooms.get(code);
    if(!room)return socket.emit("app:error","ルームが見つかりません。部屋番号を確認してください。");
    if(room.started||room.players.length>=(room.rules?.playerCount||4))return socket.emit("app:error","このルームには参加できません（対局中または満員）。");
    room.players.push(newPlayer(socket.id,data?.playerName,room.players.length,false,room.rules?.startingScore||25000));socket.join(code);socket.data.roomCode=code;broadcastRoom(room);
  });
  socket.on("room:addCPU",()=>{
    const room=rooms.get(socket.data.roomCode);if(!room)return;
    if(socket.id!==room.hostId)return socket.emit("app:error","CPUを追加できるのは作成者です。");
    if(room.started)return socket.emit("app:error","対局中はCPUを追加できません。");
    if(room.players.length>=(room.rules?.playerCount||4))return socket.emit("app:error",`卓は${room.rules?.playerCount||4}人で満員です。`);
    const names=["CPU 朱雀","CPU 青龍","CPU 白虎","CPU 玄武"];
    room.players.push(newPlayer("cpu_"+crypto.randomBytes(4).toString("hex"),names[room.players.length-1]||"CPU",room.players.length,true,room.rules?.startingScore||25000));broadcastRoom(room);
  });
  socket.on("room:removeCPU",()=>{
    const room=rooms.get(socket.data.roomCode);if(!room||socket.id!==room.hostId)return;
    const i=room.players.findIndex(p=>p.isCPU);if(i>=0){room.players.splice(i,1);room.players.forEach((p,j)=>p.seat=j);broadcastRoom(room);}
  });
  socket.on("room:start",()=>{
    const room=rooms.get(socket.data.roomCode);if(!room)return;
    if(socket.id!==room.hostId)return socket.emit("app:error","対局を開始できるのは作成者です。");
    if(room.players.length!==(room.rules?.playerCount||4))return socket.emit("app:error",`${room.rules?.playerCount||4}人そろえてください。友達を招待するかCPUを追加できます。`);
    room.players.forEach((p,i)=>{p.seat=i;p.score=room.rules?.startingScore||25000;});room.dealer=0;room.roundNumber=1;room.roundWind="E";room.honba=0;room.kyotaku=0;room.highestWin=null;beginHand(room);message(room,"システム","東1局、対局スタート！",true);
    if(room.players[room.turn].isCPU)cpuPlay(room,true);
  });
  socket.on("game:discard",data=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);if(p)discard(room,p,data?.index,false);});
  socket.on("game:riichi",data=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);if(!p)return;if(!discard(room,p,data?.index,true))socket.emit("app:error","リーチできません。門前で1000点以上あり、テンパイになる牌を捨てているか確認してください。");});
  socket.on("game:call",data=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);if(!p)return;if(!respondCall(room,p,String(data?.type||"")))socket.emit("app:error","その鳴きはできません。");});
  socket.on("game:riichiPass",()=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);if(!p||room.phase!=="discard"||room.players[room.turn]?.id!==p.id)return;p.riichiChoiceMade=true;emitState(room);});
  socket.on("game:pass",()=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);if(p&&!respondCall(room,p,"pass"))socket.emit("app:error","今はパスできません。");});
  socket.on("game:tsumo",()=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);if(p&&room.players[room.turn]?.id===p.id&&canWin(p,null,true,room))endHand(room,"ツモ",p.id,null,null);});
  socket.on("game:nuki",()=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);if(!p||!extractNorth(room,p,false))socket.emit("app:error","今は北抜きできません。");});
  socket.on("game:kan",data=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);if(!p||!performKan(room,p,String(data?.type||""),String(data?.key||"")))socket.emit("app:error","その槓はできません。");});
  socket.on("game:nextHand",()=>{
    const room=rooms.get(socket.data.roomCode);
    if(!room||socket.id!==room.hostId||room.started||room.phase!=="result")return;
    if(!room.dealerContinues){const nextNumber=(Number(room.roundNumber)||1)+1;
      const maxRound=room.rules?.gameLength==="east"?4:2;
      if(room.roundWind==="E"&&room.rules?.gameLength!=="east"&&nextNumber>4){room.roundNumber=1;room.roundWind="S";}
      else if(nextNumber>maxRound){room.phase="finished";room.started=false;room.notice="対局終了！ 最終持ち点を確認してください。";emitState(room);io.to(room.code).emit("game:result",{final:true,title:"最終結果",detail:null,players:rankedPlayers(room,room.players.map(p=>p.score)),highestWin:room.highestWin||null});return;}
      else room.roundNumber=nextNumber;
      room.dealer=(room.dealer+1)%room.players.length;}
    room.dealerContinues=false;beginHand(room);
    message(room,"システム",`${room.roundWind==="E"?"東":"南"}${room.roundNumber}局を開始します。`,true);
    if(room.players[room.turn]?.isCPU)cpuPlay(room,true);
  });
  socket.on("chat:send",text=>{const room=rooms.get(socket.data.roomCode);if(!room)return;const p=room.players.find(p=>p.id===socket.id);const msg=String(text||"").trim().slice(0,200);if(p&&msg)message(room,p.name,msg);});
  socket.on("room:leave",()=>leave(socket));
  socket.on("disconnect",()=>leave(socket));
});
server.listen(PORT,()=>console.log(`Riichi Mahjong running at http://localhost:${PORT}`));
