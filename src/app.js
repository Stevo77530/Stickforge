const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

const SAMPLE_ESSAY = `What if the next electricity crisis is not caused by families using too much power, but by machines being allowed to buy the future first?

Data centers are becoming the new industrial cathedrals. They eat land, water, electricity, and political attention. Everyone talks about artificial intelligence as if it lives in the cloud, but the cloud is not magic. It is buildings, substations, cooling systems, transmission lines, concrete, tax deals, and utility bills.

The dangerous part is not that data centers need power. Industry has always needed power. The dangerous part is that homes may be asked to compete with machine infrastructure for the same grid, while ordinary people are told to conserve, adapt, and pay whatever scarcity price falls out of the machine.

If compute is going to become essential infrastructure, then households should not be treated like background noise. The public deal should be simple: machines pay, homes win, and the grid gets rebuilt outward from the places where compute lands.

AI may be inevitable. Tribute is not.`;

const MODES = {
  spark: { label: 'Spark', seconds: 210, scenes: 7, goal: 'one sharp idea' },
  standard: { label: 'Standard', seconds: 480, scenes: 12, goal: 'main YouTube explainer' },
  deep: { label: 'Deep', seconds: 780, scenes: 18, goal: 'longer essay adaptation' }
};

let storyboard = null;
let activeTab = 'storyboard';
let playing = false;
let startedAt = 0;
let pausedAt = 0;
let raf = null;
let voices = [];
let recorder = null;
let chunks = [];

const ease = (x) => x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x+2, 2)/2;
const pulse = (x) => 0.5 + 0.5 * Math.sin(x);
const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
const lerp = (a,b,t) => a + (b-a) * clamp(t,0,1);
const selected = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
const fmt = (seconds) => {
  seconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
};
const slug = (s) => (s || 'stickforge').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'stickforge';
function setStatus(s){ $('status').textContent = s; }

function splitEssay(text) {
  return text.replace(/\r/g,'').split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/).map(x=>x.trim()).filter(Boolean);
}
function titleFrom(text) {
  const first = text.split(/\n|[.!?]/).find(x=>x.trim()) || 'StickForge Project';
  return first.trim().slice(0, 90);
}
function keywordLine(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w=>w.length>4);
  const stop = new Set(['there','their','about','would','could','should','which','while','because','being','become','becoming','ordinary','people','little','simple','every','sometimes']);
  const counts = {};
  words.forEach(w => { if(!stop.has(w)) counts[w] = (counts[w] || 0) + 1; });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);
  return top.length ? top.map(w=>w[0].toUpperCase()+w.slice(1)).join(' • ') : text.slice(0,60);
}

function visualTypeFor(i, total, paragraph) {
  const p = paragraph.toLowerCase();
  if (i === 0) return 'hook';
  if (i === total - 1) return 'closing';
  if (/monster|goblin|creature|feared|walls|locks|guard|pantry|dirt/.test(p)) return ['goblin','sneak','heist','underground'][i % 4];
  if (/machine|ai|data|cloud|compute|system|browser|app/.test(p)) return ['machine','network','console'][i % 3];
  if (/home|house|family|electric|grid|power|utility/.test(p)) return 'house';
  if (/king|law|vote|council|public|politic/.test(p)) return 'council';
  return ['choice','map','conflict','idea'][i % 4];
}

