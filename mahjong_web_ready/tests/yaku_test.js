const H=require('./harness'),{mk:mk0,detectYaku,canWin,calcFu,estimatePoints,isComplete}=H;
const KEY=t=>t.kind==='honor'?300+'ESWNPFC'.indexOf(t.code):'mps'.indexOf(t.suit)*10+t.n;
const mk=str=>mk0(str).sort((a,b)=>KEY(a)-KEY(b));
let bad=0,ok=0;const fails=[];
function mkRoom(o={}){return {dealer:o.dealer??0,roundWind:o.roundWind||'E',rules:{playerCount:4},players:[],dora:[],uraDora:[],firstTurn:!!o.firstTurn,noCalls:!!o.noCalls,wall:o.lastTile?[]:[0,0,0]}}
function mkPlayer(o={}){const p=H.newPlayer('p0','t',o.seat??0,false,25000);p.melds=(o.melds||[]).map(m=>({type:m.type||'chi',tiles:mk(m.t)}));p.riichi=!!o.riichi;p.ippatsu=!!o.ippatsu;p.doubleRiichi=!!o.doubleRiichi;p.rinshan=!!o.rinshan;return p}
// conc: 手牌（和了牌を除く）, win: 和了牌, tsumo: true ならツモ
function yakuOf(conc,win,o={}){const p=mkPlayer(o),room=mkRoom(o);const hand=[...mk(conc),...mk(win)];p.hand=o.tsumo?hand:mk(conc);const w=mk(win)[0];p._winningTile=w;
  const r=detectYaku(hand,p,room,!!o.tsumo);return {yaku:r,p,room,hand}}
function T(name,conc,win,o,expectHas=[],expectNot=[],extra){
  let r;try{r=yakuOf(conc,win,o)}catch(e){fails.push(`[例外] ${name}: ${e.message}`);bad++;return}
  const miss=expectHas.filter(y=>!r.yaku.includes(y)),extraY=expectNot.filter(y=>r.yaku.includes(y));
  let msg=null;if(miss.length)msg=`不足:${miss.join(',')}`;if(extraY.length)msg=(msg?msg+' / ':'')+`余分:${extraY.join(',')}`;
  if(extra){const e=extra(r);if(e)msg=(msg?msg+' / ':'')+e}
  if(msg){bad++;fails.push(`[NG] ${name}\n     実際の役: ${r.yaku.join('・')||'(なし)'}\n     → ${msg}`)}else ok++}

// ---- 平和（待ちの判定）----
T('平和: 辺張(12m待ち3m)は平和にならない','12m456m234p678s99p','3m',{},[],['平和']);
T('平和: 両面(23m待ち1m)は平和になる','23m456m234p678s99p','1m',{},['平和']);
T('平和: 両面(45m待ち3m)は平和になる','45m456p234p678s99p','3m',{},['平和']);
T('平和: 両面(78m待ち9m)は平和になる','78m456p234p678s99p','9m',{},['平和']);
T('平和: 両面(34m待ち5m)は平和になる','34m456p234p678s99p','5m',{},['平和']);
T('平和: 辺張(89m待ち7m)は平和にならない','89m456p234p678s99p','7m',{},[],['平和']);
T('平和: 非役牌の字牌の雀頭でも平和になる','34m456p234p678s22z','5m',{},['平和']);
T('平和: 役牌の雀頭は平和にならない','34m456p234p678s55z','5m',{},[],['平和']);
// ---- 翻数の重複・排他 ----
T('七対子と二盃口は同時に付かない','1122334455667m','7m',{},[],[],r=>r.yaku.includes('七対子')&&r.yaku.includes('二盃口')?'七対子と二盃口が両方付く':null);
T('二盃口に一盃口は付かない','112233m445566p7s','7s',{},[],[],r=>r.yaku.includes('一盃口')&&r.yaku.includes('二盃口')?'一盃口と二盃口が両方付く':null);
T('混老頭に混全帯么九は付かない','111m999m11p999p11z','1p',{},['混老頭'],['混全帯么九']);
T('混老頭は対々和と複合','111m999m11p999p11z','1p',{},['混老頭','対々和']);
// ---- 翻数計算 ----
function han(conc,win,o={}){const {p,room,hand}=yakuOf(conc,win,o);return estimatePoints(hand,p,room,!!o.tsumo)}
function H2(name,conc,win,o,expected){const e=han(conc,win,o);if(e.han!==expected){bad++;fails.push(`[NG] ${name}\n     役: ${e.yaku.join('・')}  → ${e.han}翻（期待 ${expected}翻）`)}else ok++}
H2('小三元: 小三元2+役牌2=4翻','12m456p555z666z77z','3m',{},4);
H2('役牌2種の刻子は2翻','123m456p99s555z66z','6z',{},2);
H2('連風牌(場風=自風)の刻子は2翻','123m456p99s234s11z','1z',{},2);
H2('非役牌(南家の西)の刻子は0翻','123m456p99s234s33z','3z',{seat:1},0);
// ---- 副露手の役 ----
T('副露: 対々和（ポン1+暗刻3）','222p333s444m9m','9m',{melds:[{type:'pon',t:'111m'}]},['対々和']);
T('副露: 三色同順(チー123m)','123p123s456p9m','9m',{melds:[{t:'123m'}]},['三色同順']);
T('副露: 混全帯么九の誤成立（チー345mが么九なし）','111p999p123s1z','1z',{melds:[{t:'345m'}]},[],['混全帯么九','純全帯么九']);
T('副露: 一気通貫(チー789m)','123m456m9p234s','9p',{melds:[{t:'789m'}]},['一気通貫']);
T('副露: 小三元(ポン白+ポン發)','123m456p7z','7z',{melds:[{type:'pon',t:'555z'},{type:'pon',t:'666z'}]},['小三元']);
T('副露: 三色同刻(ポン)','222p222s456m7z','7z',{melds:[{type:'pon',t:'222m'}]},['三色同刻']);
// ---- 三暗刻 ----
T('三暗刻: ロンで刻子が完成なら暗刻にならない','11m222p333s456m99p','1m',{},[],['三暗刻']);
T('三暗刻: ツモなら成立','11m222p333s456m99p','1m',{tsumo:true},['三暗刻']);
// ---- 役満 ----
const yk=(name,conc,win,o,has)=>T(name,conc,win,o,has);
yk('国士無双（単騎待ちでロン）','119m19p19s123456z','7z',{},['国士無双']);
yk('国士無双（十三面待ちで雀頭牌をロン）','19m19p19s1234567z','1m',{},['国士無双十三面待ち']);
yk('国士無双十三面待ち','19m19p19s1234567z','7z',{},['国士無双十三面待ち']);
yk('九蓮宝燈（純正でない形）','1113455678999m','2m',{tsumo:true},['九蓮宝燈']);
yk('純正九蓮宝燈','1112345678999m','5m',{tsumo:true},['純正九蓮宝燈']);
yk('緑一色','234s234s666s888s6z','6z',{},['緑一色']);
yk('大四喜','111z222z333z444z5m','5m',{},['大四喜']);
yk('小四喜','123m111z222z33z44z','3z',{},['小四喜']);
yk('四暗刻（ツモ）','11m222p333s444z55m','1m',{tsumo:true},['四暗刻']);
yk('四暗刻単騎','111m222p333s444z5m','5m',{},['四暗刻単騎']);
yk('清老頭','111m999m111p999p1s','1s',{tsumo:true},['清老頭']);
yk('字一色','111z222z333z555z7z','7z',{},['字一色']);
yk('天和','123m456p789s23m55z','4m',{tsumo:true,firstTurn:true},['天和']);
// ---- 和了判定そのもの（canWin） ----
function CW(name,conc,win,o,expected){const p=mkPlayer(o),room=mkRoom(o);p.hand=mk(conc);const w=mk(win)[0];let r;try{r=o.tsumo?(p.hand.push(w),canWin(p,null,true,room)):canWin(p,w,false,room)}catch(e){fails.push(`[例外] ${name}: ${e.message}`);bad++;return}
  if(r!==expected){bad++;fails.push(`[NG] ${name}\n     canWin=${r}（期待 ${expected}）`)}else ok++}
