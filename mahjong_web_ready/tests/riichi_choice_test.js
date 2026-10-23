const H=require('./harness'),{mk,discard,newPlayer,riichiAvailable}=H;
const room={code:'R',started:true,phase:'discard',turn:0,dealer:0,roundWind:'E',roundNumber:1,honba:0,rules:{playerCount:4,gameLength:'south',startingScore:25000},players:[0,1,2,3].map(i=>newPlayer('r'+i,'R'+i,i,false,25000)),wall:mk('1m9m1s9s2m8m2s8s4p6p3m7m4s6s'),dora:[],uraDora:[],firstTurn:false,pendingResponses:[],cpuResponses:[],lastDiscard:null,kanCount:0,kyotaku:0};
const p=room.players[0];p.hand=[...mk('1112345678999m'),...mk('1z')];
let pass=0,fail=0;function check(name,ok){if(ok){pass++;console.log('PASS',name)}else{fail++;console.error('FAIL',name)}}
check('テンパイ中はパス／リーチ選択が必要',riichiAvailable(p,room)&&discard(room,p,13,false)===false);
p.riichiChoiceMade=true;
check('パス選択後は通常打牌できる',discard(room,p,13,false)===true);
console.log(`結果: 成功 ${pass} / 失敗 ${fail}`);process.exitCode=fail?1:0;