function makeStoryboard() {
  const text = $('essayInput').value.trim() || SAMPLE_ESSAY;
  const modeKey = selected('mode') || 'standard';
  const mode = MODES[modeKey];
  const parts = splitEssay(text);
  const scenes = [];
  for (let i=0; i<mode.scenes; i++) {
    const p = parts[i % parts.length] || text;
    const type = visualTypeFor(i, mode.scenes, p);
    const duration = Math.round(mode.seconds / mode.scenes);
    scenes.push({
      id: `scene_${String(i+1).padStart(2,'0')}`,
      index: i+1,
      title: i===0 ? 'Hook' : i===mode.scenes-1 ? 'Final Strike' : `Beat ${i+1}`,
      duration,
      narration: p.length > 260 ? p.slice(0,257) + '...' : p,
      onscreenText: i===0 ? (p.match(/[^.!?]+[.!?]?/)?.[0] || p).slice(0,70) : keywordLine(p),
      visual: { type, action: ['reveal','point','build','argue','collapse','transform','sneak','steal'][i % 8] },
      camera: ['slow_push','pan','wide','shake','zoom_out','drift'][i % 6],
      retentionBeat: i===0 ? 'Give the viewer a reason to care immediately.' : 'One idea, multiple visual changes, no swamp.'
    });
  }
  storyboard = {
    schema: 'stickforge.storyboard.v0.2',
    title: titleFrom(text),
    createdAt: new Date().toISOString(),
    mode: modeKey,
    modeGoal: mode.goal,
    tone: $('toneSelect').value,
    style: $('styleSelect').value,
    targetSeconds: mode.seconds,
    actualSeconds: scenes.reduce((a,s)=>a+s.duration,0),
    aspectRatio: '16:9',
    noShorts: true,
    motionPass: 'v0.2: sub-beats, moving props, camera motion, animated entrances',
    scenes
  };
  pausedAt = 0;
  renderOutput();
  drawFrame(0);
  setStatus(`Generated ${scenes.length} scenes with motion pass v0.2. ${mode.label} mode. No Shorts.`);
}

function totalSeconds(){ return storyboard ? storyboard.scenes.reduce((a,s)=>a+s.duration,0) : 0; }
function sceneAt(t){
  let acc=0;
  for (const s of storyboard.scenes){
    if(t < acc+s.duration) return {scene:s, local:t-acc, start:acc};
    acc += s.duration;
  }
  const last = storyboard.scenes.at(-1);
  return {scene:last, local:last.duration, start:acc-last.duration};
}

function applyBackground(style, time) {
  if(style==='paper') { ctx.fillStyle='#f4ead7'; ctx.fillRect(0,0,1280,720); ctx.strokeStyle='#d8c9ad'; }
  else if(style==='blueprint') { ctx.fillStyle='#07172b'; ctx.fillRect(0,0,1280,720); ctx.strokeStyle='#20466f'; }
  else { ctx.fillStyle='#05070b'; ctx.fillRect(0,0,1280,720); ctx.strokeStyle='#182031'; }
  ctx.lineWidth=1;
  const drift = (time * 12) % 80;
  for(let x=-80+drift;x<1360;x+=80){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,720); ctx.stroke(); }
  for(let y=-80+drift/2;y<800;y+=80){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1280,y); ctx.stroke(); }
}

function applyCamera(scene, p, time) {
  ctx.save();
  let tx = 0, ty = 0, scale = 1;
  if(scene.camera === 'slow_push') scale = 1 + p * 0.045;
  if(scene.camera === 'zoom_out') scale = 1.05 - p * 0.04;
  if(scene.camera === 'pan') tx = Math.sin(p * Math.PI * 2) * 25;
  if(scene.camera === 'drift') { tx = Math.sin(time * 0.8) * 18; ty = Math.cos(time * 0.55) * 10; }
  if(scene.camera === 'shake' && p > 0.38 && p < 0.72) { tx = Math.sin(time*26)*8; ty = Math.cos(time*31)*5; }
  ctx.translate(640,360); ctx.scale(scale,scale); ctx.translate(-640 + tx, -360 + ty);
}

function drawStick(x,y,scale=1,mood='neutral',phase=0, pose='idle'){
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.lineWidth=7; ctx.lineCap='round'; ctx.strokeStyle='#eef3ff'; ctx.fillStyle='#eef3ff';
  const bob = Math.sin(phase*2) * (pose === 'walk' ? 9 : 3);
  ctx.translate(0,bob);
  ctx.beginPath(); ctx.arc(0,-90,28,0,Math.PI*2); ctx.stroke();
  if(mood==='angry'){ ctx.beginPath(); ctx.moveTo(-13,-100); ctx.lineTo(-3,-94); ctx.moveTo(13,-100); ctx.lineTo(3,-94); ctx.stroke(); }
  if(mood==='confused'){ ctx.font='30px sans-serif'; ctx.fillText('?',22,-110); }
  if(mood==='goblin'){
    ctx.beginPath(); ctx.moveTo(-22,-108); ctx.lineTo(-44,-126); ctx.lineTo(-28,-95); ctx.moveTo(22,-108); ctx.lineTo(44,-126); ctx.lineTo(28,-95); ctx.stroke();
    ctx.fillStyle='#f1b84b'; ctx.font='22px sans-serif'; ctx.fillText('✦',-7,-82);
  }
  ctx.beginPath(); ctx.moveTo(0,-60); ctx.lineTo(0,25); ctx.stroke();
  const armSwing = pose === 'walk' ? Math.sin(phase*3) * 30 : Math.sin(phase) * 14;
  const armUp = pose === 'point' ? -45 : 0;
  ctx.beginPath();
  ctx.moveTo(0,-25); ctx.lineTo(-45,-5+armSwing);
  ctx.moveTo(0,-25); ctx.lineTo(45,armUp-5-armSwing);
  ctx.stroke();
  const legSwing = pose === 'walk' ? Math.sin(phase*3) * 28 : Math.sin(phase) * 10;
  ctx.beginPath(); ctx.moveTo(0,25); ctx.lineTo(-35,85-legSwing); ctx.moveTo(0,25); ctx.lineTo(35,85+legSwing); ctx.stroke();
  ctx.restore();
}

