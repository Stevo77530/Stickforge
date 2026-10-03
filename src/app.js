const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

const SAMPLE_ESSAY = `What if the next electricity crisis is not caused by families using too much power, but by machines being allowed to buy the future first?

Data centers are becoming the new industrial cathedrals. They eat land, water, electricity, and political attention. Everyone talks about artificial intelligence as if it lives in the cloud, but the cloud is not magic. It is buildings, substations, cooling systems, transmission lines, concrete, tax deals, and utility bills.

The dangerous part is not that data centers need power. Industry has always needed power. The dangerous part is that homes may be asked to compete with machine infrastructure for the same grid, while ordinary people are told to conserve, adapt, and pay whatever scarcity price falls out of the machine.

If compute is going to become essential infrastructure, then households should not be treated like background noise. The public deal should be simple: machines pay, homes win, and the grid gets rebuilt outward from the places where compute lands.

AI may be inevitable. Tribute is not.`;

const GRIM_SAMPLE = `Welcome to the tour of the wild side. Keep your lantern low and your voice lower.

Past the last wall, the maps stop pretending. The road is older than the city that forgot it, and every milestone is a grave someone was too tired to finish digging.

Here stood the ruins of a clean and certain empire. It promised safety behind stone, and it charged a toll in obedience. The bones by the gate are the ones who paid in full.

The wild side is not mercy. The forest takes what it is owed. Crows keep the ledger, and the dead trees remember every pilgrim who thought the dark was only scenery.

But out here nobody lies to you about the price. The fire at the end of the road is real, and so is the choice to walk toward it.

The tour ends where it always ends. You can go back behind the wall. Or you can stay out here, where the truth is cold, and still yours.`;

const PALETTES = {
  default: {
    ink:'#eef3ff', text:'#edf2ff', muted:'#9aa7bd', accent:'#f1b84b', danger:'#e65b5b', cool:'#8fd3ff',
    goblin:'#b9ff9f', wood:'#b88450', dirt:'#6b4b35', coinEdge:'#fff1ba', coinText:'#111722',
    accentFaint:'rgba(241,184,75,.08)', accentSoft:'rgba(241,184,75,.18)', inkGhost:'rgba(255,255,255,.04)',
    inkFaint:'rgba(238,243,255,.1)', woodSoft:'rgba(184,132,80,.18)', font:'system-ui', grim:false
  },
  grimdark: {
    ink:'#d8cfbf', text:'#e8dfcf', muted:'#7d7268', accent:'#b3261e', danger:'#ff5a1f', cool:'#7f8c8d',
    goblin:'#8f9a5a', wood:'#5a3a26', dirt:'#2b1c14', coinEdge:'#c9a24a', coinText:'#140a08',
    accentFaint:'rgba(179,38,30,.10)', accentSoft:'rgba(179,38,30,.25)', inkGhost:'rgba(216,207,191,.04)',
    inkFaint:'rgba(216,207,191,.07)', woodSoft:'rgba(90,58,38,.3)', font:'Georgia, "Times New Roman", serif', grim:true
  }
};
let P = PALETTES.default;

// Grimdark tone: same scene logic, darker vocabulary.
const GRIM_TITLES = ['The Gate','The Road','The Toll','The Ruins','Omen','The Ledger','Bone Country','The Crows','The Breaking','Ash','The Witness','Old Gods','The Wound','Lanterns','The Pyre','Cold Truth','The Wild','Descent'];
const GRIM_WORDS = {
  'THE SYSTEM':'THE THRONE','MACHINE':'THE ENGINE','OUTPUT':'TITHE','GRID':'THE FURNACE','BILL RISES':'THE TOLL RISES',
  'LESSON':'RECKONING','REMEMBER THIS':'REMEMBER THE DEAD','IDEA':'HERESY','OPTION A':'KNEEL','OPTION B':'WALK WILD',
  'LOCAL':'THE WALLS','NATIONAL':'THE WILD','SYSTEM BREAK':'THE BREAKING','KING':'THRONE','COUNCIL':'THE PRIESTS',
  'GOBLIN AUDIT':'THE WITNESS','CONTROL PANEL':'THE ALTAR','PANTRY':'GRANARY','GUARD ASLEEP':'WATCH IS DEAD',
  'LOCK':'SEAL','LOOT':'RELICS','UNDER THE SYSTEM':'BENEATH THE THRONE',
  'wait... what?':'what have we done?','pay attention':'look closer','make it visible':'drag it into the light',
  'follow the incentives':'follow the bones','the crack in the wall matters':'the wall was always cracked'
};
const GRIM_ROTATION = ['road','ruins','omen','gate','pyre','conflict','choice'];
const L = (s) => storyboard?.tone === 'grimdark' ? (GRIM_WORDS[s] || s) : s;

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

function grimVisualFor(i, total, p) {
  if (i === 0) return 'gate';
  if (i === total - 1) return 'pyre';
  if (/wild|forest|road|walk|tour|pilgrim|path|journey/.test(p) && i % 2) return 'road';
  if (/ruin|city|empire|fall|wall|stone|throne/.test(p)) return i % 3 ? 'ruins' : 'gate';
  if (/dead|death|bone|grave|skull|blood|god|crow/.test(p)) return 'omen';
  if (/fire|burn|ash|flame|lantern/.test(p)) return 'pyre';
  return null;
}

