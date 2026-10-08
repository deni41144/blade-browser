// ==UserScript==
// @name            Blade Electric Arc
// @description     Short procedural plasma strikes, idle between events
// @include         main
// @version         1.0.0
// @loadOrder       94
// ==/UserScript==
(function () {
  if(window.BladeElectricArc)return;
  const controllers=new Set();
  function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let n=Math.imul(seed^seed>>>15,1|seed);n^=n+Math.imul(n^n>>>7,61|n);return((n^n>>>14)>>>0)/4294967296;};}
  function channel(from,to,roughness,rng,depth=5){
    let points=[from,to];
    for(let level=0;level<depth;level++){
      const result=[points[0]];
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
        const offset=(rng()-.5)*roughness*Math.pow(.53,level);
        const along=(rng()-.5)*.16;
        result.push({x:(a.x+b.x)/2-dy/len*offset+dx*along,y:(a.y+b.y)/2+dx/len*offset+dy*along},b);
      }
      points=result;
    }
    return points;
  }
  function create(canvas,{kind='clock'}={}){
    const context=canvas.getContext('2d',{alpha:true});
    let width=1,height=1,dpr=1,active=false,balanced=false,disposed=false,raf=0,timer=0,start=0,lastFrame=0;
    let variants=[],sequence=0,frames=0,strikes=0,lastCost=0,peakCost=0;
    canvas.setAttribute('aria-hidden','true');canvas.style.pointerEvents='none';
    function clear(){context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.setTransform(dpr,0,0,dpr,0,0);}
    function resize(w,h){
      const nextW=Math.max(1,Math.min(2048,Number(w)||1)),nextH=Math.max(1,Math.min(1400,Number(h)||1));
      const nextDpr=Math.min(2,window.devicePixelRatio||1);
      if(width===nextW&&height===nextH&&dpr===nextDpr)return;
      width=nextW;height=nextH;dpr=nextDpr;canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);
      context.setTransform(dpr,0,0,dpr,0,0);
      // The containing element follows layout; logical coordinates follow its
      // real CSS size. Resizing terminates a strike rather than stretching it.
      if(raf)window.cancelAnimationFrame(raf);raf=0;variants=[];clear();schedule();
    }
    function routes(rng){
      if(kind==='clock'){
        const inset=height*.17;
        return [
          [{x:width*.19,y:inset},{x:width*.4,y:height*.83}],
          [{x:width*.56,y:height*.79},{x:width*.79,y:height*.22}],
          [{x:width*.08,y:height*.6},{x:width*.93,y:height*.47}]
        ].slice(0,balanced?2:3);
      }
      const right=rng()>.5,x=right?width*.94:width*.055,dir=right?-1:1;
      const y=height*(.16+rng()*.49),reach=Math.min(230,width*.19);
      const primary=[{x,y},{x:x+dir*reach,y:y+height*.13}];
      return balanced?[primary]:[primary,[{x:width-x,y:height*.8-y*.2},{x:width-x-dir*reach*.65,y:height*.8-y*.2-90}]];
    }
    function makeVariants(){
      const rng=random(++sequence*27191+Math.floor(Math.random()*0xffffff));
      const paths=routes(rng);
      return [0,1,2].map(()=>paths.map(([from,to])=>{
        const distance=Math.hypot(to.x-from.x,to.y-from.y);
        const points=channel(from,to,Math.min(kind==='clock'?height*.65:68,distance*.48),rng,6);
        const branches=[];
        for(const index of balanced?[19,43]:[13,29,47]){
          const anchor=points[index],direction=rng()>.5?1:-1,length=distance*(.12+rng()*.12);
          const end={x:anchor.x+(rng()-.5)*length,y:anchor.y+direction*length*.75};
          branches.push(channel(anchor,end,length*.38,rng,4));
        }
        return {points,branches,from,to};
      }));
    }
    function trace(points,reveal,jitter){
      const count=Math.max(2,Math.min(points.length,Math.ceil(points.length*reveal)));
      context.beginPath();context.moveTo(points[0].x,points[0].y);
      for(let i=1;i<count;i++){
        const p=points[i],shake=Math.sin(i*2.31+frames*.77)*jitter;
        context.lineTo(p.x+shake,p.y-shake*.6);
      }
    }
    function stroke(points,reveal,jitter,color,lineWidth,alpha,glow=0){
      trace(points,reveal,jitter);context.strokeStyle=color;context.lineWidth=lineWidth;context.globalAlpha=alpha;
      context.shadowBlur=glow*dpr;context.shadowColor='#d4ff2f';context.stroke();context.shadowBlur=0;
    }
    function corona(point,intensity,time){
      const radius=kind==='clock'?12:16;
      const gradient=context.createRadialGradient(point.x,point.y,0,point.x,point.y,radius);
      gradient.addColorStop(0,'rgba(255,255,213,.8)');gradient.addColorStop(.18,'rgba(236,255,69,.45)');gradient.addColorStop(1,'rgba(196,238,24,0)');
      context.globalAlpha=intensity*.55;context.fillStyle=gradient;context.fillRect(point.x-radius,point.y-radius,radius*2,radius*2);
      // Short angular contact sparks, without a travelling head or long tail.
      for(let i=0;i<4;i++){
        const angle=i*1.67+sequence*.8,r=3+(time%90)/18;
        context.beginPath();context.moveTo(point.x+Math.cos(angle)*r,point.y+Math.sin(angle)*r);
        context.lineTo(point.x+Math.cos(angle+.09)*(r+2),point.y+Math.sin(angle+.09)*(r+2));
        context.globalAlpha=intensity*.6;context.strokeStyle='#fff2a3';context.lineWidth=.7;context.stroke();
      }
    }
    function paint(elapsed){
      clear();
      const stage=elapsed<170?0:elapsed<350?1:2;
      // The ionisation leader advances first; two shorter re-strikes find a
      // different path. Blank intervals break up the otherwise continuous arc.
      let strength=elapsed<110?.32:elapsed<180?1:elapsed<230?.42:elapsed<270?0:elapsed<350?.95:elapsed<410?.15:elapsed<475?.7:Math.max(0,(650-elapsed)/175)*.28;
      const reveal=elapsed<110?Math.min(1,.12+elapsed/95):1;
      context.lineCap='round';context.lineJoin='round';context.globalCompositeOperation='source-over';
      for(const bolt of variants[stage]||[]){
        const jitter=.35+Math.sin(elapsed*.04)*.25;
        // Low-opacity corona, saturated conducting body, crisp hot filament.
        stroke(bolt.points,reveal,jitter,'#c1ec23',kind==='clock'?3.4:4.1,strength*.18,7);
        stroke(bolt.points,reveal,jitter,'#e5ff56',1.65,strength*.68);
        stroke(bolt.points,reveal,jitter,'#fffbd5',.6,strength);
        for(const branch of bolt.branches){
          stroke(branch,Math.max(0,(reveal-.3)/.7),jitter*.8,'#bfe950',.85,strength*.44);
          stroke(branch,Math.max(0,(reveal-.5)/.5),jitter*.5,'#f4ffb2',.35,strength*.65);
        }
        if(elapsed>100){corona(bolt.from,strength,elapsed);corona(bolt.to,strength,elapsed);}
      }
      context.globalAlpha=1;
    }
    function schedule(){
      if(!active||disposed||timer)return;
      timer=window.setTimeout(()=>{timer=0;strike();},(kind==='clock'?5100:7100)+(balanced?2400:0)+Math.random()*2300);
    }
    function frame(now){
      if(!active||disposed){raf=0;clear();return;}
      const elapsed=now-start;
      if(elapsed>=650){raf=0;clear();schedule();return;}
      if(now-lastFrame>=1000/(balanced?24:30)){
        lastFrame=now;const before=performance.now();paint(elapsed);lastCost=performance.now()-before;peakCost=Math.max(peakCost,lastCost);frames++;
      }
      raf=window.requestAnimationFrame(frame);
    }
    function strike(){
      if(!active||disposed||raf)return false;
      if(timer){window.clearTimeout(timer);timer=0;}
      variants=makeVariants();strikes++;start=performance.now();lastFrame=0;raf=window.requestAnimationFrame(frame);return true;
    }
    function setActive(value,options={}){
      balanced=Boolean(options.balanced);
      const next=Boolean(value)&&!disposed;
      if(next===active)return;
      active=next;
      if(active){schedule();}else{
        if(timer)window.clearTimeout(timer);if(raf)window.cancelAnimationFrame(raf);timer=raf=0;variants=[];clear();
      }
    }
    function destroy(){if(disposed)return;setActive(false);disposed=true;controllers.delete(api);canvas.width=canvas.height=1;}
    const api={resize,setActive,strike,destroy,state:()=>({kind,active,burst:Boolean(raf),scheduled:Boolean(timer),width,height,dpr,strikes,frames,lastCost,peakCost})};
    controllers.add(api);return api;
  }
  window.BladeElectricArc={create,status:()=>[...controllers].map(c=>c.state()),destroy:()=>{for(const c of [...controllers])c.destroy();}};
  window.addEventListener('unload',()=>window.BladeElectricArc.destroy(),{once:true});
  window.Blade?.mark('electric_arc','v1.0.0 OK');
})();