function drawGoblin(x,y,scale=1,phase=0,pose='sneak'){
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.lineWidth=6; ctx.lineCap='round'; ctx.strokeStyle='#b9ff9f'; ctx.fillStyle='#b9ff9f';
  const crouch = pose === 'sneak' ? 18 : 0;
  ctx.translate(0, Math.sin(phase*4)*4 + crouch);
  ctx.beginPath(); ctx.arc(0,-80,24,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18,-96); ctx.lineTo(-46,-118); ctx.lineTo(-25,-82); ctx.moveTo(18,-96); ctx.lineTo(46,-118); ctx.lineTo(25,-82); ctx.stroke();
  ctx.fillStyle='#f1b84b'; ctx.font='20px sans-serif'; ctx.fillText('•',-8,-78); ctx.fillText('•',8,-78);
  ctx.strokeStyle='#b9ff9f';
  ctx.beginPath(); ctx.moveTo(0,-55); ctx.lineTo(0,20); ctx.stroke();
  const s = Math.sin(phase*5)*22;
  ctx.beginPath(); ctx.moveTo(0,-25); ctx.lineTo(-42,0+s); ctx.moveTo(0,-25); ctx.lineTo(42,-10-s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,20); ctx.lineTo(-32,80-s); ctx.moveTo(0,20); ctx.lineTo(32,80+s); ctx.stroke();
  ctx.restore();
}

function drawMachine(x,y,w,h,label,phase,enter=1){
  ctx.save(); ctx.globalAlpha = clamp(enter,0,1); ctx.translate(x+w/2, y+h/2); ctx.scale(lerp(0.6,1,ease(enter)), lerp(0.6,1,ease(enter))); ctx.translate(-w/2,-h/2);
  ctx.strokeStyle='#f1b84b'; ctx.fillStyle='rgba(241,184,75,.08)'; ctx.lineWidth=6;
  ctx.fillRect(0,0,w,h); ctx.strokeRect(0,0,w,h);
  for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(w/2,h/2,32+i*22+Math.sin(phase+i)*5,0,Math.PI*2); ctx.stroke(); }
  ctx.fillStyle='#f1b84b'; ctx.font='bold 30px system-ui'; ctx.textAlign='center'; ctx.fillText(label,w/2,h+42);
  ctx.restore();
}