function visualTypeFor(i, total, paragraph, tone) {
  const p = paragraph.toLowerCase();
  if (tone === 'grimdark') {
    const g = grimVisualFor(i, total, p);
    if (g) return g;
    if (i % 2 === 0) return ['road','ruins','omen','pyre'][(i/2) % 4];
  }
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
  if (/^(```|[\[{])/.test(text)) { importText(text, 'pasted JSON'); return; }
  const modeKey = selected('mode') || 'standard';
  const mode = MODES[modeKey];
  const parts = splitEssay(text);
  const tone = $('toneSelect').value;
  const grim = tone === 'grimdark';
  const scenes = [];
  for (let i=0; i<mode.scenes; i++) {
    const p = parts[i % parts.length] || text;
    let type = visualTypeFor(i, mode.scenes, p, tone);
    if (grim && i > 0 && i < mode.scenes - 1) {
      const cap = Math.ceil(mode.scenes / 4);
      const used = (t) => scenes.filter(s => s.visual.type === t).length;
      if (type === scenes[i-1].visual.type || used(type) >= cap) {
        const pool = GRIM_ROTATION.filter(t => t !== scenes[i-1].visual.type);
        type = pool.sort((a,b) => used(a) - used(b))[0];
      }
    }
    const duration = Math.round(mode.seconds / mode.scenes);
    const last = i===mode.scenes-1;
    scenes.push({
      id: `scene_${String(i+1).padStart(2,'0')}`,
      index: i+1,
      title: grim ? (last ? 'Last Rites' : GRIM_TITLES[i % GRIM_TITLES.length]) : i===0 ? 'Hook' : last ? 'Final Strike' : `Beat ${i+1}`,
      duration,
      narration: p.length > 260 ? p.slice(0,257) + '...' : p,
      onscreenText: i===0 ? (p.match(/[^.!?]+[.!?]?/)?.[0] || p).slice(0,70) : keywordLine(p),
      visual: { type, action: (grim ? ['reveal','walk','decay','kneel','burn','haunt','witness','fall'] : ['reveal','point','build','argue','collapse','transform','sneak','steal'])[i % 8] },
      camera: (grim ? ['slow_push','drift','zoom_out','shake','slow_push','pan'] : ['slow_push','pan','wide','shake','zoom_out','drift'])[i % 6],
      retentionBeat: grim
        ? (i===0 ? 'Open on dread. Make them afraid to look away.' : 'One wound per scene. Let the dark move every few seconds.')
        : (i===0 ? 'Give the viewer a reason to care immediately.' : 'One idea, multiple visual changes, no swamp.')
    });
  }
  storyboard = {
    schema: 'stickforge.storyboard.v0.2',
    title: titleFrom(text),
    createdAt: new Date().toISOString(),
    mode: modeKey,
    modeGoal: mode.goal,
    tone,
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

// ---------- JSON import: an outside director (ChatGPT, Codex, a human) writes the storyboard ----------
const VISUAL_TYPES = ['sky','sea','hook','goblin','sneak','heist','underground','machine','network','console','house','council','choice','map','conflict','idea','closing','gate','road','ruins','omen','pyre'];
const CAMERAS = ['slow_push','pan','wide','shake','zoom_out','drift'];

function parseJsonLoose(text){
  // Accept raw JSON or JSON wrapped in a ```json fence (how chat models usually hand it over).
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  if(!/^[\[{]/.test(body)) return null;
  return JSON.parse(body);
}

function normalizeStoryboard(raw){
  const warnings = [];
  const src = Array.isArray(raw) ? { scenes: raw } : raw;
  if(!src || typeof src !== 'object' || !Array.isArray(src.scenes) || !src.scenes.length){
    throw new Error('JSON needs a non-empty "scenes" array.');
  }
  const style = ['chalk','blueprint','paper','grimdark'].includes(src.style) ? src.style : $('styleSelect').value;
  const tone = ['clear','dark','satirical','grimdark'].includes(src.tone) ? src.tone : $('toneSelect').value;
  const scenes = src.scenes.map((s, i) => {
    s = s && typeof s === 'object' ? s : { narration: String(s ?? '') };
    const n = i + 1;
    const visual = typeof s.visual === 'string' ? { type: s.visual } : { ...(s.visual || {}) };
    if(!VISUAL_TYPES.includes(visual.type)){
      const fallback = visualTypeFor(i, src.scenes.length, String(s.narration || ''), tone);
      if(visual.type) warnings.push(`Scene ${n}: unknown visual "${visual.type}" → ${fallback}`);
      visual.type = fallback;
    }
    visual.action = visual.action || 'reveal';
    let duration = Number(s.duration);
    if(!(duration > 0)){ duration = 20; warnings.push(`Scene ${n}: missing duration → 20s`); }
    const narration = String(s.narration || '');
    return {
      ...s,
      id: s.id || `scene_${String(n).padStart(2,'0')}`,
      index: n,
      title: String(s.title || (i === 0 ? 'Hook' : `Beat ${n}`)),
      duration: Math.min(600, Math.round(duration)),
      narration,
      onscreenText: String(s.onscreenText ?? s.text ?? (narration ? keywordLine(narration) : '')),
      visual,
      camera: CAMERAS.includes(s.camera) ? s.camera : CAMERAS[i % CAMERAS.length],
      retentionBeat: String(s.retentionBeat || 'Imported scene.')
    };
  });
  const sb = {
    ...src,
    schema: src.schema || 'stickforge.storyboard.v0.2',
    title: String(src.title || titleFrom(scenes[0].narration || 'Imported StickForge Project')),
    mode: src.mode || 'imported',
    tone, style, scenes,
    targetSeconds: Number(src.targetSeconds) || scenes.reduce((a,s)=>a+s.duration,0),
    actualSeconds: scenes.reduce((a,s)=>a+s.duration,0),
    aspectRatio: '16:9',
    noShorts: true
  };
  return { storyboard: sb, warnings };
}

function loadStoryboard(raw, source){
  const { storyboard: sb, warnings } = normalizeStoryboard(raw);
  pause();
  storyboard = sb;
  $('styleSelect').value = sb.style; $('toneSelect').value = sb.tone; syncTheme();
  pausedAt = 0; renderOutput(); drawFrame(0);
  const note = warnings.length ? ` ${warnings.length} fix-up(s): ${warnings.slice(0,3).join('; ')}${warnings.length>3?'…':''}` : '';
  setStatus(`Imported ${sb.scenes.length} scenes from ${source} (${fmt(sb.actualSeconds)}).${note}`);
  if(warnings.length) console.warn('StickForge import fix-ups:', warnings);
}

function importText(text, source){
  try{
    const raw = parseJsonLoose(text);
    if(!raw) throw new Error('That is not JSON.');
    loadStoryboard(raw, source);
    return true;
  } catch(err){ setStatus(`Import failed: ${err.message}`); console.error(err); return false; }
}

function importFile(file){
  if(!file) return;
  file.text().then(t => importText(t, file.name));
}

function directorPrompt(){
  const essay = $('essayInput').value.trim() || SAMPLE_ESSAY;
  const mode = MODES[selected('mode') || 'standard'];
  return `You are the director for StickForge, a crude stick-figure explainer animator.
Turn the essay below into a storyboard. Reply with ONLY a JSON object in a \`\`\`json block.

Target: ${mode.scenes} scenes, about ${mode.seconds} seconds total (${mode.label} mode: ${mode.goal}). 16:9, never Shorts.
Tone: ${$('toneSelect').value}. Style: ${$('styleSelect').value}.

Shape:
{
  "title": "...",
  "tone": "${$('toneSelect').value}",
  "style": "${$('styleSelect').value}",
  "scenes": [
    {
      "title": "short scene title",
      "duration": 30,
      "narration": "what the voice says, written for the ear",
      "onscreenText": "max ~8 words on screen",
      "visual": { "type": "one of the types below", "action": "reveal" },
      "camera": "one of: ${CAMERAS.join(', ')}",
      "retentionBeat": "why the viewer keeps watching"
    }
  ]
}

Visual types (pick the one that best stages the idea):
hook (big question), closing (final line), idea (lightbulb), choice (fork in the road),
map, conflict (two figures clash), council (power/law/vote), house (homes/households/bills),
machine, network, console (tech/systems), goblin, sneak, heist, underground (hidden actors/loot),
gate, road, ruins, omen, pyre (grimdark set pieces),\nsky (night sky + stars; action "broadcast" adds expanding radio rings), sea (night watch on dark water, light on horizon).\n\nOptional "labels" inside visual rename the scene's built-in signs so they fit the essay:\n{ "sign": "...", "bubble": "...", "machine": "...", "crate": "...", "headline": "...", "a": "...", "b": "...", "c": "..." } ("" hides one).

Rules: one idea per scene, first scene must justify the video in 20 seconds,
escalate at the midpoint, end on a memorable line rather than a call to action.

ESSAY:
${essay}`;
}

async function copyDirectorPrompt(){
  const text = directorPrompt();
  try{ await navigator.clipboard.writeText(text); setStatus('Director prompt copied. Paste it into ChatGPT/Claude, then paste the JSON reply back here and Generate.'); }
  catch{ download(text, 'stickforge-director-prompt.txt'); setStatus('Clipboard blocked — downloaded the director prompt instead.'); }
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

// Deterministic pseudo-random so recordings match previews frame for frame.
const rand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function grimBackground(time) {
  const g = ctx.createLinearGradient(0,0,0,720);
  g.addColorStop(0,'#1a0b0a'); g.addColorStop(.55,'#0b0607'); g.addColorStop(1,'#030203');
  ctx.fillStyle = g; ctx.fillRect(0,0,1280,720);
  // blood moon
  const mx = 980, my = 170;
  const halo = ctx.createRadialGradient(mx,my,20,mx,my,260);
  halo.addColorStop(0,'rgba(179,38,30,.35)'); halo.addColorStop(1,'rgba(179,38,30,0)');
  ctx.fillStyle = halo; ctx.fillRect(0,0,1280,720);
  ctx.fillStyle = '#5e1612'; ctx.beginPath(); ctx.arc(mx,my,70,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(mx+22,my-10,62,0,Math.PI*2); ctx.fill();
  // ruined skyline, slow parallax
  const off = (time * 4) % 1280;
  ctx.fillStyle = '#0d0808';
  for (let k=0; k<2; k++) {
    ctx.beginPath(); ctx.moveTo(-off + k*1280, 720);
    for (let i=0; i<=32; i++) {
      const x = -off + k*1280 + i*40;
      const h = 90 + rand(i)*140 * (i%5===0 ? 1.6 : 1);
      ctx.lineTo(x, 470 - h); ctx.lineTo(x + 18 + rand(i+9)*14, 470 - h + rand(i+3)*40);
    }
    ctx.lineTo(-off + (k+1)*1280, 720); ctx.closePath(); ctx.fill();
  }
  // falling ash
  for (let i=0; i<70; i++) {
    const x = (rand(i)*1280 + Math.sin(time*.6 + i)*30 + time*8) % 1280;
    const y = (rand(i+50)*720 + time*(18 + rand(i+99)*30)) % 720;
    ctx.fillStyle = i % 9 === 0 ? 'rgba(255,90,31,.7)' : 'rgba(200,190,175,.35)';
    ctx.fillRect(x, y, 2 + rand(i+7)*2, 2 + rand(i+7)*2);
  }
}

function grimOverlay(time) {
  // grain
  const f = Math.floor(time * 24);
  for (let i=0; i<260; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.12)';
    ctx.fillRect(rand(f*7+i)*1280, rand(f*13+i*3)*720, 2, 2);
  }
  // vignette + torch flicker
  const v = ctx.createRadialGradient(640,340,220,640,360,780);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,`rgba(0,0,0,${0.78 + Math.sin(time*9)*0.03 + rand(f)*0.03})`);
  ctx.fillStyle = v; ctx.fillRect(0,0,1280,720);
  // letterbox
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,1280,26);
}

function applyBackground(style, time) {
  if(style==='grimdark') { grimBackground(time); return; }
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
  ctx.lineWidth=7; ctx.lineCap='round'; ctx.strokeStyle=P.ink; ctx.fillStyle=P.ink;
  const bob = Math.sin(phase*2) * (pose === 'walk' ? 9 : 3);
  ctx.translate(0,bob);
  ctx.beginPath(); ctx.arc(0,-90,28,0,Math.PI*2); ctx.stroke();
  if(mood==='angry'){ ctx.beginPath(); ctx.moveTo(-13,-100); ctx.lineTo(-3,-94); ctx.moveTo(13,-100); ctx.lineTo(3,-94); ctx.stroke(); }
  if(mood==='hooded'){
    ctx.beginPath(); ctx.moveTo(-36,-60); ctx.lineTo(-30,-112); ctx.quadraticCurveTo(0,-150,30,-112); ctx.lineTo(36,-60); ctx.stroke();
    ctx.fillStyle=P.danger; ctx.fillRect(-12,-96,6,4); ctx.fillRect(6,-96,6,4); ctx.fillStyle=P.ink;
  }
  if(mood==='confused'){ ctx.font='30px sans-serif'; ctx.fillText('?',22,-110); }
  if(mood==='goblin'){
    ctx.beginPath(); ctx.moveTo(-22,-108); ctx.lineTo(-44,-126); ctx.lineTo(-28,-95); ctx.moveTo(22,-108); ctx.lineTo(44,-126); ctx.lineTo(28,-95); ctx.stroke();
    ctx.fillStyle=P.accent; ctx.font='22px sans-serif'; ctx.fillText('✦',-7,-82);
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
  ctx.lineWidth=6; ctx.lineCap='round'; ctx.strokeStyle=P.goblin; ctx.fillStyle=P.goblin;
  const crouch = pose === 'sneak' ? 18 : 0;
  ctx.translate(0, Math.sin(phase*4)*4 + crouch);
  ctx.beginPath(); ctx.arc(0,-80,24,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18,-96); ctx.lineTo(-46,-118); ctx.lineTo(-25,-82); ctx.moveTo(18,-96); ctx.lineTo(46,-118); ctx.lineTo(25,-82); ctx.stroke();
  ctx.fillStyle=P.accent; ctx.font='20px sans-serif'; ctx.fillText('•',-8,-78); ctx.fillText('•',8,-78);
  ctx.strokeStyle=P.goblin;
  ctx.beginPath(); ctx.moveTo(0,-55); ctx.lineTo(0,20); ctx.stroke();
  const s = Math.sin(phase*5)*22;
  ctx.beginPath(); ctx.moveTo(0,-25); ctx.lineTo(-42,0+s); ctx.moveTo(0,-25); ctx.lineTo(42,-10-s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,20); ctx.lineTo(-32,80-s); ctx.moveTo(0,20); ctx.lineTo(32,80+s); ctx.stroke();
  ctx.restore();
}

function drawMachine(x,y,w,h,label,phase,enter=1){
  ctx.save(); ctx.globalAlpha = clamp(enter,0,1); ctx.translate(x+w/2, y+h/2); ctx.scale(lerp(0.6,1,ease(enter)), lerp(0.6,1,ease(enter))); ctx.translate(-w/2,-h/2);
  ctx.strokeStyle=P.accent; ctx.fillStyle=P.accentFaint; ctx.lineWidth=6;
  ctx.fillRect(0,0,w,h); ctx.strokeRect(0,0,w,h);
  for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(w/2,h/2,32+i*22+Math.sin(phase+i)*5,0,Math.PI*2); ctx.stroke(); }
  ctx.fillStyle=P.accent; ctx.font=`bold 30px ${P.font}`; ctx.textAlign='center'; ctx.fillText(L(label),w/2,h+42);
  ctx.restore();
}

function drawHouse(x,y,phase,enter=1){
  ctx.save(); ctx.globalAlpha = clamp(enter,0,1); ctx.translate(x, y + (1-enter)*90); ctx.strokeStyle=P.cool; ctx.lineWidth=6;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(80,-70); ctx.lineTo(160,0); ctx.lineTo(160,120); ctx.lineTo(0,120); ctx.closePath(); ctx.stroke();
  ctx.fillStyle=P.cool; ctx.font=`bold 28px ${P.font}`; ctx.textAlign='center'; ctx.fillText('$'+String(120+Math.floor(pulse(phase)*70)),80,165);
  ctx.restore();
}
function arrow(x1,y1,x2,y2,progress=1,color=P.accent){
  progress = clamp(progress,0,1);
  const xe = lerp(x1,x2,progress), ye = lerp(y1,y2,progress);
  ctx.save(); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(xe,ye); ctx.stroke();
  if(progress > 0.9){ const a=Math.atan2(y2-y1,x2-x1); ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2-18*Math.cos(a-.4),y2-18*Math.sin(a-.4)); ctx.lineTo(x2-18*Math.cos(a+.4),y2-18*Math.sin(a+.4)); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function sign(x,y,text,enter=1){
  if(text==='') return;
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.font=`bold 28px ${P.font}`;
  const label=L(text), w=Math.max(230, ctx.measureText(label).width+48);
  ctx.translate(clamp(x, 20, 1260-w), y-(1-enter)*40);
  ctx.fillStyle=P.grim ? 'rgba(10,6,6,.82)' : P.inkGhost; ctx.fillRect(0,0,w,110);
  ctx.strokeStyle=P.ink; ctx.lineWidth=5; ctx.strokeRect(0,0,w,110); ctx.fillStyle=P.ink; ctx.textAlign='center'; ctx.fillText(label,w/2,65); ctx.restore();
}
function burst(x,y,phase,enter=1){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.strokeStyle=P.danger; ctx.lineWidth=5;
  for(let i=0;i<14;i++){ const a=i*Math.PI/7+phase*.08; ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*25,y+Math.sin(a)*25); ctx.lineTo(x+Math.cos(a)*(50+45*enter),y+Math.sin(a)*(50+45*enter)); ctx.stroke(); }
  ctx.restore();
}
function coin(x,y,phase,label='$'){
  ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(phase)*0.2); ctx.fillStyle=P.accent; ctx.strokeStyle=P.coinEdge; ctx.lineWidth=4; ctx.beginPath(); ctx.ellipse(0,0,26,26*Math.abs(Math.cos(phase))+6,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle=P.coinText; ctx.font=`bold 24px ${P.font}`; ctx.textAlign='center'; ctx.fillText(label,0,8); ctx.restore();
}
function crate(x,y,enter=1,label='LOOT'){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.translate(x,y+(1-enter)*50); ctx.strokeStyle=P.wood; ctx.fillStyle=P.woodSoft; ctx.lineWidth=5; ctx.fillRect(0,0,110,90); ctx.strokeRect(0,0,110,90); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(110,90); ctx.moveTo(110,0); ctx.lineTo(0,90); ctx.stroke(); ctx.fillStyle=P.accent; ctx.font=`bold 20px ${P.font}`; ctx.textAlign='center'; ctx.fillText(label,55,52); ctx.restore();
}
function thoughtBubble(x,y,text,enter=1){
  if(text==='') return;
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.fillStyle=P.inkFaint; ctx.strokeStyle=P.ink; ctx.lineWidth=4; roundRect(x,y,300,90,22,true,true); ctx.fillStyle=P.ink; ctx.font=`bold 24px ${P.font}`; ctx.textAlign='center'; wrapText(L(text),x+150,y+38,250,28); ctx.restore();
}
function roundRect(x,y,w,h,r,fill,stroke){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); if(fill) ctx.fill(); if(stroke) ctx.stroke();
}

function deadTree(x,y,s=1,sway=0){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s); ctx.rotate(sway*0.03); ctx.strokeStyle='#1c1212'; ctx.lineCap='round';
  const branch=(len,w,depth)=>{ if(depth===0) return; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-len); ctx.stroke();
    ctx.save(); ctx.translate(0,-len); ctx.rotate(-.5); branch(len*.68,w*.65,depth-1); ctx.restore();
    ctx.save(); ctx.translate(0,-len); ctx.rotate(.42); branch(len*.6,w*.65,depth-1); ctx.restore(); };
  branch(110,12,5); ctx.restore();
}
function crow(x,y,phase,s=1){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s); ctx.strokeStyle='#050303'; ctx.lineWidth=4; const f=Math.sin(phase*6)*10;
  ctx.beginPath(); ctx.moveTo(-22,f); ctx.quadraticCurveTo(-10,-6,0,0); ctx.quadraticCurveTo(10,-6,22,f); ctx.stroke(); ctx.restore();
}
function skull(x,y,s=1,glow=0,enter=1){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.translate(x,y); ctx.scale(s,s); ctx.strokeStyle=P.ink; ctx.fillStyle=P.inkFaint; ctx.lineWidth=6;
  ctx.beginPath(); ctx.arc(0,0,70,Math.PI*.85,Math.PI*2.15); ctx.lineTo(40,70); ctx.lineTo(-40,70); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle=`rgba(255,90,31,${0.25+glow*0.6})`;
  ctx.beginPath(); ctx.ellipse(-27,5,17,21,0,0,Math.PI*2); ctx.ellipse(27,5,17,21,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,28); ctx.lineTo(-9,46); ctx.lineTo(9,46); ctx.closePath(); ctx.stroke();
  for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(i*14,62); ctx.lineTo(i*14,82); ctx.stroke(); }
  ctx.restore();
}
function flames(x,y,phase,s=1,enter=1){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.translate(x,y); ctx.scale(s,s*clamp(enter,0.2,1));
  const light=ctx.createRadialGradient(0,-60,10,0,-60,260); light.addColorStop(0,'rgba(255,90,31,.35)'); light.addColorStop(1,'rgba(255,90,31,0)');
  ctx.fillStyle=light; ctx.fillRect(-260,-320,520,420);
  [['#7a1410',1],['#ff5a1f',.72],['#f3c15a',.42]].forEach(([c,k],j)=>{ ctx.fillStyle=c; ctx.beginPath(); ctx.moveTo(-70*k,0);
    for(let i=0;i<=6;i++){ const t=i/6; ctx.lineTo(lerp(-70*k,70*k,t), -(90+Math.sin(phase*3+i*1.7+j)*25)*k*(1-Math.abs(t-.5)*1.2)); }
    ctx.lineTo(70*k,0); ctx.closePath(); ctx.fill(); });
  ctx.strokeStyle=P.wood; ctx.lineWidth=10; ctx.beginPath(); ctx.moveTo(-90,10); ctx.lineTo(90,-6); ctx.moveTo(-90,-6); ctx.lineTo(90,10); ctx.stroke();
  ctx.restore();
  for(let i=0;i<10;i++){ const t=(phase*.15+rand(i))%1; ctx.fillStyle=`rgba(255,120,40,${1-t})`; ctx.fillRect(x+Math.sin(i+phase)*40*s, y-80*s-t*260, 4, 4); }
}
function gateArch(x,y,open,enter=1){
  ctx.save(); ctx.globalAlpha=clamp(enter,0,1); ctx.translate(x,y); ctx.strokeStyle=P.ink; ctx.lineWidth=7;
  ctx.fillStyle='#0e0909'; ctx.fillRect(-260,-330,140,330); ctx.fillRect(120,-330,140,330); ctx.strokeRect(-260,-330,140,330); ctx.strokeRect(120,-330,140,330);
  ctx.beginPath(); ctx.moveTo(-120,-200); ctx.quadraticCurveTo(0,-300,120,-200); ctx.stroke();
  const w=120*(1-open); ctx.fillStyle='#1b0f0c';
  ctx.fillRect(-120,-200,w,200); ctx.fillRect(120-w,-200,w,200);
  ctx.strokeStyle=P.wood; ctx.strokeRect(-120,-200,w,200); ctx.strokeRect(120-w,-200,w,200);
  const beyond=ctx.createLinearGradient(0,-200,0,0); beyond.addColorStop(0,`rgba(179,38,30,${0.35*open})`); beyond.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=beyond; ctx.fillRect(-120+w,-200,240-2*w,200);
  ctx.restore();
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
  // Storyboards can rename a scene's signs/bubbles: visual.labels = { sign, bubble, machine, crate, headline, a, b, c }.
  const T = (key, fallback) => scene.visual.labels?.[key] ?? fallback;

  ctx.save(); ctx.fillStyle=P.accentSoft;
  for(let i=0;i<beatCount;i++){ ctx.fillRect(42+i*34,42,24,8); }
  ctx.fillStyle=P.accent; ctx.fillRect(42+beat*34,39,24,14); ctx.restore();

  if(type==='sky'){
    for(let i=0;i<140;i++){ const tw=.35+.65*pulse(globalTime*(1+rand(i+7)*2)+i); ctx.fillStyle=`rgba(238,232,220,${(tw*clamp(p*3-rand(i)*.5,0,1)).toFixed(3)})`; ctx.fillRect(rand(i)*1280, rand(i+300)*430, 2+(i%9===0), 2+(i%9===0)); }
    ctx.save(); ctx.strokeStyle=P.ink; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(0,540); ctx.lineTo(1280,540); ctx.stroke(); ctx.restore();
    if(scene.visual.action==='broadcast'){
      ctx.save(); ctx.lineWidth=3;
      for(let r=0;r<7;r++){ const rad=((globalTime*60 + r*140) % 980); ctx.strokeStyle=P.accent; ctx.globalAlpha=clamp(enter2*(1-rad/980),0,1); ctx.beginPath(); ctx.arc(330,500,rad,Math.PI,Math.PI*2); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.strokeStyle=P.ink; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(330,470,40,Math.PI*1.1,Math.PI*1.9); ctx.moveTo(330,450); ctx.lineTo(330,540); ctx.stroke(); ctx.restore();
    }
    drawStick(lerp(820,720,enter1),520,0.95,'neutral',phase*.4,'point');
    if(beat>0) thoughtBubble(780,130,T('bubble','where is everyone?'),enter2);
    if(beat>2 && T('sign','')) sign(80,90,T('sign',''),enter4);
  } else if(type==='sea'){
    ctx.save(); ctx.strokeStyle=P.ink; ctx.lineWidth=2; ctx.globalAlpha=.6; ctx.beginPath(); ctx.moveTo(0,330); ctx.lineTo(1280,330); ctx.stroke();
    ctx.globalAlpha=.35; for(let w=0;w<6;w++){ ctx.beginPath(); for(let x=0;x<=1280;x+=20){ const y=360+w*38+Math.sin(x*.012+globalTime*1.3+w)*6; x?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke(); }
    ctx.restore();
    const lightOn = clamp((p-.25)*4,0,1);
    ctx.save(); ctx.globalAlpha=lightOn*(.55+.45*pulse(globalTime*3)); ctx.fillStyle=P.danger; ctx.shadowColor=P.danger; ctx.shadowBlur=30; ctx.beginPath(); ctx.arc(1010,322,7,0,Math.PI*2); ctx.fill(); ctx.restore();
    const bob=Math.sin(globalTime*1.3)*6;
    ctx.save(); ctx.translate(0,bob); ctx.strokeStyle=P.ink; ctx.fillStyle='#050303'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(120,470); ctx.lineTo(560,470); ctx.lineTo(500,540); ctx.lineTo(170,540); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeRect(190,400,90,70); ctx.restore();
    drawStick(420,bob+386,0.8,p>.3?'neutral':'hooded',phase*.3,'idle');
    if(beat>1) sign(820,110,T('sign','UNKNOWN LIGHT'),enter3);
  } else if(type==='gate'){
    gateArch(640,500,ease(clamp((p-.15)*2.2,0,1)),enter1);
    drawStick(640,lerp(560,500,enter3),lerp(1.3,0.8,ease(clamp((p-.45)*2,0,1))),'hooded',phase,p>.45?'walk':'idle');
    crow(lerp(300,1100,p),160+Math.sin(phase)*20,phase,1.2);
    if(beat>2) sign(900,120,T('sign','BEYOND THE WALL'),enter4);
  } else if(type==='road'){
    ctx.save(); ctx.fillStyle='#120b09'; ctx.beginPath(); ctx.moveTo(560,470); ctx.lineTo(720,470); ctx.lineTo(1100,720); ctx.lineTo(180,720); ctx.closePath(); ctx.fill(); ctx.restore();
    for(let i=0;i<5;i++){ const tx=((i*300 - globalTime*40) % 1500 + 1500) % 1500 - 110; deadTree(tx, 520 + (i%2)*40, 0.9 + (i%3)*.2, Math.sin(phase+i)); }
    for(let i=0;i<3;i++) drawStick(lerp(260,860,p)-i*120,500+i*6,0.9,'hooded',phase+i*.9,'walk');
    crow(lerp(1100,200,p),140,phase,1); crow(lerp(1200,300,p),190,phase+1,.8);
    if(beat>1) thoughtBubble(470,90,T('bubble','the maps stop here'),enter3);
  } else if(type==='ruins'){
    for(let i=0;i<6;i++){ const e=clamp((p-i*.07)*4,0,1); const h=[260,340,200,380,240,300][i];
      ctx.save(); ctx.globalAlpha=e; ctx.fillStyle='#140d0c'; ctx.strokeStyle=P.ink; ctx.lineWidth=4;
      const x=120+i*180, top=540-h*ease(e);
      ctx.beginPath(); ctx.moveTo(x,540); ctx.lineTo(x,top+30); ctx.lineTo(x+30,top); ctx.lineTo(x+55,top+45); ctx.lineTo(x+90,top+10); ctx.lineTo(x+90,540); ctx.closePath(); ctx.fill(); ctx.stroke();
      for(let w=0;w<3;w++){ ctx.fillStyle=(i+w+beat)%4===0?'rgba(255,90,31,.6)':'#050303'; ctx.fillRect(x+30,top+70+w*55,24,30); }
      ctx.restore(); }
    drawStick(640,520,0.9,'hooded',phase,'idle');
    if(beat>1) sign(525,90,T('sign','HERE STOOD A CITY'),enter3);
  } else if(type==='omen'){
    skull(640,260,1.5+ease(p)*.25,pulse(phase*1.5),enter1);
    drawStick(lerp(260,420,enter2),520,1,'hooded',phase,'idle');
    drawStick(lerp(1020,860,enter3),520,1,'hooded',-phase,'point');
    for(let i=0;i<4;i++) crow(640+Math.cos(phase*.4+i*1.6)*300,240+Math.sin(phase*.4+i*1.6)*110,phase+i,.9);
    if(beat>2) sign(40,90,T('sign','THE OMEN'),enter4);
  } else if(type==='pyre'){
    flames(640,520,phase,1.2,enter1);
    for(let i=0;i<4;i++){ const side=i<2?-1:1; drawStick(640+side*(260+(i%2)*140),520,0.9,'hooded',phase+i,'idle'); }
    ctx.save(); ctx.fillStyle=P.text; ctx.font=`bold 44px ${P.font}`; ctx.textAlign='center'; ctx.globalAlpha=enter3;
    ctx.fillText(T('headline', scene.index===storyboard.scenes.length ? L('REMEMBER THIS') : 'KEEP THE FIRE'),640,110); ctx.restore();
  } else if(type==='hook'){
    drawStick(lerp(180,300,enter1),470,1.35,'confused',phase,'idle');
    drawMachine(lerp(960,780,enter2),210,250,210,T('machine','THE SYSTEM'),phase,enter2);
    arrow(460,380,750,320,enter3);
    thoughtBubble(420,120, T('bubble', scene.index === 1 ? 'wait... what?' : 'pay attention'), enter4);
  } else if(type==='goblin'){
    drawStick(240,470,1.2,'neutral',phase,'point');
    drawGoblin(lerp(1030,640,bp),470,1.2,phase,'sneak');
    crate(820,455,enter2,T('crate','PANTRY'));
    if(beat > 1) coin(760 + Math.sin(phase)*12, 410 - bp*45, phase, '✦');
    thoughtBubble(360,130,T('bubble','the crack in the wall matters'),enter3);
  } else if(type==='sneak'){
    drawHouse(180,310,phase,enter1);
    drawGoblin(lerp(-80,520,p),490,1.1,phase,'sneak');
    sign(780,240,T('sign','GUARD ASLEEP'),enter2);
    if(beat > 1) arrow(560,430,760,320,bp,P.goblin);
    crate(900,455,enter3,T('crate','LOCK'));
  } else if(type==='heist'){
    crate(210,450,enter1,T('crate','LOOT'));
    drawGoblin(lerp(260,780,p),480,1.15,phase,'walk');
    for(let i=0;i<5;i++) coin(420+i*80, 360 + Math.sin(phase+i)*22, phase+i, i%2?'?':'!');
    if(beat > 2) burst(940,340,phase,enter4);
  } else if(type==='underground'){
    ctx.save(); ctx.strokeStyle=P.dirt; ctx.lineWidth=20; ctx.beginPath(); ctx.moveTo(0,540); ctx.bezierCurveTo(260,500,420,590,640,530); ctx.bezierCurveTo(820,480,990,575,1280,520); ctx.stroke(); ctx.restore();
    drawGoblin(lerp(120,980,p),500+Math.sin(phase)*14,1.05,phase,'sneak');
    sign(430,210,T('sign','UNDER THE SYSTEM'),enter2);
    arrow(300,430,820,430,enter3,P.goblin);
  } else if(type==='machine'){
    drawMachine(480,180,320,260,T('machine','MACHINE'),phase,enter1);
    for(let i=0;i<6;i++) arrow(130+i*80,560,540,440,clamp((p*6-i*.35),0,1));
    if(beat > 1) burst(640,310,phase,enter3);
    sign(830,120,T('sign','OUTPUT'),enter4);
  } else if(type==='network'){
    const nodes = [[260,250],[520,180],[760,260],[1000,180],[440,470],[820,480]];
    ctx.save(); ctx.strokeStyle=P.cool; ctx.lineWidth=5;
    nodes.forEach((n,i)=>nodes.slice(i+1).forEach((m,j)=>{ if((i+j+beat)%2===0) arrow(n[0],n[1],m[0],m[1],enter2,P.cool); }));
    nodes.forEach((n,i)=>{ ctx.fillStyle=i===beat+1?P.accent:P.cool; ctx.beginPath(); ctx.arc(n[0]+Math.sin(phase+i)*8,n[1]+Math.cos(phase+i)*8,18,0,Math.PI*2); ctx.fill(); });
    ctx.restore();
  } else if(type==='console'){
    drawMachine(390,160,500,320,T('machine','CONTROL PANEL'),phase,enter1);
    drawStick(250,500,1.1,'confused',phase,'point');
    ctx.save(); ctx.fillStyle=P.goblin; ctx.font='bold 30px monospace'; ctx.textAlign='left';
    ['RUN IDEA.EXE','SCAN SYSTEM','EXPORT TRUTH','NO SHORTS'].forEach((line,i)=>{ if(p > i*.2) ctx.fillText('> '+line,440,235+i*55); });
    ctx.restore();
  } else if(type==='house'){
    drawHouse(210,300,phase,enter1);
    drawMachine(780,230,240,190,T('machine','GRID'),phase,enter2);
    arrow(420,390,760,330,enter3);
    coin(550+Math.sin(phase)*25,450-Math.sin(p*Math.PI)*120,phase,'$');
    sign(850,90,T('sign','BILL RISES'),enter4);
  } else if(type==='council'){
    sign(160,150,T('a','KING'),enter1); sign(520,150,T('b','COUNCIL'),enter2); sign(880,150,T('c','GOBLIN AUDIT'),enter3);
    drawGoblin(640,500,1.15,phase,'point');
    arrow(390,320,540,320,enter2); arrow(760,320,890,320,enter3,P.goblin);
  } else if(type==='choice'){
    drawStick(620,470,1.25,'neutral',phase,'point');
    sign(160,210,T('a','OPTION A'),enter1); sign(890,210,T('b','OPTION B'),enter2);
    arrow(590,390,300,300,beat===0?bp:1); arrow(690,390,1010,300,beat>1?bp:0,P.danger);
  } else if(type==='map'){
    sign(220,170,T('a','LOCAL'),enter1); sign(760,170,T('b','NATIONAL'),enter2); arrow(455,280,750,280,enter3);
    drawStick(lerp(250,900,p),520,1,'neutral',phase,'walk');
    if(beat>2) thoughtBubble(480,360,T('bubble','follow the incentives'),enter4);
  } else if(type==='conflict'){
    drawStick(lerp(280,390,enter1),470,1.2,'angry',phase,'walk');
    drawStick(lerp(980,850,enter2),470,1.2,'angry',-phase,'walk');
    burst(640,310,phase,enter3);
    if(beat>2) sign(525,150,T('sign','SYSTEM BREAK'),enter4);
  } else if(type==='idea'){
    drawStick(260,470,1.15,'confused',phase,'idle');
    drawMachine(700,220,260,190,T('machine','IDEA'),phase,enter1);
    arrow(390,360,690,310,enter2,P.goblin);
    thoughtBubble(450,120,T('bubble','make it visible'),enter3);
  } else if(type==='closing'){
    drawGoblin(330,480,1.25,phase,'point');
    drawMachine(760,240,250,180,T('machine','LESSON'),phase,enter1);
    arrow(500,360,750,320,enter2,P.goblin);
    ctx.save(); ctx.fillStyle=P.accent; ctx.font=`bold 46px ${P.font}`; ctx.textAlign='center'; ctx.globalAlpha=enter3; ctx.fillText(T('headline',L('REMEMBER THIS')),640,120); ctx.restore();
    if(beat>2) burst(640,220,phase,enter4);
  } else {
    drawStick(640,470,1.3,'neutral',phase,'walk');
  }
}

function drawFrame(t){
  const style = storyboard?.style || $('styleSelect').value;
  P = style === 'grimdark' ? PALETTES.grimdark : PALETTES.default;
  applyBackground(style, t);
  if(!storyboard && P.grim){ grimOverlay(t); }
  if(!storyboard){
    ctx.fillStyle=P.text; ctx.font=`bold 54px ${P.font}`; ctx.textAlign='center'; ctx.fillText('StickForge',640,300);
    ctx.fillStyle=P.muted; ctx.font=`28px ${P.font}`; ctx.fillText('Paste essay → Generate Scene Plan → Play',640,350); return;
  }
  const total = totalSeconds();
  const clamped = clamp(t,0,total);
  const {scene, local} = sceneAt(clamped);
  const p = scene.duration ? local/scene.duration : 0;
  applyCamera(scene, p, clamped);
  drawSceneVisual(scene, p, local, clamped);
  ctx.restore();
  if(P.grim) grimOverlay(clamped);

  ctx.fillStyle = P.grim ? 'rgba(0,0,0,.72)' : 'rgba(0,0,0,.58)'; ctx.fillRect(0,555,1280,165);
  if(P.grim){ ctx.fillStyle=P.accent; ctx.fillRect(0,555,1280,3); }
  ctx.fillStyle=P.accent; ctx.font=`bold 28px ${P.font}`; ctx.textAlign='left'; ctx.fillText(`${scene.index}. ${scene.title}`,44,598);
  ctx.fillStyle=P.text; ctx.font=`bold 38px ${P.font}`; wrapText(scene.onscreenText,44,650,1160,44);
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

function syncTheme(){ document.body.classList.toggle('grim', $('styleSelect').value==='grimdark'); }

function init(){
  $('essayInput').value = '';
  $('loadSampleBtn').onclick=()=>{ $('essayInput').value=SAMPLE_ESSAY; makeStoryboard(); };
  $('loadGrimBtn').onclick=()=>{ $('essayInput').value=GRIM_SAMPLE; $('styleSelect').value='grimdark'; $('toneSelect').value='grimdark'; syncTheme(); makeStoryboard(); };
  $('styleSelect').onchange=()=>{ syncTheme(); if(storyboard){ storyboard.style=$('styleSelect').value; } drawFrame(pausedAt); };
  $('toneSelect').onchange=()=>{ if(storyboard) setStatus('Tone changed. Regenerate the scene plan to apply it.'); };
  $('generateBtn').onclick=makeStoryboard;
  $('playBtn').onclick=play; $('pauseBtn').onclick=pause; $('resetBtn').onclick=reset;
  $('recordBtn').onclick=recordCanvas; $('recordTabBtn').onclick=recordTab;
  $('exportScriptBtn').onclick=exportScript; $('exportJsonBtn').onclick=exportJson;
  $('importJsonBtn').onclick=()=>$('jsonFileInput').click();
  $('jsonFileInput').onchange=(e)=>{ importFile(e.target.files[0]); e.target.value=''; };
  $('directorPromptBtn').onclick=copyDirectorPrompt;
  document.addEventListener('dragover', e=>{ if([...e.dataTransfer.items].some(i=>i.kind==='file')) e.preventDefault(); });
  document.addEventListener('drop', e=>{
    const f=[...e.dataTransfer.files].find(f=>/\.json$/i.test(f.name) || f.type==='application/json');
    if(f){ e.preventDefault(); importFile(f); }
  });
  $('timeline').oninput=seek; $('testVoiceBtn').onclick=testVoice;
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  loadVoices(); speechSynthesis.onvoiceschanged=loadVoices;
  syncTheme(); drawFrame(0);
  // ?storyboard=samples/foo.json opens straight into a saved storyboard (shareable links).
  const sbUrl = new URLSearchParams(location.search).get('storyboard');
  if(sbUrl) fetch(sbUrl).then(r=>{ if(!r.ok) throw new Error(r.status); return r.text(); })
    .then(t=>importText(t, sbUrl.split('/').pop()))
    .catch(err=>setStatus(`Could not load ${sbUrl}: ${err.message}`));
}
init();
