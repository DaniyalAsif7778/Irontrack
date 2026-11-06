import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const W = 1920, H = 1080;
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const txt = (x,y,s,size=24,color='#e8f1f0',weight=500,extra='') => `<text x="${x}" y="${y}" fill="${color}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${weight}" ${extra}>${esc(s)}</text>`;
const rect = (x,y,w,h,fill='#111b1c',r=18,stroke='none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const line = (x1,y1,x2,y2,color='#263638',width=2) => `<path d="M${x1} ${y1}H${x2}" stroke="${color}" stroke-width="${width}"/>`;
const shell = (title, subtitle, accent='#13c9a5') => `
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0a1113"/><stop offset="1" stop-color="#132122"/></linearGradient><linearGradient id="glow"><stop stop-color="${accent}" stop-opacity=".22"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="1650" cy="20" r="560" fill="url(#glow)"/>
${txt(90,87,'IRONTRACK',23,'#e9f4f1',750,'letter-spacing="4"')}${txt(1830,87,'PROJECT SHOWCASE',15,'#90a6a4',650,'text-anchor="end" letter-spacing="3"')}
${txt(90,194,title,55,'#f0f6f4',750)}${txt(92,240,subtitle,23,'#a2b4b1',450)}
`;
function browser(x=90,y=292,w=1740,h=716) {
 return `${rect(x,y,w,h,'#0d1516',28,'#334344')}<path d="M${x} ${y+58}h${w}" stroke="#334344"/><circle cx="${x+32}" cy="${y+29}" r="6" fill="#f06d66"/><circle cx="${x+54}" cy="${y+29}" r="6" fill="#efc05e"/><circle cx="${x+76}" cy="${y+29}" r="6" fill="#4fb78a"/>${rect(x+120,y+14,w-240,30,'#111e1f',9)}${txt(x+145,y+35,'irontrack · your training space',13,'#91a29f',500)}
 ${rect(x+1,y+59,210,h-60,'#111a1b',0)}${txt(x+30,y+108,'IRONTRACK',15,'#dce8e5',750,'letter-spacing="2"')}
 ${['Overview','Routine','Workout','Analytics','Weight','Wellness'].map((n,i)=>`${i===0?'': ''}${rect(x+16,y+135+i*57,178,42,i===activeNav?'#173c35':'transparent',10)}${txt(x+37,y+162+i*57,n,15,i===activeNav?'#73e2c1':'#91a3a0',i===activeNav?650:450)}`).join('')}
 ${txt(x+248,y+104,'Good morning, Alex',14,'#8ea19d',500)}${txt(x+248,y+144,'Dumbbell Tracker',25,'#f1f5f2',700)}`;
}
let activeNav=0;
const card = (x,y,w,h) => rect(x,y,w,h,'#111c1d',16,'#263638');
function screenOverview(){
 let s=shell('Your day, training, and progress in one place','A portfolio view of IronTrack’s everyday training dashboard');
 s+=browser();
 s+=card(360,460,990,208); s+=txt(395,504,'TODAY · TUESDAY',13,'#91a5a1',700,'letter-spacing="2"'); s+=txt(395,558,'Push day',31,'#f2f6f3',700); s+=txt(395,596,'Upper body strength · Tap to start',17,'#a0b2ad'); s+=rect(395,622,180,34,'#123b33',9); s+=txt(412,645,'START WORKOUT  →',12,'#6be0bd',750,'letter-spacing="1"');
 for(const [i,n,v] of [[0,'STREAK','4 days'],[1,'THIS WEEK','3 / 5'],[2,'SESSIONS','18']]){let x=1380+i*135; s+=card(x,460,124,116);s+=txt(x+17,494,n,10,'#8ea39e',700,'letter-spacing="1"');s+=txt(x+17,540,v,18,'#edf5f1',700)}
 s+=card(360,690,990,255); s+=txt(392,735,'This week',17,'#e7efec',650); const days=['MON','TUE','WED','THU','FRI','SAT','SUN'], acts=['P','P','·','P','·','R','·']; days.forEach((d,i)=>{const x=400+i*128;s+=rect(x,780,96,104,i===1?'#14372f':'#172223',12);s+=txt(x+48,809,d,11,'#92a5a0',650,'text-anchor="middle"');s+=txt(x+48,859,acts[i],25,i===1?'#65dbb9':'#bac8c4',700,'text-anchor="middle"')});
 s+=card(1380,604,410,341); s+=txt(1415,650,'Today’s routine',17,'#e7efec',650); s+=txt(1415,697,'2 of 5 tasks complete',15,'#a2b4af'); ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach((d,i)=>{s+=line(1415,735+i*40,1755,735+i*40,'#263638',1);s+=txt(1415,763+i*40,d,14,i<2?'#6ddbb9':'#c1ceca',550);s+=txt(1755,763+i*40,i<2?'✓':'·',14,i<2?'#6ddbb9':'#667b77',700,'text-anchor="end"')});
 return s;
}
function screenRoutine(){
 let s=shell('Make space for the work that matters','Daily tasks organized around five prayer anchors');activeNav=1;s+=browser();
 const names=['Fajr','Dhuhr','Asr','Maghrib','Isha'], tasks=[['Morning walk','Read for 20 minutes'],['Focus session','Prepare lunch'],['Strength workout'],['Review the day'],['Wind down']];
 names.forEach((n,i)=>{const x=356+i*285;s+=card(x,460,255,442);s+=rect(x+20,482,37,37,i===1?'#1a6351':'#21312f',12);s+=txt(x+38,508,['✦','◷','◌','◐','☾'][i],18,'#72dfbd',650,'text-anchor="middle"');s+=txt(x+20,562,n,19,'#f0f5f3',700);s+=txt(x+20,590,['DAWN','MIDDAY','AFTERNOON','EVENING','NIGHT'][i],10,'#8fa49e',650,'letter-spacing="2"');tasks[i].forEach((t,j)=>{const yy=640+j*93;s+=rect(x+17,yy,221,73,'#172223',12);s+=rect(x+31,yy+24,21,21,j===0&&i<2?'#145947':'transparent',6,j===0&&i<2?'none':'#566b66');if(j===0&&i<2)s+=txt(x+42,yy+40,'✓',13,'#8af0d0',700,'text-anchor="middle"');s+=txt(x+66,yy+42,t,13,'#dbe5e1',550);s+=txt(x+31,yy+62,`${8+i}:00  ·  30 min`,10,'#8da09b',450)});});
 s+=txt(360,951,'Set a time block, finish the task, and keep the next part of the day in view.',15,'#9aafaa');return s;
}
function screenWorkout(){
 let s=shell('Focused sessions, built around your plan','Log each set and carry your last session forward');activeNav=2;s+=browser();
 s+=card(360,460,900,455);s+=txt(398,508,'TUESDAY · PUSH',13,'#74ddbb',700,'letter-spacing="2"');s+=txt(398,559,'Upper body strength',27,'#f2f6f3',700);s+=txt(398,600,'Session 04  ·  Dumbbells  ·  42 min',15,'#98aba6');
 const rows=[['Dumbbell floor press','3 sets × 10 reps'],['Standing shoulder press','3 sets × 8 reps'],['Lateral raise','3 sets × 12 reps'],['Overhead triceps extension','3 sets × 10 reps']];rows.forEach((r,i)=>{const yy=640+i*62;s+=line(398,yy,1216,yy);s+=txt(398,yy+31,`0${i+1}`,12,'#6bd9b6',700);s+=txt(445,yy+31,r[0],15,'#e7efec',550);s+=txt(1195,yy+31,r[1],13,'#9aaca8',450,'text-anchor="end"')});
 s+=card(1290,460,490,455);s+=txt(1330,511,'LIVE SESSION',12,'#91a59f',700,'letter-spacing="2"');s+=txt(1330,573,'Dumbbell floor press',22,'#f0f5f2',650);s+=txt(1330,619,'SET 2 OF 3',12,'#8ea39d',650,'letter-spacing="2"');s+=rect(1330,655,410,12,'#263635',6);s+=rect(1330,655,252,12,'#13c9a5',6);s+=txt(1330,720,'10 reps',32,'#f3f6f3',700);s+=txt(1330,761,'Rest timer · 00:45',14,'#a0b2ad');s+=rect(1330,810,180,47,'#13c9a5',11);s+=txt(1420,840,'LOG SET',13,'#07231c',800,'text-anchor="middle" letter-spacing="1"');return s;
}
function screenProgress(){
 let s=shell('See the shape of your progress','Training history and wellness signals, gathered over time','#5cb8f4');activeNav=3;s+=browser();
 s+=card(360,460,930,455);s+=txt(400,510,'TRAINING VOLUME',12,'#91a49f',700,'letter-spacing="2"');s+=txt(400,558,'Steady work, week by week',24,'#edf4f1',650);s+=txt(400,593,'Total lifted volume · last 8 weeks',14,'#98aaa5');
 const vals=[.37,.51,.44,.66,.58,.78,.71,.92], base=852;vals.forEach((v,i)=>{const x=440+i*98,h=210*v;s+=rect(x,base-h,48,h,i===7?'#13c9a5':'#206b59',8);s+=txt(x+24,888,`W${i+1}`,11,'#8da19b',500,'text-anchor="middle"')});s+=line(420,852,1210,852,'#31413f');
 s+=card(1320,460,460,210);s+=txt(1360,510,'BODY WEIGHT',12,'#91a49f',700,'letter-spacing="2"');s+=txt(1360,563,'72.4 kg',33,'#f0f5f2',750);s+=txt(1360,606,'Latest check-in · sample view',13,'#9baea8');s+=txt(1360,644,'↘  0.8 kg over 4 weeks',14,'#6edcba',600);
 s+=card(1320,700,460,215);s+=txt(1360,749,'WELLNESS CHECK-IN',12,'#91a49f',700,'letter-spacing="2"');s+=txt(1360,802,'How are you feeling?',18,'#edf4f1',650);s+=txt(1360,841,'Sleep · energy · mood',14,'#9baea8');s+=rect(1360,865,150,31,'#153b33',9);s+=txt(1373,886,'OPEN WELLNESS',10,'#71dfbd',700,'letter-spacing="1"');return s;
}
const scenes=[
 {name:'irontrack-main',headline:'Make room for a steadier routine.',sub:'Strength training, daily structure, and progress in one calm space.',screen:screenOverview()},
 {name:'irontrack-routine',headline:'A routine shaped around your day.',sub:'Plan tasks across five prayer anchors and keep the next step visible.',screen:screenRoutine()},
 {name:'irontrack-workout',headline:'Focused training, one set at a time.',sub:'Follow your plan, log the work, and continue at your own pace.',screen:screenWorkout()},
 {name:'irontrack-progress',headline:'Progress you can understand.',sub:'Review training, body weight, and wellness in one view.',screen:screenProgress()},
];
for(let i=0;i<scenes.length;i++){
 const a=scenes[i];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${shell(a.headline,a.sub)}${a.screen}</svg>`;
 fs.writeFileSync(path.join(out,`${a.name}.svg`),svg);
}
fs.writeFileSync(path.join(out,'narration.txt'),`Meet IronTrack: a personal training and daily routine app that brings strength, structure, and progress into one calm workspace.\n\nPlan your day around five prayer anchors. Keep tasks in clear blocks and follow through while keeping the next part of your day in view.\n\nBuild focused dumbbell sessions, record each set, and carry your last session forward when it is time to train again.\n\nThen review training, body weight, and wellness check-ins together. IronTrack helps you build strength and keep your rhythm.\n`);
console.log(`Wrote ${scenes.length} showcase SVGs to ${out}`);