function drawHouse(x,y,phase,enter=1){
  ctx.save(); ctx.globalAlpha = clamp(enter,0,1); ctx.translate(x, y + (1-enter)*90); ctx.strokeStyle='#8fd3ff'; ctx.lineWidth=6;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(80,-70); ctx.lineTo(160,0); ctx.lineTo(160,120); ctx.lineTo(0,120); ctx.closePath(); ctx.stroke();
  ctx.fillStyle='#8fd3ff'; ctx.font='bold 28px system-ui'; ctx.textAlign='center'; ctx.fillText('$'+String(120+Math.floor(pulse(phase)*70)),80,165);
  ctx.restore();
}
function arrow(x1,y1,x2,y2,progress=1,color='#f1b84b'){
  progress = clamp(progress,0,1);
  const xe = lerp(x1,x2,progress), ye = lerp(y1,y2,progress);
  ctx.save(); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(xe,ye); ctx.stroke();
  if(progress > 0.9){ const a=Math.atan2(y2-y1,x2-x1); ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2-18*Math.cos(a-.4),y2-18*Math.sin(a-.4)); ctx.lineTo(x2-18*Math.cos(a+.4),y2-18*Math.sin(a+.4)); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function sign(x,y,text,enter=1){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.translate(x, y-(1-enter)*40); ctx.strokeStyle='#eef3ff'; ctx.fillStyle='rgba(255,255,255,.04)'; ctx.lineWidth=5; ctx.strokeRect(0,0,230,110); ctx.fillStyle='#eef3ff'; ctx.font='bold 28px system-ui'; ctx.textAlign='center'; ctx.fillText(text,115,65); ctx.restore();
}
function burst(x,y,phase,enter=1){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.strokeStyle='#e65b5b'; ctx.lineWidth=5;
  for(let i=0;i<14;i++){ const a=i*Math.PI/7+phase*.08; ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*25,y+Math.sin(a)*25); ctx.lineTo(x+Math.cos(a)*(50+45*enter),y+Math.sin(a)*(50+45*enter)); ctx.stroke(); }
  ctx.restore();
}
function coin(x,y,phase,label='$'){
  ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(phase)*0.2); ctx.fillStyle='#f1b84b'; ctx.strokeStyle='#fff1ba'; ctx.lineWidth=4; ctx.beginPath(); ctx.ellipse(0,0,26,26*Math.abs(Math.cos(phase))+6,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle='#111722'; ctx.font='bold 24px system-ui'; ctx.textAlign='center'; ctx.fillText(label,0,8); ctx.restore();
}
function crate(x,y,enter=1,label='LOOT'){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.translate(x,y+(1-enter)*50); ctx.strokeStyle='#b88450'; ctx.fillStyle='rgba(184,132,80,.18)'; ctx.lineWidth=5; ctx.fillRect(0,0,110,90); ctx.strokeRect(0,0,110,90); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(110,90); ctx.moveTo(110,0); ctx.lineTo(0,90); ctx.stroke(); ctx.fillStyle='#f1b84b'; ctx.font='bold 20px system-ui'; ctx.textAlign='center'; ctx.fillText(label,55,52); ctx.restore();
}
function thoughtBubble(x,y,text,enter=1){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.fillStyle='rgba(238,243,255,.1)'; ctx.strokeStyle='#eef3ff'; ctx.lineWidth=4; roundRect(x,y,300,90,22,true,true); ctx.fillStyle='#eef3ff'; ctx.font='bold 24px system-ui'; ctx.textAlign='center'; wrapText(text,x+25,y+38,250,28); ctx.restore();
}
function roundRect(x,y,w,h,r,fill,stroke){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); if(fill) ctx.fill(); if(stroke) ctx.stroke();
}

