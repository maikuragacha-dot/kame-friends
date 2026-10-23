const socket=io();const $=id=>document.getElementById(id);let room=null,game=null,toastTimer,lastResult=null,riichiSelectMode=false,previousGameState=null,animationTimer=null,riichiPromptDismissedKey='',riichiPromptKey='';
const colors=["#2877c9","#248d68","#9a5bc1","#d06a39"];
function toast(m){const e=$("toast");e.textContent=m;e.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove("show"),3500)}
function showActionAnimation(kind, subtitle=""){
 let layer=$("actionAnimation");if(!layer){layer=document.createElement("div");layer.id="actionAnimation";layer.className="action-animation hidden";layer.setAttribute("aria-live","polite");document.body.append(layer)}
 const names={pon:"ポン！",chi:"チー！",kan:"明槓！",ankan:"暗槓！",kakan:"加槓！",nuki:"北抜き！",ron:"ロン！",tsumo:"ツモ！",riichi:"立直！"};
 layer.replaceChildren();const burst=document.createElement("div");burst.className="action-burst action-"+kind;burst.textContent=names[kind]||kind;const sub=document.createElement("div");sub.className="action-subtitle";sub.textContent=subtitle||({pon:"PON",chi:"CHI",kan:"OPEN KAN",ankan:"CONCEALED KAN",kakan:"ADDED KAN",nuki:"NORTH EXTRACTION",ron:"RON",tsumo:"TSUMO",riichi:"REACH"}[kind]||"");layer.append(burst,sub);layer.classList.remove("hidden");layer.classList.remove("play");void layer.offsetWidth;layer.classList.add("play");clearTimeout(animationTimer);animationTimer=setTimeout(()=>layer.classList.add("hidden"),1900);
}
function playerName(){return $("playerName").value.trim().slice(0,12)||"プレイヤー"}
function show(id){["entry","lobby","tableScreen"].forEach(x=>$(x).classList.toggle("hidden",x!==id))}
socket.on("connect",()=>{$("connection").textContent="● サーバー接続済み";$("connection").style.color="#53d6a0"});
socket.on("disconnect",()=>{$("connection").textContent="● 接続が切れました";$("connection").style.color="#ff8b8b"});
socket.on("app:error",toast);
$("createBtn").onclick=()=>socket.emit("room:create",{name:$("roomName").value,playerName:playerName(),rules:{playerCount:Number($("playerMode").value),gameLength:$("gameLength").value,startingScore:Number($("startingScore").value)}});
$("joinBtn").onclick=()=>{if(!$("roomCode").value.trim())return toast("部屋番号を入力してください。");socket.emit("room:join",{code:$("roomCode").value,playerName:playerName()})};
socket.on("room:created",({code})=>{$("roomCode").value=code;toast("ルームを作成しました。部屋番号を友達に送ろう！")});
socket.on("room:update",r=>{
 room=r;$("roomTitle").textContent=r.name;const rules=r.rules||{playerCount:4,gameLength:"south",startingScore:25000};$("roomRules").textContent=`ルール：${rules.playerCount}人麻雀 ／ ${rules.gameLength==="east"?"東風戦":"半荘戦"} ／ 開始 ${Number(rules.startingScore).toLocaleString()}点`;$("shownCode").textContent=r.code;$("playerCount").textContent=`${r.players.length}/${r.rules?.playerCount||4}人`;
 $("players").replaceChildren();
 r.players.forEach((p,i)=>{const d=document.createElement("div");d.className="player-card";const top=document.createElement("div");const av=document.createElement("span");av.className="avatar";av.style.background=colors[i%4];av.textContent=p.isCPU?"CPU":"●";const nm=document.createElement("span");nm.className="player-name";nm.textContent=p.name;top.append(av,nm);const sub=document.createElement("div");sub.className="player-score";sub.textContent=(p.id===r.hostId?"👑 作成者 · ":"")+(p.isCPU?"CPU":"参加中");d.append(top,sub);$("players").append(d)});
 const host=socket.id===r.hostId;$("startBtn").disabled=!host;$("addCPU").disabled=!host||r.started||r.players.length>=(r.rules?.playerCount||4);$("removeCPU").disabled=!host||r.started||!r.players.some(p=>p.isCPU);$("startBtn").textContent=host?"対局スタート":"作成者が開始します";
 show((r.started||(game&&game.phase==="result")||(game&&game.phase==="finished"))?"tableScreen":"lobby");$("gameRoomTitle").textContent=r.name;const lobbyNote=document.querySelector("#lobby .muted");if(lobbyNote)lobbyNote.textContent=`${r.rules?.playerCount||4}人そろえると対局を開始できます。CPU席も追加できます。`;
});
$("addCPU").onclick=()=>socket.emit("room:addCPU");$("removeCPU").onclick=()=>socket.emit("room:removeCPU");$("startBtn").onclick=()=>socket.emit("room:start");
$("leaveBtn").onclick=()=>{socket.emit("room:leave");room=null;game=null;show("entry")};
$("backLobby").onclick=()=>{if(confirm("対局を退出してルームから抜けますか？")){socket.emit("room:leave");room=null;game=null;show("entry")}};
$("copyCode").onclick=async()=>{try{await navigator.clipboard.writeText($("shownCode").textContent);toast("部屋番号をコピーしました！")}catch{toast("部屋番号："+$("shownCode").textContent)}};
function tileSortKey(t){if(t.kind==="honor"){const order={E:0,S:1,W:2,N:3,P:4,F:5,C:6};return 300+(order[t.code]??9)}const suitOrder={m:0,p:1,s:2};return (suitOrder[t.suit]??9)*10+(t.n||0)}
function setFace(el,t){const x=(t&&t.tile)||t||{};const code=x.code||(x.kind==="num"&&x.suit&&x.n?`${x.suit}${x.n}`:"");const red=!!x.red;el.style.backgroundImage=code?`url("/tiles/${code}${red?"r":""}.png")`:"none";el.style.backgroundSize="100% 100%";el.style.backgroundRepeat="no-repeat";el.style.backgroundPosition="center";el.textContent=code?"":(x.face||"?");el.setAttribute("aria-label",(red?"赤":"")+(x.face||code||"牌"));if(red)el.classList.add("aka")}
function addTile(container,tile,click,disabled=false){const b=document.createElement("button");b.className="tile";setFace(b,tile);b.title=click?"この牌を捨てる":tile.face;b.disabled=disabled;if(click)b.onclick=click;container.append(b)}

