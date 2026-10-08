// ==UserScript==
// @name            Blade Sounds
// @description     Soft layered material sounds, distinct for every theme
// @author          Bobliks-Creations
// @include         main
// @version         2.0.1
// @loadOrder       20
// ==/UserScript==
(function () {
  if(window.BladeSounds)return;
  const PREF='blade.sounds.on', VOLUME='blade.sounds.volume', started=Date.now(), RATE=32000;
  // Modal body / muted excitation / a small room tail. No square or saw waves.
  const palettes={
    red:{name:'Лакированная сталь',base:430,modes:[1,2.07,3.42],weights:[1,.19,.055],decay:.058,attack:.003,brush:.035,cut:1900,space:.012,intervals:[1,1.25,1.5]},
    blood:{name:'Бархатный низкий удар',base:210,modes:[1,1.48,2.03],weights:[1,.26,.07],decay:.085,attack:.009,brush:.055,cut:760,space:.01,intervals:[1,1.19,1.5]},
    volt:{name:'Мягкий электрический импульс',base:570,modes:[1,1.99,2.98],weights:[1,.14,.04],decay:.06,attack:.007,brush:.018,cut:1650,space:.028,fm:.21,intervals:[1,1.5,2]},
    cherry:{name:'Дерево и щипок струны',base:660,modes:[1,2,3.01],weights:[1,.12,.035],decay:.102,attack:.005,brush:.018,cut:1250,space:.032,intervals:[1,1.125,1.5]},
    grey:{name:'Матовая механика',base:350,modes:[1,2.62,4.18],weights:[1,.095,.022],decay:.042,attack:.004,brush:.09,cut:1450,space:.004,intervals:[1,1.333,1.667]},
    orange:{name:'Тёплая керамика',base:465,modes:[1,1.52,2.69],weights:[1,.22,.04],decay:.073,attack:.006,brush:.042,cut:1100,space:.018,intervals:[1,1.25,1.667]},
    midnight:{name:'Глубокое стекло',base:330,modes:[1,1.5,2.01],weights:[1,.28,.085],decay:.126,attack:.014,brush:.004,cut:850,space:.11,intervals:[1,1.5,1.875]},
    green:{name:'Плавный цифровой сигнал',base:520,modes:[1,2,4],weights:[1,.045,.007],decay:.052,attack:.009,brush:0,cut:1100,space:.014,intervals:[1,1.5,1.333]},
    purple:{name:'Мягкий синтезатор',base:392,modes:[1,1.006,1.498],weights:[1,.3,.18],decay:.113,attack:.017,brush:.006,cut:1200,space:.065,fm:.055,intervals:[1,1.25,1.5]},
    custom:{name:'Нейтральный мягкий щелчок',base:390,modes:[1,1.94,2.9],weights:[1,.1,.025],decay:.064,attack:.008,brush:.025,cut:1000,space:.015,intervals:[1,1.25,1.5]},
  };
  const events={
    select:{length:.17,notes:[[0,1,1]],gain:.52},
    open:{length:.26,notes:[[0,.84,.75],[.045,1.12,.52]],gain:.65},
    close:{length:.22,notes:[[0,.88,1]],gain:.6},
    theme:{length:.52,notes:[[0,1,.65],[.08,0,.5],[.16,0,.38]],gain:.72},
    download:{length:.54,notes:[[0,1,.7],[.09,0,.43]],gain:.8},
    update:{length:.65,notes:[[0,1,.65],[.1,0,.55],[.2,0,.48],[.26,2,.16]],gain:.85},
  };
  let context=null,output=null,disposed=false,idleTimer=0,selectTimer=0,themeTimer=0,startTimer=0,flashTimer=0,tabQuietUntil=0;
  let downloadList=null,downloadView=null,played=0,lastPlayed=null;
  const cache=new Map(),voices=new Set();
  function theme(){const id=document.documentElement.getAttribute('data-blade-theme');return palettes[id]?id:'red';}
  function enabled(){return !disposed&&Services.prefs.getBoolPref(PREF,true)&&Services.prefs.getIntPref(VOLUME,100)>0;}
  function volume(){return Math.min(1,Math.max(0,Services.prefs.getIntPref(VOLUME,100)/100));}
  function quietGain(){
    let gain=1;
    if(Services.prefs.getBoolPref('blade.night',false))gain*=.65;
    if(Services.prefs.getBoolPref('blade.weather.rain',false)||Services.prefs.getBoolPref('blade.weather.snow',false))gain*=.88;
    try{if(ChromeUtils.importESModule('resource://gre/modules/PrivateBrowsingUtils.sys.mjs').PrivateBrowsingUtils.isWindowPrivate(window))gain*=.75;}catch(_e){}
    return gain;
  }
  function pcm(id,event){
    const palette=palettes[id]||palettes.red, action=events[event]||events.select;
    const data=new Float32Array(Math.ceil(RATE*action.length));
    let random=3217+Object.keys(palettes).indexOf(id)*617+Object.keys(events).indexOf(event)*107;
    function noise(){random=(Math.imul(random,1664525)+1013904223)|0;return (random>>>0)/2147483648-1;}
    for(let note=0;note<action.notes.length;note++){
      const [at,ratio,level]=action.notes[note];
      const pitch=ratio||palette.intervals[Math.min(note,2)];
      const base=palette.base*pitch,offset=Math.floor(at*RATE);
      const decay=palette.decay*(event==='close'?.72:event==='select'?.7:1.15);
      const attack=palette.attack, filter=1-Math.exp(-2*Math.PI*palette.cut/RATE);
      let air=0;
      for(let i=offset;i<data.length;i++){
        const t=(i-offset)/RATE;
        const envelope=(1-Math.exp(-t/attack))*Math.exp(-t/decay);
        const endFade=Math.min(1,(data.length-1-i)/(RATE*.018));
        const bend=event==='close'?-.075: event==='open'?.018:0;
        const phase=2*Math.PI*base*(t+bend*decay*(1-Math.exp(-t/decay)));
        const modulation=(palette.fm||0)*Math.sin(phase*1.997)*Math.exp(-t/.043);
        let body=0;
        for(let k=0;k<palette.modes.length;k++)body+=palette.weights[k]*Math.sin(phase*palette.modes[k]+modulation)*Math.exp(-t*k/.15);
        air+=filter*(noise()-air);
        const excitation=air*palette.brush*Math.exp(-t/.015)*(1-Math.exp(-t/.002));
        data[i]+=(body*envelope+excitation)*level*Math.max(0,endFade);
      }
    }
    // Quiet early reflections belong to the material, rather than a long echo.
    const dry=data.slice();
    for(const [delay,gain] of [[.027,palette.space],[.049,palette.space*.42]]){
      const offset=Math.floor(RATE*delay);for(let i=offset;i<data.length;i++)data[i]+=dry[i-offset]*gain;
    }
    let mean=0,peak=0;for(const value of data)mean+=value;mean/=data.length;
    for(let i=0;i<data.length;i++){data[i]-=mean;peak=Math.max(peak,Math.abs(data[i]));}
    const scale=.55/Math.max(.55,peak);
    for(let i=0;i<data.length;i++)data[i]*=scale*Math.min(1,i/(RATE*.002),(data.length-1-i)/(RATE*.012));
    return data;
  }
  function ensure(){
    if(!context||context.state==='closed'){
      context=new window.AudioContext();cache.clear();
      output=context.createGain();output.gain.value=.18*volume();output.connect(context.destination);
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
    return context;
  }
  function buffer(id,event){
    const key=id+':'+event;
    if(!cache.has(key)){
      const samples=pcm(id,event),buf=context.createBuffer(1,samples.length,RATE);buf.copyToChannel(samples,0);cache.set(key,buf);
    }
    return cache.get(key);
  }
  function release(voice){
    if(!voices.delete(voice))return;
    voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();
  }
  function fade(voice){
    try{const now=context.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,.005);voice.source.stop(now+.025);}catch(_e){release(voice);}
  }
  function planIdle(){
    if(idleTimer)window.clearTimeout(idleTimer);
    idleTimer=window.setTimeout(()=>{idleTimer=0;if(!voices.size&&context?.state==='running')context.suspend().catch(()=>{});},1800);
  }
  function play(event='select'){
    if(!enabled()||!events[event])return false;
    try{
      const c=ensure(),id=theme();
      if(voices.size>=3){fade(voices.values().next().value);return false;}
      const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer(id,event);
      gain.gain.value=quietGain()*events[event].gain;
      source.connect(gain);gain.connect(output);
      const voice={source,gain};voices.add(voice);source.onended=()=>{release(voice);planIdle();};
      source.start();played++;lastPlayed={theme:id,event};planIdle();return true;
    }catch(e){window.Blade?.mark('sounds','v2.0.1 ERR '+e);return false;}
  }
  function clearSelect(){if(selectTimer)window.clearTimeout(selectTimer);selectTimer=0;}
  function onSelect(){
    clearSelect();if(Date.now()-started<2500||performance.now()<tabQuietUntil)return;
    selectTimer=window.setTimeout(()=>{selectTimer=0;if(performance.now()>=tabQuietUntil)play('select');},45);
  }
  function tabAction(event){clearSelect();tabQuietUntil=performance.now()+120;if(Date.now()-started>=2500)play(event);}
  const onOpen=()=>tabAction('open'),onClose=()=>tabAction('close');
  function onTheme(){
    if(themeTimer)window.clearTimeout(themeTimer);clearSelect();
    themeTimer=window.setTimeout(()=>{themeTimer=0;play('theme');},180);
  }
  function windowFlash(){
    if(disposed)return;const root=document.documentElement;root.classList.add('blade-flash');
    if(flashTimer)window.clearTimeout(flashTimer);flashTimer=window.setTimeout(()=>{flashTimer=0;root.classList.remove('blade-flash');},900);
  }
  const prefsObserver={observe(){if(output&&context?.state!=='closed')output.gain.setTargetAtTime(.18*volume(),context.currentTime,.012);if(!enabled()){clearSelect();for(const voice of voices)fade(voice);planIdle();}}};
  Services.prefs.addObserver(PREF,prefsObserver);Services.prefs.addObserver(VOLUME,prefsObserver);
  const tabs=window.gBrowser?.tabContainer;
  tabs?.addEventListener('TabSelect',onSelect);tabs?.addEventListener('TabOpen',onOpen);tabs?.addEventListener('TabClose',onClose);
  window.Blade?.bus.on('theme:changed',onTheme);
  try{const windows=Services.wm.getEnumerator('navigator:browser');let count=0;while(windows.hasMoreElements()){windows.getNext();count++;}if(count<=1)startTimer=window.setTimeout(()=>{startTimer=0;play('theme');},900);}catch(_e){}
  (async()=>{
    try{
      const {Downloads}=ChromeUtils.importESModule('resource://gre/modules/Downloads.sys.mjs');
      const list=await Downloads.getList(Downloads.ALL);if(disposed)return;
      const seen=new WeakSet();
      const view={onDownloadChanged(download){
        if(!download?.succeeded||seen.has(download))return;seen.add(download);
        if(Services.wm.getMostRecentWindow('navigator:browser')===window){play('download');windowFlash();}
      }};
      downloadList=list;downloadView=view;await list.addView(view);
      if(disposed)await list.removeView(view);
    }catch(_e){}
  })();
  function destroy(){
    if(disposed)return;disposed=true;
    for(const timer of [idleTimer,selectTimer,themeTimer,startTimer,flashTimer])if(timer)window.clearTimeout(timer);
    tabs?.removeEventListener('TabSelect',onSelect);tabs?.removeEventListener('TabOpen',onOpen);tabs?.removeEventListener('TabClose',onClose);
    window.Blade?.bus.off('theme:changed',onTheme);Services.prefs.removeObserver(PREF,prefsObserver);Services.prefs.removeObserver(VOLUME,prefsObserver);
    if(downloadList&&downloadView){try{downloadList.removeView(downloadView);}catch(_e){}}
    for(const voice of [...voices]){try{voice.source.stop();}catch(_e){}release(voice);}
    document.documentElement.classList.remove('blade-flash');cache.clear();context?.close().catch(()=>{});
  }
  window.BladeSounds={play,ready:()=>Promise.resolve(!disposed),blip:()=>play('select'),shing:()=>play('theme'),fanfare:()=>play('update'),chime:()=>play('download'),windowFlash,destroy,
    status:()=>({theme:theme(),enabled:enabled(),volume:volume(),outputGain:output?.gain.value||0,context:context?.state||'none',active:voices.size,cached:cache.size,played,lastPlayed}),
    // Render the identical PCM for a preview without playing or opening a context.
    render:(id,event)=>({sampleRate:RATE,gain:.18*volume()*quietGain()*(events[event]||events.select).gain,data:pcm(palettes[id]?id:'red',events[event]?event:'select')}),
    palettes:()=>Object.fromEntries(Object.entries(palettes).map(([id,p])=>[id,p.name]))};
  window.addEventListener('unload',destroy,{once:true});window.Blade?.mark('sounds','v2.0.1 OK');
})();