function drawSceneVisual(scene, p, local, globalTime){
  const type = scene.visual.type;
  const beatCount = 4;
  const beatRaw = p * beatCount;
  const beat = Math.min(beatCount - 1, Math.floor(beatRaw));
  const bp = ease(beatRaw - beat);
  const phase = globalTime * 2.4 + scene.index;
  const enter1 = clamp(p*5,0,1);
  const enter2 = clamp((p-.18)*5,0,1);
  const enter3 = clamp((p-.42)*5,0,1);
  const enter4 = clamp((p-.66)*5,0,1);

  ctx.save(); ctx.fillStyle='rgba(241,184,75,.18)';
  for(let i=0;i<beatCount;i++){ ctx.fillRect(42+i*34,42,24,8); }
  ctx.fillStyle='#f1b84b'; ctx.fillRect(42+beat*34,39,24,14); ctx.restore();

  if(type==='hook'){
    drawStick(lerp(180,300,enter1),470,1.35,'confused',phase,'idle');
    drawMachine(lerp(960,780,enter2),210,250,210,'THE SYSTEM',phase,enter2);
    arrow(460,380,750,320,enter3);
    thoughtBubble(420,120, scene.index === 1 ? 'wait... what?' : 'pay attention', enter4);
  } else if(type==='goblin'){
    drawStick(240,470,1.2,'neutral',phase,'point');
    drawGoblin(lerp(1030,640,bp),470,1.2,phase,'sneak');
    crate(820,455,enter2,'PANTRY');
    if(beat > 1) coin(760 + Math.sin(phase)*12, 410 - bp*45, phase, '✦');
    thoughtBubble(360,130,'the crack in the wall matters',enter3);
  } else if(type==='sneak'){
    drawHouse(180,310,phase,enter1);
    drawGoblin(lerp(-80,520,p),490,1.1,phase,'sneak');
    sign(780,240,'GUARD ASLEEP',enter2);
    if(beat > 1) arrow(560,430,760,320,bp,'#b9ff9f');
    crate(900,455,enter3,'LOCK');
  } else if(type==='heist'){
    crate(210,450,enter1,'LOOT');
    drawGoblin(lerp(260,780,p),480,1.15,phase,'walk');
    for(let i=0;i<5;i++) coin(420+i*80, 360 + Math.sin(phase+i)*22, phase+i, i%2?'?':'!');
    if(beat > 2) burst(940,340,phase,enter4);
  } else if(type==='underground'){
    ctx.save(); ctx.strokeStyle='#6b4b35'; ctx.lineWidth=20; ctx.beginPath(); ctx.moveTo(0,540); ctx.bezierCurveTo(260,500,420,590,640,530); ctx.bezierCurveTo(820,480,990,575,1280,520); ctx.stroke(); ctx.restore();
    drawGoblin(lerp(120,980,p),500+Math.sin(phase)*14,1.05,phase,'sneak');
    sign(430,210,'UNDER THE SYSTEM',enter2);
    arrow(300,430,820,430,enter3,'#b9ff9f');
  } else if(type==='machine'){
    drawMachine(480,180,320,260,'MACHINE',phase,enter1);
    for(let i=0;i<6;i++) arrow(130+i*80,560,540,440,clamp((p*6-i*.35),0,1));
    if(beat > 1) burst(640,310,phase,enter3);
    sign(830,120,'OUTPUT',enter4);
  } else if(type==='network'){
    const nodes = [[260,250],[520,180],[760,260],[1000,180],[440,470],[820,480]];
    ctx.save(); ctx.strokeStyle='#8fd3ff'; ctx.lineWidth=5;
    nodes.forEach((n,i)=>nodes.slice(i+1).forEach((m,j)=>{ if((i+j+beat)%2===0) arrow(n[0],n[1],m[0],m[1],enter2,'#8fd3ff'); }));
    nodes.forEach((n,i)=>{ ctx.fillStyle=i===beat+1?'#f1b84b':'#8fd3ff'; ctx.beginPath(); ctx.arc(n[0]+Math.sin(phase+i)*8,n[1]+Math.cos(phase+i)*8,18,0,Math.PI*2); ctx.fill(); });
    ctx.restore();
  } else if(type==='console'){
    drawMachine(390,160,500,320,'CONTROL PANEL',phase,enter1);
    drawStick(250,500,1.1,'confused',phase,'point');
    ctx.save(); ctx.fillStyle='#b9ff9f'; ctx.font='bold 30px monospace'; ctx.textAlign='left';
    ['RUN IDEA.EXE','SCAN SYSTEM','EXPORT TRUTH','NO SHORTS'].forEach((line,i)=>{ if(p > i*.2) ctx.fillText('> '+line,440,235+i*55); });
    ctx.restore();
  } else if(type==='house'){
    drawHouse(210,300,phase,enter1);
    drawMachine(780,230,240,190,'GRID',phase,enter2);
    arrow(420,390,760,330,enter3);
    coin(550+Math.sin(phase)*25,450-Math.sin(p*Math.PI)*120,phase,'$');
    sign(850,90,'BILL RISES',enter4);
  } else if(type==='council'){
    sign(160,150,'KING',enter1); sign(520,150,'COUNCIL',enter2); sign(880,150,'GOBLIN AUDIT',enter3);
    drawGoblin(640,500,1.15,phase,'point');
    arrow(390,320,540,320,enter2); arrow(760,320,890,320,enter3,'#b9ff9f');
  } else if(type==='choice'){
    drawStick(620,470,1.25,'neutral',phase,'point');
    sign(160,210,'OPTION A',enter1); sign(890,210,'OPTION B',enter2);
    arrow(590,390,300,300,beat===0?bp:1); arrow(690,390,1010,300,beat>1?bp:0,'#e65b5b');
  } else if(type==='map'){
    sign(220,170,'LOCAL',enter1); sign(760,170,'NATIONAL',enter2); arrow(455,280,750,280,enter3);
    drawStick(lerp(250,900,p),520,1,'neutral',phase,'walk');
    if(beat>2) thoughtBubble(480,360,'follow the incentives',enter4);
  } else if(type==='conflict'){
    drawStick(lerp(280,390,enter1),470,1.2,'angry',phase,'walk');
    drawStick(lerp(980,850,enter2),470,1.2,'angry',-phase,'walk');
    burst(640,310,phase,enter3);
    if(beat>2) sign(525,150,'SYSTEM BREAK',enter4);
  } else if(type==='idea'){
    drawStick(260,470,1.15,'confused',phase,'idle');
    drawMachine(700,220,260,190,'IDEA',phase,enter1);
    arrow(390,360,690,310,enter2,'#b9ff9f');
    thoughtBubble(450,120,'make it visible',enter3);
  } else if(type==='closing'){
    drawGoblin(330,480,1.25,phase,'point');
    drawMachine(760,240,250,180,'LESSON',phase,enter1);
    arrow(500,360,750,320,enter2,'#b9ff9f');
    ctx.save(); ctx.fillStyle='#f1b84b'; ctx.font='bold 46px system-ui'; ctx.textAlign='center'; ctx.globalAlpha=enter3; ctx.fillText('REMEMBER THIS',640,120); ctx.restore();
    if(beat>2) burst(640,220,phase,enter4);
  } else {
    drawStick(640,470,1.3,'neutral',phase,'walk');
  }
}