const WIND=["東","南","西","北"];
function meldGroup(m){const g=document.createElement("div");g.className="meld-group";m.tiles.forEach(t=>{const e=document.createElement("span");e.className="tile meld-tile";if(t.hidden)e.classList.add("tile-back");else setFace(e,t);g.append(e)});return g}
function renderTable(g,me){
 const n=g.players.length,my=g.players.findIndex(p=>p.id===socket.id),use=n===3?["bottom","right","left"]:["bottom","right","top","left"];
 ["top","left","right","bottom"].forEach(x=>["plate","seat","river","cs"].forEach(k=>{const e=$(k+"-"+x);e.replaceChildren();e.className=e.className.replace(/ ?(turn|dealer|riichi)\b/g,"");e.classList.toggle("hidden",!use.includes(x))}));
 g.players.forEach((p,i)=>{
  const x=use[(i-(my<0?0:my)+n)%n],turn=p.id===g.turnId,dealer=p.id===g.dealerId,wind=WIND[(p.seat-g.dealer+n)%n];
  const plate=$("plate-"+x);plate.classList.toggle("turn",turn);
  const av=document.createElement("span");av.className="avatar";av.style.background=colors[i%4];av.textContent=p.isCPU?"CPU":(p.name||"?")[0];
  const box=document.createElement("div");const nm=document.createElement("b");nm.textContent=p.name+(dealer?" 親":"");const sc=document.createElement("span");sc.textContent=p.score.toLocaleString()+(p.riichi?" ・リーチ":"");box.append(nm,sc);plate.append(av,box);
  const cs=$("cs-"+x);{const w=document.createElement("span");w.textContent=wind;const v=document.createElement("span");v.textContent=p.score.toLocaleString();cs.append(w,v);if(x==="top"||x==="bottom")cs.style.gap=".4cqw"}cs.classList.toggle("turn",turn);cs.classList.toggle("dealer",dealer);
  if(x!=="bottom"){const seat=$("seat-"+x),backs=document.createElement("div");backs.className="backs";for(let k=0;k<(p.handCount||0);k++){const b=document.createElement("span");b.className="tile tile-back";backs.append(b)}const ml=document.createElement("div");ml.className="seat-melds";(p.melds||[]).forEach(m=>ml.append(meldGroup(m)));(p.nuki||[]).forEach(t=>{const e=document.createElement("span");e.className="tile meld-tile";setFace(e,t);e.title="北抜き";ml.append(e)});seat.append(backs,ml)}
  const river=$("river-"+x);p.discards.forEach(d=>{const t=document.createElement("span");t.className="tile"+(d.riichi?" riichi-discard":"")+(d.called?" called":"");setFace(t,d);t.title=p.name+(d.riichi?"（リーチ）":"");river.append(t)});
 });
}
socket.on("game:state",g=>{
 const prev=previousGameState;
 if(prev&&prev.players&&g.players){for(const p of g.players){const old=prev.players.find(x=>x.id===p.id);if(!old)continue;
   const oldDiscards=old.discards||[],newDiscards=p.discards||[];
   if(newDiscards.length>oldDiscards.length&&newDiscards.slice(oldDiscards.length).some(d=>d.riichi))showActionAnimation("riichi",p.name+" がリーチ！");
   if((p.melds||[]).length>(old.melds||[]).length){const meld=p.melds[p.melds.length-1];if(meld&&["pon","chi","kan","ankan","kakan"].includes(meld.type))showActionAnimation(meld.type,p.name+" が槓・鳴きをしました");}
   else {const changed=(p.melds||[]).find((m,i)=>old.melds?.[i]&&m.type!==old.melds[i].type);if(changed&&changed.type==="kakan")showActionAnimation("kakan",p.name+" が加槓しました");}
   if((p.nuki||[]).length>(old.nuki||[]).length)showActionAnimation("nuki",p.name+" が北を抜きました");
 }}
 previousGameState=g;game=g;show("tableScreen");$("scoreSummary").textContent=`${g.playerCount||g.players.length}人麻雀 · ${g.gameLength==="east"?"東風戦":"半荘戦"} · 開始 ${Number(g.startingScore||25000).toLocaleString()}点 · 本場 ${g.honba||0}${g.playerCount===3?" · 北抜き対応":""}`;const round=(g.roundWind==="E"?"東":"南")+g.roundNumber+"局";$("roundLabel").textContent=round;$("centerRound").textContent=round;$("wallCount").textContent=g.wallCount;$("centerWall").textContent=`残り ${g.wallCount} 枚`;$("honbaLabel").textContent=`${g.honba||0}本場`;$("dora").replaceChildren();const dl=document.createElement("span");dl.textContent="ドラ表示牌：";$("dora").append(dl);(g.dora||[]).forEach(t=>{const e=document.createElement("span");e.className="tile dora-tile";setFace(e,t);e.title="ドラ表示牌 "+t.face;$("dora").append(e)});if(!(g.dora||[]).length)dl.textContent+="—";
 const me=g.players.find(p=>p.id===socket.id);const isTurn=g.turnId===socket.id;
 const choiceKey=(me?.hand||[]).map(t=>t.face||t.code).join(",")+"|"+String(g.turnId)+"|"+String(g.wallCount);
 if(choiceKey!==riichiPromptKey){riichiPromptKey=choiceKey;riichiPromptDismissedKey="";riichiSelectMode=false}
 $("riichiBtn").disabled=false;$("tsumoBtn").disabled=false;
 const riichiChoiceLocked=isTurn&&g.phase==="discard"&&g.canRiichi&&!me?.riichi&&!me?.riichiChoiceMade&&!riichiSelectMode;
 if(!isTurn||g.phase!=="discard"||!g.canRiichi||me?.riichi){riichiSelectMode=false;$("riichiBtn").classList.remove("selecting")}
 $("turnLabel").textContent=isTurn?"あなたの番です":(g.players.find(p=>p.id===g.turnId)?.name||"誰か")+"の番";$("myTurn").textContent=isTurn?"● あなたの番":"";
 $("hand").replaceChildren();const sortedHand=[...(me?.hand||[])].map((t,originalIndex)=>({...t,originalIndex}));const drawnIndex=isTurn&&g.phase==="discard"?me?.lastDrawnIndex:-1;sortedHand.sort((a,b)=>{if(a.originalIndex===drawnIndex)return 1;if(b.originalIndex===drawnIndex)return -1;return tileSortKey(a)-tileSortKey(b)});window.__sortedHand=sortedHand;sortedHand.forEach(t=>{const drawn=t.originalIndex===drawnIndex;addTile($("hand"),t,()=>{if(riichiSelectMode){riichiSelectMode=false;socket.emit("game:riichi",{index:t.originalIndex});toast("リーチを宣言しました。");$("riichiBtn").classList.remove("selecting");return}socket.emit("game:discard",{index:t.originalIndex})},riichiChoiceLocked||!isTurn||g.phase!=="discard"||(!!me&&me.riichi&&!drawn));if(drawn)$("hand").lastElementChild.classList.add("drawn-tile")});
 $("myMelds").replaceChildren();(me?.melds||[]).forEach(m=>{const group=document.createElement("div");group.className="meld-group";const label=document.createElement("small");label.textContent=({pon:"ポン",chi:"チー",kan:"明槓",ankan:"暗槓",kakan:"加槓"})[m.type]||m.type;group.append(label);m.tiles.forEach(t=>{const tile=document.createElement("span");tile.className="tile meld-tile";setFace(tile,t);group.append(tile)});$("myMelds").append(group)});
 
 // リーチ選択パネルはHTMLに常設し、毎回確実に表示状態を更新する。
 const riichiPanel=$("riichiChoicePanel");
 riichiPanel.replaceChildren();
 const needsRiichiChoice=isTurn&&g.phase==="discard"&&g.canRiichi&&!me?.riichi&&!me?.riichiChoiceMade&&!riichiSelectMode;
 if(needsRiichiChoice){
   riichiPanel.classList.remove("hidden");
   const msg=document.createElement("span");msg.className="riichi-choice-message";msg.textContent="リーチできます。宣言しますか？";riichiPanel.append(msg);
   const pass=document.createElement("button");pass.type="button";pass.className="secondary";pass.textContent="パス";pass.onclick=()=>{riichiPromptDismissedKey=choiceKey;riichiSelectMode=false;socket.emit("game:riichiPass");riichiPanel.classList.add("hidden");$("riichiBtn").classList.remove("selecting");toast("リーチせず、通常の打牌を選んでください。")};
   const yes=document.createElement("button");yes.type="button";yes.className="primary";yes.textContent="リーチ";yes.onclick=()=>{riichiSelectMode=true;riichiPromptDismissedKey=choiceKey;riichiPanel.classList.add("hidden");$("riichiBtn").classList.add("selecting");$("riichiBtn").textContent="捨てる牌を選択";renderHandEnableAfterRiichiChoice();toast("リーチ宣言：捨てる牌を選んでください。")};
   riichiPanel.append(pass,yes);
 }else riichiPanel.classList.add("hidden");
 function renderHandEnableAfterRiichiChoice(){document.querySelectorAll("#hand .tile").forEach(b=>{b.disabled=!isTurn||g.phase!=="discard"||(!!me&&me.riichi&&!b.classList.contains("drawn-tile"))})}
 let waitsPanel=$("riichiWaits");
 if(!waitsPanel){waitsPanel=document.createElement("div");waitsPanel.id="riichiWaits";waitsPanel.className="riichi-waits hidden";$("myMelds").insertAdjacentElement("afterend",waitsPanel)}
 waitsPanel.replaceChildren();
 const tenpai=me?.tenpaiInfo||me?.tenpai;
 if((me?.riichi||tenpai?.waits?.length)&&Array.isArray(me.waits)&&me.waits.length){
   waitsPanel.classList.remove("hidden");const label=document.createElement("strong");label.textContent="和了牌：";waitsPanel.append(label);
   me.waits.forEach(t=>{
     const tile=document.createElement("span");tile.className="tile riichi-wait-tile";
     const x=(t&&t.tile)||t||{};
     const code=x.code||(x.kind==="num"&&x.suit&&x.n?`${x.suit}${x.n}`:"");
     const face=x.face||(x.kind==="honor"?({E:"東",S:"南",W:"西",N:"北",P:"白",F:"發",C:"中"})[x.code]:x.n?`${x.n}${({m:"萬",p:"筒",s:"索"})[x.suit]||""}`:x.code)||"待ち牌";
     tile.title=face+"（この牌でアガリ）";tile.setAttribute("aria-label",tile.title);
     if(code){
       const img=document.createElement("img");img.className="wait-tile-image";img.alt=face;img.src=`/tiles/${code}${x.red?"r":""}.png`;
       img.onerror=()=>{tile.replaceChildren();tile.classList.add("wait-tile-text-fallback");tile.textContent=face};
       tile.append(img);
     }else{tile.classList.add("wait-tile-text-fallback");tile.textContent=face}
     waitsPanel.append(tile);
   });
   if(tenpai?.noYaku){const noYaku=document.createElement("strong");noYaku.className="tenpai-status no-yaku";noYaku.textContent="役なし";waitsPanel.append(noYaku)}
   if(tenpai?.furiten){const furiten=document.createElement("strong");furiten.className="tenpai-status furiten";furiten.textContent="フリテン";waitsPanel.append(furiten)}
   const note=document.createElement("small");note.textContent=me?.riichi?"表示された牌がリーチ後の待ち牌です":"テンパイ中の待ち牌です";waitsPanel.append(note);
 }else waitsPanel.classList.add("hidden");
 $("myNuki").replaceChildren();(me?.nuki||[]).forEach(t=>{const tile=document.createElement("span");tile.className="tile meld-tile";setFace(tile,t);tile.title="抜きドラ";$("myNuki").append(tile)});
 $("nukiBtn").classList.toggle("hidden",riichiChoiceLocked||!isTurn||!g.canNuki);$("nukiBtn").onclick=()=>socket.emit("game:nuki");
 $("riichiBtn").classList.toggle("hidden",riichiChoiceLocked||!isTurn||g.phase!=="discard"||!g.canRiichi);$("riichiBtn").textContent=riichiSelectMode?"捨てる牌を選択":"リーチ";$("tsumoBtn").classList.toggle("hidden",riichiChoiceLocked||!isTurn||g.phase!=="discard"||!g.canTsumo);
 const calls=g.canCalls||[];[["ponBtn","pon"],["chiBtn","chi"],["kanBtn","kan"],["ronBtn","ron"]].forEach(([id,type])=>{$(id).classList.toggle("hidden",riichiChoiceLocked||!calls.includes(type)||!g.pendingCall);$(id).onclick=()=>socket.emit("game:call",{type})});$("passBtn").classList.toggle("hidden",!g.canPass);$("passBtn").onclick=()=>socket.emit("game:pass");$("callPrompt").classList.toggle("hidden",!g.pendingCall);
 const tileKeyOf=t=>t.kind==="honor"?t.code:`${t.suit}${t.n}`;const handCounts={};(me?.hand||[]).forEach(t=>handCounts[tileKeyOf(t)]=(handCounts[tileKeyOf(t)]||0)+1);const ankanKey=Object.keys(handCounts).find(k=>handCounts[k]>=4);const kakanMeld=(me?.melds||[]).find(m=>m.type==="pon"&&(me?.hand||[]).some(t=>tileKeyOf(t)===tileKeyOf(m.tiles[0])));
 $("ankanBtn").classList.toggle("hidden",riichiChoiceLocked||!isTurn||!g.canAnkan||!ankanKey);$("ankanBtn").onclick=()=>socket.emit("game:kan",{type:"ankan",key:ankanKey});
 $("kakanBtn").classList.toggle("hidden",riichiChoiceLocked||!isTurn||!g.canKakan||!kakanMeld);$("kakanBtn").onclick=()=>socket.emit("game:kan",{type:"kakan",key:tileKeyOf(kakanMeld.tiles[0])});
 $("riichiBtn").onclick=()=>{if(riichiChoiceLocked)return toast("先に「パス」か「リーチ」を選んでください。");if(!g.canRiichi)return toast("現在の手牌ではリーチできません。");riichiSelectMode=!riichiSelectMode;$("riichiBtn").classList.toggle("selecting",riichiSelectMode);$("riichiBtn").textContent=riichiSelectMode?"捨てる牌を選択":"リーチ";toast(riichiSelectMode?"リーチ宣言：捨てる牌を手牌から選んでください。":"リーチ宣言をキャンセルしました。")};
 $("tsumoBtn").onclick=()=>socket.emit("game:tsumo");
 $("nextHandBtn").classList.toggle("hidden",g.phase!=="result"||!room||room.hostId!==socket.id);$("nextHandBtn").onclick=()=>socket.emit("game:nextHand");
 renderTable(g,me);
 $("scoreList").replaceChildren();g.players.forEach(p=>{const row=document.createElement("div");row.className="score-row";const n=document.createElement("span");n.textContent=p.name+(p.id===socket.id?"（あなた）":"")+(p.id===g.dealerId?" 👑親":" 子")+(p.riichi?" 🔴":"");const sc=document.createElement("span");sc.textContent=p.score.toLocaleString()+"点";row.append(n,sc);$("scoreList").append(row)});
 const inResult=g.phase==="result"||g.phase==="finished";if(!inResult){$("resultLayer").classList.add("hidden");lastResult=null}$("resultOpenBtn").classList.toggle("hidden",!inResult||!lastResult||!$("resultLayer").classList.contains("hidden"));
});
socket.on("chat:message",m=>{const d=document.createElement("div");d.className="message"+(m.system?" system":"");const b=document.createElement("b");b.textContent=m.name+"：";const s=document.createElement("span");s.textContent=m.text;d.append(b,s);$("messages").append(d);$("messages").scrollTop=$("messages").scrollHeight});
$("chatForm").onsubmit=e=>{e.preventDefault();const v=$("chatInput").value.trim();if(v){socket.emit("chat:send",v);$("chatInput").value=""}};