CW('国士無双はロンできる','119m19p19s123456z','7z',{},true);
CW('副露三色同順の手がロンできる','123p123s456p9m','9m',{melds:[{t:'123m'}]},true);
CW('副露混全帯誤成立でロンできてはいけない','111p999p123s1z','1z',{melds:[{t:'345m'}]},false);
CW('役なし(ドラのみ相当)の手はロンできない','123m456p789s234m5p','5p',{},false);
// ---- 符計算 ----
function FU(name,conc,win,o,expected){const {p,room,hand}=yakuOf(conc,win,o);p.riichi=true;const y=detectYaku(hand,p,room,!!o.tsumo);const f=calcFu(hand,p,room,!!o.tsumo,y);if(f!==expected){bad++;fails.push(`[NG] ${name}\n     符=${f}（期待 ${expected}）`)}else ok++}
FU('副露・順子のみのロンは30符','123p456p78s99m','9s',{melds:[{t:'123m'}]},30);
FU('嵌張待ちは+2符（門前ロン20+10+2=32→40符）','13m456p789s234p99m','2m',{},40);
FU('副露ポン（么九牌）の符加算（20+4=24→30符）','123p456p78s99m','9s',{melds:[{type:'pon',t:'999m'}]},30);
FU('単騎待ち+2符（20+10+2=32→40符）','123m456p789s234s9m','9m',{},40);

// ---- 追加: 修正した項目の確認 ----
T('ダブル立直','123m456p789s234p9s','9s',{riichi:true,doubleRiichi:true},['ダブル立直'],['立直']);
T('三色同順（門前）','123m123p123s456p9s','9s',{},['三色同順']);
T('三槓子','12m99p','3m',{melds:[{type:'kan',t:'1111s'},{type:'kan',t:'2222s'},{type:'kan',t:'3333s'}]},['三槓子']);
T('四槓子','9p','9p',{melds:[{type:'kan',t:'1111s'},{type:'kan',t:'2222s'},{type:'kan',t:'3333s'},{type:'kan',t:'4444s'}]},['四槓子']);
T('嶺上開花','123m456p789s234p9s','9s',{tsumo:true,rinshan:true},['嶺上開花']);
T('海底摸月','123m456p789s234p9s','9s',{tsumo:true,lastTile:true},['海底摸月']);
T('河底撈魚','123m456p789s234p9s','9s',{riichi:true,lastTile:true},['河底撈魚']);
T('地和','123m456p789s234p9s','9s',{tsumo:true,seat:1,noCalls:true},['地和']);
FU('大明槓（么九牌）の符（20+16=36→40符）','123p456p78s99m','9s',{melds:[{type:'kan',t:'1111m'}]},40);
FU('ロンで完成した刻子は明刻扱い（20+10+2=32→40符）','22m456p789s234p99s','2m',{},40);
console.log(`成功 ${ok} / 失敗 ${bad}\n`);fails.forEach(f=>console.log(f));