function drawFrame(t){
  applyBackground(storyboard?.style || 'chalk', t);
  if(!storyboard){
    ctx.fillStyle='#edf2ff'; ctx.font='bold 54px system-ui'; ctx.textAlign='center'; ctx.fillText('StickForge',640,300);
    ctx.fillStyle='#9aa7bd'; ctx.font='28px system-ui'; ctx.fillText('Paste essay → Generate Scene Plan → Play',640,350); return;
  }
  const total = totalSeconds();
  const clamped = clamp(t,0,total);
  const {scene, local} = sceneAt(clamped);
  const p = scene.duration ? local/scene.duration : 0;
  applyCamera(scene, p, clamped);
  drawSceneVisual(scene, p, local, clamped);
  ctx.restore();

  ctx.fillStyle='rgba(0,0,0,.58)'; ctx.fillRect(0,555,1280,165);
  ctx.fillStyle='#f1b84b'; ctx.font='bold 28px system-ui'; ctx.textAlign='left'; ctx.fillText(`${scene.index}. ${scene.title}`,44,598);
  ctx.fillStyle='#edf2ff'; ctx.font='bold 38px system-ui'; wrapText(scene.onscreenText,44,650,1160,44);
  $('sceneInfo').textContent = `${scene.index}/${storyboard.scenes.length} — ${scene.retentionBeat}`;
  $('timecode').textContent = `${fmt(clamped)} / ${fmt(total)}`;
  $('timeline').value = total ? Math.round((clamped/total)*1000) : 0;
}

function wrapText(text,x,y,maxWidth,lineHeight){
  const words=String(text).split(' '); let line='';
  for(const w of words){
    const test=line+w+' ';
    if(ctx.measureText(test).width>maxWidth && line){ ctx.fillText(line,x,y); line=w+' '; y+=lineHeight; }
    else line=test;
  }
  ctx.fillText(line,x,y);
}

function animate(){
  if(!playing) return;
  const t=(performance.now()-startedAt)/1000;
  if(t>=totalSeconds()){ pause(); drawFrame(totalSeconds()); return; }
  drawFrame(t); raf=requestAnimationFrame(animate);
}
function play(){ if(!storyboard) makeStoryboard(); playing=true; startedAt=performance.now()-pausedAt*1000; speakAll(); animate(); setStatus('Playing motion pass v0.2.'); }
function pause(){ playing=false; cancelAnimationFrame(raf); pausedAt=Number($('timeline').value)/1000*totalSeconds(); speechSynthesis.cancel(); setStatus('Paused.'); }
function reset(){ pause(); pausedAt=0; drawFrame(0); }
function seek(){ pausedAt=Number($('timeline').value)/1000*totalSeconds(); drawFrame(pausedAt); }