/* ===== 役一覧 ===== */
// [名前, 門前, 副露, 説明, 対応状況(false=このゲームでは未対応)]
const YAKU=[
["1翻",[["立直","1","−","門前でテンパイを宣言（1,000点供託）",1],["一発","1","−","立直後、1巡以内（鳴きなし）に和了",1],["門前清自摸和","1","−","門前でツモ和了",1],["断么九","1","1","2〜8の数牌だけで和了",1],["平和","1","−","順子のみ・雀頭が役牌でない・両面待ち",1],["一盃口","1","−","同じ順子を2組",1],["役牌","1","1","白・發・中、自風、場風の刻子（1組につき1翻。自風と場風が同じ牌なら2翻）",1],["嶺上開花","1","1","カンの補充牌で和了",1],["槍槓","1","1","他家の加槓した牌でロン",0],["海底摸月","1","1","最後の牌でツモ和了",1],["河底撈魚","1","1","最後の捨て牌でロン",1]]],
["2翻",[["ダブル立直","2","−","最初の一巡（誰も鳴いていない）で立直",1],["七対子","2","−","7組の対子（25符固定）",1],["対々和","2","2","刻子4組と雀頭",1],["三暗刻","2","2","暗刻を3組",1],["三色同刻","2","2","3色で同じ数字の刻子",1],["三槓子","2","2","カンを3組",1],["混老頭","2","2","么九牌（1・9・字牌）だけ",1],["小三元","2","2","三元牌のうち2つが刻子、1つが雀頭",1],["三色同順","2","1","3色で同じ数字の順子",1],["一気通貫","2","1","同色で123・456・789",1],["混全帯么九","2","1","全ての面子と雀頭に么九牌を含み字牌あり",1]]],
["3翻以上",[["混一色","3","2","1種類の数牌と字牌だけ",1],["純全帯么九","3","2","全ての面子と雀頭に1・9を含み字牌なし",1],["二盃口","3","−","一盃口を2組",1],["清一色","6","5","1種類の数牌だけ",1],["流し満貫","満貫","−","全ての捨て牌が么九牌で鳴かれずに流局",0]]],
["役満",[["天和","役満","−","親の配牌でそのまま和了",1],["地和","役満","−","子の第一ツモで和了",1],["国士無双","役満","−","13種の么九牌+そのうち1枚",1],["四暗刻","役満","−","暗刻を4組",1],["大三元","役満","役満","白・發・中すべて刻子",1],["小四喜","役満","役満","風牌の3つが刻子、1つが雀頭",1],["字一色","役満","役満","字牌だけ",1],["清老頭","役満","役満","1・9の数牌だけ",1],["緑一色","役満","役満","2・3・4・6・8索と發だけ",1],["九蓮宝燈","役満","−","1112345678999+同色の1枚",1],["四槓子","役満","役満","カンを4組",1]]],
["ダブル役満（このゲームでの扱い）",[["国士無双十三面待ち","W役満","−","13種すべて揃えた状態からの和了",1],["四暗刻単騎","W役満","−","雀頭待ちの四暗刻",1],["大四喜","W役満","W役満","風牌4種すべて刻子",1],["純正九蓮宝燈","W役満","−","9面待ちの九蓮宝燈",1]]]];
const YAKU_HAN={};YAKU.forEach(([,l])=>l.forEach(y=>YAKU_HAN[y[0]]=[y[1],y[2]]));
function buildYaku(){const b=$("yakuBody");b.replaceChildren();
 const note=document.createElement("p");note.className="yaku-note";note.textContent="「未対応」の役はこのゲームでは判定されません。ドラ・赤ドラ・裏ドラ・北抜きは役ではなく、翻数に加算されます。";b.append(note);
 YAKU.forEach(([g,list])=>{const h=document.createElement("h3");h.textContent=g;const t=document.createElement("table");t.className="yaku-table";
  const hd=t.insertRow();["役名","門前","副露","条件",""].forEach(x=>{const c=document.createElement("th");c.textContent=x;hd.append(c)});
  list.forEach(y=>{const r=t.insertRow();if(!y[4])r.className="yaku-off";[y[0],y[1],y[2],y[3],y[4]?"":"未対応"].forEach((x,i)=>{const c=r.insertCell();c.textContent=x;if(i===1||i===2)c.className="han"})});
  b.append(h,t)})}
