const H=require('./harness'),{mk,discard,newPlayer}=H;
const room={code:'T',started:true,phase:'discard',turn:0,dealer:0,roundWind:'E',roundNumber:1,honba:0,rules:{playerCount:4,gameLength:'south',startingScore:25000},
  players:[0,1,2,3].map(i=>newPlayer('p'+i,'P'+i,i,false,25000)),wall:mk('1m9m1s9s2m8m2s8s4p6p3m7m4s6s'),dora:[],uraDora:[],firstTurn:false,pendingResponses:[],cpuResponses:[],lastDiscard:null,kanCount:0};
// p0: 清一色の九蓮宝燈テンパイ形(13枚)+東(捨て牌)
room.players[0].hand=[...mk('1112345678999m'),...mk('1z')];
room.players[1].hand=mk('1z2z3z');room.players[2].hand=mk('4z5z6z');room.players[3].hand=mk('7z5z6z');
const [p0,p1,p2,p3]=room.players;let guard=0;
console.log('1) p0がリーチ宣言で打牌:',discard(room,p0,13,true),' ippatsu=',p0.ippatsu,' riichi=',p0.riichi);
for(const p of [p1,p2,p3]){ if(room.phase==='discard'&&room.players[room.turn]===p) discard(room,p,0,false) }
console.log('   phase=',room.phase,'turn=',room.players[room.turn].name);
console.log('2) 他家3人が1巡打牌した後（まだ自分は打牌していない）: p0.ippatsu=',p0.ippatsu,'（自分のツモ和了は一発になるので true が正しい）');
const before=p0.hand.length;
const okDiscard=discard(room,p0,0,false);
console.log('3) リーチ後、ツモ牌以外（手牌の1枚目）を切れた?:',okDiscard,'（false が正しい）');
const okDraw=discard(room,p0,p0.hand.indexOf(p0.lastDrawnTile),false);
console.log('4) リーチ後、ツモ牌を切れた?:',okDraw,'（true が正しい） / 自分の打牌後 p0.ippatsu=',p0.ippatsu,'（false が正しい）');
// ダブル立直
const r2={...room,players:[0,1,2,3].map(i=>newPlayer('q'+i,'Q'+i,i,false,25000)),phase:'discard',turn:0,started:true,wall:mk('1m9m1s9s2m8m2s8s'),dora:[],uraDora:[]};
r2.players[0].hand=[...mk('1112345678999m'),...mk('1z')];r2.players.slice(1).forEach(p=>p.hand=mk('1z2z3z'));
discard(r2,r2.players[0],13,true);console.log('5) 第一打でリーチ → ダブル立直フラグ=',r2.players[0].doubleRiichi,'（true が正しい）');