function scriptText(){ return storyboard.scenes.map(s=>`## ${s.index}. ${s.title}\n\n${s.narration}\n`).join('\n'); }
function storyboardText(){ return storyboard.scenes.map(s=>`${s.index}. ${s.title} (${s.duration}s)\nVisual: ${s.visual.type} / ${s.visual.action}\nText: ${s.onscreenText}\nNarration: ${s.narration}\n`).join('\n'); }
function renderOutput(){
  $('videoTitle').textContent = storyboard.title;
  if(activeTab==='json') $('output').textContent = JSON.stringify(storyboard,null,2);
  else if(activeTab==='script') $('output').textContent = scriptText();
  else $('output').textContent = storyboardText();
}
function tab(name){ activeTab=name; document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); if(storyboard) renderOutput(); }

function loadVoices(){
  voices = speechSynthesis.getVoices();
  $('voiceSelect').innerHTML = voices.map((v,i)=>`<option value="${i}">${v.name} — ${v.lang}</option>`).join('');
}
function selectedVoice(){ return voices[Number($('voiceSelect').value)] || null; }
function speak(text){
  if(!$('voiceEnabled').checked || !('speechSynthesis' in window)) return;
  const u=new SpeechSynthesisUtterance(text); const v=selectedVoice(); if(v) u.voice=v;
  u.rate=Number($('voiceRate').value); u.pitch=Number($('voicePitch').value); speechSynthesis.speak(u);
}
function speakAll(){ if(!$('voiceEnabled').checked || !storyboard) return; speechSynthesis.cancel(); speak(scriptText().replace(/## .*\n/g,'')); }
function testVoice(){ speechSynthesis.cancel(); speak('StickForge voice test. It sounds ugly, but the goblin speaks. Now with more movement.'); }

function download(text,name,type='text/plain'){
  const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
}
function exportScript(){ if(!storyboard) makeStoryboard(); download(scriptText(),`${slug(storyboard.title)}-script.md`,'text/markdown'); }
function exportJson(){ if(!storyboard) makeStoryboard(); download(JSON.stringify(storyboard,null,2),`${slug(storyboard.title)}-storyboard.json`,'application/json'); }

async function recordCanvas(){
  if(!storyboard) makeStoryboard(); reset();
  chunks=[]; const stream=canvas.captureStream(30); recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
  recorder.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  recorder.onstop=()=>{ const blob=new Blob(chunks,{type:'video/webm'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${slug(storyboard.title)}.webm`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500); setStatus('Downloaded WebM.'); };
  recorder.start(); play(); setTimeout(()=>{ recorder?.stop(); pause(); }, totalSeconds()*1000+500);
  setStatus('Recording canvas WebM. Browser TTS may not be included.');
}
async function recordTab(){
  if(!storyboard) makeStoryboard();
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
    chunks=[]; recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
    recorder.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
    recorder.onstop=()=>{ stream.getTracks().forEach(t=>t.stop()); const blob=new Blob(chunks,{type:'video/webm'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${slug(storyboard.title)}-tab-voice.webm`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500); setStatus('Downloaded tab recording.'); };
    reset(); recorder.start(); play(); setTimeout(()=>{ recorder?.stop(); pause(); }, totalSeconds()*1000+800);
    setStatus('Recording tab. Choose this tab/window and enable tab audio.');
  } catch(err){ setStatus('Tab recording cancelled or blocked.'); console.error(err); }
}

function init(){
  $('essayInput').value = '';
  $('loadSampleBtn').onclick=()=>{ $('essayInput').value=SAMPLE_ESSAY; makeStoryboard(); };
  $('generateBtn').onclick=makeStoryboard;
  $('playBtn').onclick=play; $('pauseBtn').onclick=pause; $('resetBtn').onclick=reset;
  $('recordBtn').onclick=recordCanvas; $('recordTabBtn').onclick=recordTab;
  $('exportScriptBtn').onclick=exportScript; $('exportJsonBtn').onclick=exportJson;
  $('timeline').oninput=seek; $('testVoiceBtn').onclick=testVoice;
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  loadVoices(); speechSynthesis.onvoiceschanged=loadVoices;
  drawFrame(0);
}
init();