buildYaku();
$("yakuBtn").onclick=()=>$("yakuModal").classList.remove("hidden");
$("yakuClose").onclick=()=>$("yakuModal").classList.add("hidden");
$("yakuModal").onclick=e=>{if(e.target.id==="yakuModal")$("yakuModal").classList.add("hidden")};
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("yakuModal").classList.add("hidden")});

/* ===== 局終了：点数移動の表示 ===== */
function animateNum(el,from,to,ms=900){const t0=performance.now();(function step(t){const k=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-k,3);el.textContent=Math.round(from+(to-from)*e).toLocaleString();if(k<1)requestAnimationFrame(step)})(t0)}
function tileSpan(t,cls="tile"){const e=document.createElement("span");e.className=cls;setFace(e,t);return e}
function renderResult(r){
 lastResult=r;const layer=$("resultLayer");layer.classList.remove("hidden");
 const n=r.players.length,my=Math.max(0,r.players.findIndex(p=>p.id===socket.id)),use=n===3?["bottom","right","left"]:["bottom","right","top","left"];
 ["top","left","right","bottom"].forEach(x=>{const e=$("rp-"+x);e.replaceChildren();e.className="rp rp-"+x+(use.includes(x)?"":" hidden")});
 const d=r.detail;
 r.players.forEach((p,i)=>{const x=use[(i-my+n)%n],el=$("rp-"+x);
  if(d&&p.id===d.winnerId)el.classList.add("win");if(d&&p.id===d.loserId)el.classList.add("lose");
  const rk=document.createElement("b");rk.className="rk";rk.innerHTML=p.rank+"<small>位</small>";
  const av=document.createElement("span");av.className="avatar";av.style.background=colors[i%4];av.textContent=p.isCPU?"CPU":(p.name||"?")[0];
  const info=document.createElement("div");info.className="rinfo";const nm=document.createElement("span");nm.className="rn";nm.textContent=p.name+(p.id===socket.id?"（あなた）":"")+(p.dealer&&!r.final?" 親":"");
  const sc=document.createElement("span");sc.className="rs";sc.textContent=p.before.toLocaleString();info.append(nm,sc);
  const dl=document.createElement("span");dl.className="rd "+(p.delta>0?"up":p.delta<0?"down":"zero");dl.textContent=(p.delta>0?"+":"")+p.delta.toLocaleString();
  el.append(rk,av,info,dl);
  if(d&&(p.id===d.winnerId||p.id===d.loserId)){const tag=document.createElement("span");tag.className="rtag";tag.textContent=p.id===d.winnerId?(d.tsumo?"ツモ":"ロン"):"放銃";el.append(tag)}
  setTimeout(()=>animateNum(sc,p.before,p.after),600);
 });
 const box=$("resultDetail");box.replaceChildren();
 const h=document.createElement("div");h.className="rd-title";h.textContent=r.final?"最終結果":(d?(d.tsumo?"ツモ和了":"ロン和了"):r.title);box.append(h);
 if(r.final){
   const ranking=document.createElement("div");ranking.className="final-ranking";
   const title=document.createElement("strong");title.textContent="最終点数ランキング";ranking.append(title);
   [...r.players].sort((a,b)=>b.after-a.after||a.seat-b.seat).forEach((p,i)=>{const row=document.createElement("div");row.className="final-rank-row";const rank=document.createElement("b");rank.textContent=`${i+1}位`;const name=document.createElement("span");name.textContent=p.name+(p.id===socket.id?"（あなた）":"");const score=document.createElement("strong");score.textContent=`${Number(p.after).toLocaleString()}点`;row.append(rank,name,score);ranking.append(row)});
   box.append(ranking);
   const best=r.highestWin;
   const award=document.createElement("div");award.className="highest-win";
   if(best){const t=document.createElement("strong");t.textContent="🏆 最高得点の和了";const n=document.createElement("div");n.textContent=`${best.winnerName} · ${Number(best.points).toLocaleString()}点`;const y=document.createElement("small");y.textContent=`${best.roundWind==="E"?"東":"南"}${best.roundNumber}局 · ${best.tsumo?"ツモ":"ロン"} · ${best.yakumanUnits?"役満":""}${best.han?` ${best.han}翻`:""}${best.fu?` ${best.fu}符`:""}${best.yaku?.length?" · "+best.yaku.join("・"):""}`;award.append(t,n,y)}else award.textContent="最高得点の和了：記録なし";
   box.append(award);
   if(r.finishReason){const reason=document.createElement("div");reason.className="finish-reason";reason.textContent="対局終了理由："+r.finishReason;box.append(reason)}
 }
 if(d){
  const w=r.players.find(p=>p.id===d.winnerId);const who=document.createElement("div");who.className="rd-who";who.textContent=(w?w.name:"")+(d.loserId?`（${r.players.find(p=>p.id===d.loserId)?.name||""}から）`:"");box.append(who);
  const hand=document.createElement("div");hand.className="rd-hand";
  [...d.hand].sort((a,b)=>tileSortKey(a)-tileSortKey(b)).forEach(t=>hand.append(tileSpan(t)));
  (d.melds||[]).forEach(m=>{const g=document.createElement("span");g.className="rd-meld";m.tiles.forEach(t=>g.append(tileSpan(t)));hand.append(g)});
  (d.nuki||[]).forEach(t=>hand.append(tileSpan(t)));
  if(d.winTile){const g=document.createElement("span");g.className="rd-win";g.append(tileSpan(d.winTile));hand.append(g)}
  box.append(hand);
  const ys=document.createElement("div");ys.className="rd-yaku";
  const add=(a,b)=>{const row=document.createElement("div");const x=document.createElement("span");x.textContent=a;const y=document.createElement("b");y.textContent=b;row.append(x,y);ys.append(row)};
  (d.yakuList||d.yaku.map(n=>({name:n,han:1}))).forEach(y=>add(y.name,y.yakuman?"役満"+(y.yakuman>1?"×"+y.yakuman:""):y.han+"翻"));
  if(d.dora)add("ドラ",d.dora+"翻");if(d.aka)add("赤ドラ",d.aka+"翻");box.append(ys);
  const sum=document.createElement("div");sum.className="rd-sum";sum.textContent=d.yakumanUnits?`役満${d.yakumanUnits>1?"×"+d.yakumanUnits:""}`:`${d.han}翻 ${d.fu}符`;box.append(sum);
  const ind=document.createElement("div");ind.className="rd-ind";const l1=document.createElement("span");l1.textContent="ドラ表示牌";ind.append(l1);d.doraInd.forEach(t=>ind.append(tileSpan(t)));
  if(d.uraInd&&d.uraInd.length){const l2=document.createElement("span");l2.textContent="裏ドラ";ind.append(l2);d.uraInd.forEach(t=>ind.append(tileSpan(t)))}box.append(ind);
 }else if(!r.final){const t=document.createElement("div");t.className="rd-who";t.textContent=r.title;box.append(t)}
 const host=room&&room.hostId===socket.id;$("resultNext").classList.toggle("hidden",r.final||!host);
 if(!r.final&&!host){const t=document.createElement("div");t.className="rd-wait";t.textContent="作成者が次局を開始します";box.append(t)}
}
socket.on("game:result",r=>{if(r.detail)showActionAnimation(r.detail.tsumo?"tsumo":"ron",r.detail.tsumo?"自摸和了":"栄和");renderResult(r)});
$("resultNext").onclick=()=>{socket.emit("game:nextHand")};
$("resultClose").onclick=()=>{$("resultLayer").classList.add("hidden");$("resultOpenBtn").classList.toggle("hidden",!lastResult)};
$("resultOpenBtn").onclick=()=>{if(lastResult){renderResult(lastResult);$("resultOpenBtn").classList.add("hidden")}};
