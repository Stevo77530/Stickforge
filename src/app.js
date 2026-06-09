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

function selected(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function fmt(seconds){ seconds=Math.max(0, Math.floor(seconds)); return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
function slug(s){ return (s||'stickforge').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'stickforge'; }
function setStatus(s){ $('status').textContent = s; }
function getMode(){ return MODES[selected('mode') || 'standard']; }

function splitEssay(text) {
  return text.replace(/\r/g,'').split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/).map(x=>x.trim()).filter(Boolean);
}

function titleFrom(text) {
  const first = text.split(/\n|[.!?]/).find(x=>x.trim()) || 'StickForge Project';
  return first.trim().slice(0, 90);
}

function makeStoryboard() {
  const text = $('essayInput').value.trim() || SAMPLE_ESSAY;
  const modeKey = selected('mode') || 'standard';
  const mode = MODES[modeKey];
  const parts = splitEssay(text);
  const scenes = [];
  for (let i=0; i<mode.scenes; i++) {
    const p = parts[i % parts.length] || text;
    const type = i === 0 ? 'hook' : i === mode.scenes-1 ? 'closing' : ['machine','house','choice','map','conflict','idea'][i % 6];
    const duration = Math.round(mode.seconds / mode.scenes);
    scenes.push({
      id: `scene_${String(i+1).padStart(2,'0')}`,
      index: i+1,
      title: i===0 ? 'Hook' : i===mode.scenes-1 ? 'Final Strike' : `Beat ${i+1}`,
      duration,
      narration: p.length > 260 ? p.slice(0,257) + '...' : p,
      onscreenText: i===0 ? (p.match(/[^.!?]+[.!?]?/)?.[0] || p).slice(0,70) : keywordLine(p),
      visual: { type, action: ['reveal','point','build','argue','collapse','transform'][i % 6] },
      camera: ['slow_push','pan','wide','shake','zoom_out'][i % 5],
      retentionBeat: i===0 ? 'Give the viewer a reason to care immediately.' : 'One idea, one visual change, no swamp.'
    });
  }
  storyboard = {
    schema: 'stickforge.storyboard.v0',
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
    scenes
  };
  pausedAt = 0;
  renderOutput();
  drawFrame(0);
  setStatus(`Generated ${scenes.length} scenes. ${mode.label} mode. No Shorts.`);
}

function keywordLine(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w=>w.length>4);
  const stop = new Set(['there','their','about','would','could','should','which','while','because','being','become','becoming','ordinary','people']);
  const counts = {};
  words.forEach(w=>{ if(!stop.has(w)) counts[w]=(counts[w]||0)+1; });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);
  return top.length ? top.map(w=>w[0].toUpperCase()+w.slice(1)).join(' • ') : text.slice(0,60);
}

function totalSeconds(){ return storyboard ? storyboard.scenes.reduce((a,s)=>a+s.duration,0) : 0; }
function sceneAt(t){
  let acc=0;
  for (const s of storyboard.scenes){ if(t < acc+s.duration) return {scene:s, local:t-acc, start:acc}; acc += s.duration; }
  const last = storyboard.scenes.at(-1); return {scene:last, local:last.duration, start:acc-last.duration};
}

function bg(style){
  if(style==='paper') { ctx.fillStyle='#f4ead7'; ctx.fillRect(0,0,1280,720); ctx.strokeStyle='#d8c9ad'; }
  else if(style==='blueprint') { ctx.fillStyle='#07172b'; ctx.fillRect(0,0,1280,720); ctx.strokeStyle='#20466f'; }
  else { ctx.fillStyle='#05070b'; ctx.fillRect(0,0,1280,720); ctx.strokeStyle='#182031'; }
  ctx.lineWidth=1;
  for(let x=0;x<1280;x+=80){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,720); ctx.stroke(); }
  for(let y=0;y<720;y+=80){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1280,y); ctx.stroke(); }
}

function drawStick(x,y,scale=1,mood='neutral',phase=0){
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale); ctx.lineWidth=7; ctx.lineCap='round'; ctx.strokeStyle='#eef3ff'; ctx.fillStyle='#eef3ff';
  ctx.beginPath(); ctx.arc(0,-90,28,0,Math.PI*2); ctx.stroke();
  if(mood==='angry'){ ctx.beginPath(); ctx.moveTo(-13,-97); ctx.lineTo(-3,-91); ctx.moveTo(13,-97); ctx.lineTo(3,-91); ctx.stroke(); }
  if(mood==='confused'){ ctx.font='30px sans-serif'; ctx.fillText('?',22,-110); }
  ctx.beginPath(); ctx.moveTo(0,-60); ctx.lineTo(0,25); ctx.stroke();
  const sway=Math.sin(phase)*18;
  ctx.beginPath(); ctx.moveTo(0,-25); ctx.lineTo(-45,-5+sway); ctx.moveTo(0,-25); ctx.lineTo(45,-5-sway); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,25); ctx.lineTo(-35,85-sway); ctx.moveTo(0,25); ctx.lineTo(35,85+sway); ctx.stroke();
  ctx.restore();
}

function drawMachine(x,y,w,h,label,phase){
  ctx.save(); ctx.strokeStyle='#f1b84b'; ctx.fillStyle='rgba(241,184,75,.08)'; ctx.lineWidth=6;
  ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
  ctx.beginPath(); ctx.arc(x+w/2,y+h/2,42+Math.sin(phase)*8,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#f1b84b'; ctx.font='bold 30px system-ui'; ctx.textAlign='center'; ctx.fillText(label,x+w/2,y+h+42); ctx.restore();
}

function drawHouse(x,y,phase){
  ctx.save(); ctx.strokeStyle='#8fd3ff'; ctx.lineWidth=6;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+80,y-70); ctx.lineTo(x+160,y); ctx.lineTo(x+160,y+120); ctx.lineTo(x,y+120); ctx.closePath(); ctx.stroke();
  ctx.fillStyle='#8fd3ff'; ctx.font='bold 28px system-ui'; ctx.textAlign='center'; ctx.fillText('$'+String(120+Math.floor(phase*30)),x+80,y+165); ctx.restore();
}

