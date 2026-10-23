const fs=require('fs'),path=require('path');
let src=fs.readFileSync(require('./serverpath'),'utf8').replace(/server\.listen\(PORT[^\n]*\n?/,'');
const events=[];
const stub=n=>{if(n==='express'){const f=()=>({use(){}});f.static=()=>{};return f}if(n==='http')return{createServer:()=>({listen(){}})};if(n==='socket.io')return{Server:class{on(){}to(){return{emit(e,d){events.push([e,d])}}}}};return require(n)};
const api=new Function('require',src+';return {endHand,newPlayer}')(stub);
const Z='ESWNPFC';const mk=str=>{const out=[];let b=[];for(const ch of str.replace(/\s/g,'')){if(/\d/.test(ch))b.push(+ch);else{for(const n of b)out.push(ch==='z'?{kind:'honor',code:Z[n-1]}:{kind:'num',suit:ch,n,code:ch+n});b=[]}}return out};
function room(){const r={code:'T',started:true,phase:'discard',turn:0,dealer:0,roundWind:'E',roundNumber:1,honba:0,rules:{playerCount:4,gameLength:'south',startingScore:25000},players:[0,1,2,3].map(i=>api.newPlayer('p'+i,'P'+i,i,false,25000)),wall:[0,0,0],dora:[mk('1z')[0]],uraDora:[mk('2z')[0]],kanCount:0};r.handStartScores=[25000,25000,25000,25000];return r}
function show(title,r){const e=events.filter(x=>x[0]==='game:result').pop()[1];const d=e.detail;console.log(`■ ${title}`);console.log('  役:',d.yakuList.map(y=>y.name+(y.han?y.han+'翻':'役満')).join(' / '),`| ${d.han}翻 ${d.fu}符 ドラ${d.dora} 赤${d.aka}`);console.log('  増減:',e.players.map(p=>`${p.name}:${p.delta>0?'+':''}${p.delta}`).join('  '),' 合計',e.players.reduce((a,p)=>a+p.delta,0))}
// 1) 子のロン: 立直・平和・ドラなし 30符2翻...(門前ロン)
{const r=room(),w=r.players[1];w.hand=mk('23m456p789s234p99s');w.riichi=true;r.players[2].discards=[];events.length=0;const tile=mk('1m')[0];w._winningTile=tile;api.endHand(r,'ロン',w.id,r.players[2].id,tile);show('子のロン（立直・平和・両面）',r)}
// 2) 親のツモ: 門前ツモ・断么九・三暗刻
{const r=room(),w=r.players[0];w.hand=mk('222m333p444s555m66z');w.lastDrawnTile=w.hand[w.hand.length-1];events.length=0;api.endHand(r,'ツモ',w.id,null,null);show('親のツモ（門前ツモ・三暗刻 ほか）',r)}
// 3) 副露の役満: ポン白・發・中 + 雀頭
{const r=room(),w=r.players[2];w.melds=[{type:'pon',tiles:mk('555z')},{type:'pon',tiles:mk('666z')},{type:'pon',tiles:mk('777z')}];w.hand=mk('123m99p');w.lastDrawnTile=w.hand[2];events.length=0;api.endHand(r,'ツモ',w.id,null,null);show('大三元（副露）ツモ',r)}