function drawSceneVisual(type, p){
  const phase = p * Math.PI * 2;
  if(type==='hook'){
    drawStick(300,470,1.35,'confused',phase);
    drawMachine(780,210,250,210,'THE SYSTEM',phase);
    arrow(460,380,750,320);
  } else if(type==='machine'){
    drawMachine(480,180,320,260,'MACHINE',phase);
    for(let i=0;i<5;i++) arrow(180+i*80,560,540,440);
  } else if(type==='house'){
    drawHouse(240,300,p); drawMachine(780,230,240,190,'GRID',phase); arrow(420,390,760,330);
  } else if(type==='choice'){
    drawStick(620,470,1.25,'neutral',phase); sign(210,210,'OPTION A'); sign(850,210,'OPTION B');
  } else if(type==='map'){
    sign(260,180,'LOCAL'); sign(730,180,'NATIONAL'); arrow(470,280,720,280); drawStick(620,520,1,'neutral',phase);
  } else if(type==='conflict'){
    drawStick(390,470,1.2,'angry',phase); drawStick(850,470,1.2,'angry',-phase); burst(640,310,phase);
  } else if(type==='closing'){
    drawStick(360,470,1.3,'neutral',phase); drawMachine(780,240,240,180,'IDEA',phase); ctx.fillStyle='#f1b84b'; ctx.font='bold 42px system-ui'; ctx.textAlign='center'; ctx.fillText('REMEMBER THIS',640,120);
  } else { drawStick(640,470,1.3,'neutral',phase); }
}

function arrow(x1,y1,x2,y2){
  ctx.save(); ctx.strokeStyle='#f1b84b'; ctx.fillStyle='#f1b84b'; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  const a=Math.atan2(y2-y1,x2-x1); ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2-18*Math.cos(a-.4),y2-18*Math.sin(a-.4)); ctx.lineTo(x2-18*Math.cos(a+.4),y2-18*Math.sin(a+.4)); ctx.closePath(); ctx.fill(); ctx.restore();
}
function sign(x,y,text){ ctx.save(); ctx.strokeStyle='#eef3ff'; ctx.fillStyle='rgba(255,255,255,.04)'; ctx.lineWidth=5; ctx.strokeRect(x,y,230,110); ctx.fillStyle='#eef3ff'; ctx.font='bold 28px system-ui'; ctx.textAlign='center'; ctx.fillText(text,x+115,y+65); ctx.restore(); }
function burst(x,y,phase){ ctx.save(); ctx.strokeStyle='#e65b5b'; ctx.lineWidth=5; for(let i=0;i<12;i++){ const a=i*Math.PI/6+phase*.05; ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*35,y+Math.sin(a)*35); ctx.lineTo(x+Math.cos(a)*90,y+Math.sin(a)*90); ctx.stroke(); } ctx.restore(); }

function drawFrame(t){
  bg(storyboard?.style || 'chalk');
  if(!storyboard){
    ctx.fillStyle='#edf2ff'; ctx.font='bold 54px system-ui'; ctx.textAlign='center'; ctx.fillText('StickForge',640,300);
    ctx.fillStyle='#9aa7bd'; ctx.font='28px system-ui'; ctx.fillText('Paste essay → Generate Scene Plan → Play',640,350); return;
  }
  const total=totalSeconds(); const clamped=clamp(t,0,total); const {scene, local}=sceneAt(clamped); const p=scene.duration ? local/scene.duration : 0;
  drawSceneVisual(scene.visual.type,p);
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,560,1280,160);
  ctx.fillStyle='#f1b84b'; ctx.font='bold 28px system-ui'; ctx.textAlign='left'; ctx.fillText(`${scene.index}. ${scene.title}`,44,600);
  ctx.fillStyle='#edf2ff'; ctx.font='bold 38px system-ui'; wrapText(scene.onscreenText,44,650,1160,44);
  $('sceneInfo').textContent = `${scene.index}/${storyboard.scenes.length} — ${scene.retentionBeat}`;
  $('timecode').textContent = `${fmt(clamped)} / ${fmt(total)}`;
  $('timeline').value = total ? Math.round((clamped/total)*1000) : 0;
}

function wrapText(text,x,y,maxWidth,lineHeight){
  const words=String(text).split(' '); let line='';
  for(const w of words){ const test=line+w+' '; if(ctx.measureText(test).width>maxWidth && line){ ctx.fillText(line,x,y); line=w+' '; y+=lineHeight; } else line=test; }
  ctx.fillText(line,x,y);
}

function animate(){
  if(!playing) return;
  const t=(performance.now()-startedAt)/1000;
  if(t>=totalSeconds()){ pause(); drawFrame(totalSeconds()); return; }
  drawFrame(t); raf=requestAnimationFrame(animate);
}
function play(){ if(!storyboard) makeStoryboard(); playing=true; startedAt=performance.now()-pausedAt*1000; speakAll(); animate(); setStatus('Playing.'); }
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
function testVoice(){ speechSynthesis.cancel(); speak('StickForge voice test. It sounds ugly, but the goblin speaks.'); }

function download(text,name,type='text/plain'){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500); }
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
