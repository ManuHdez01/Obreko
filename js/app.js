
(function(){
  var started = false;
  function startIntro(){
    if(started) return;
    started = true;
    document.getElementById('iaLogo').classList.add('ia-go');
    document.getElementById('geoIntro').classList.add('ia-go');
    document.getElementById('geoIntroLoc').classList.add('ia-go');
    document.getElementById('iaBar').classList.add('ia-go');
  }
  // Timeout de seguridad: si la fuente no carga en 2s, arranca igualmente
  var fallback = setTimeout(startIntro, 2000);
  if(document.fonts && document.fonts.load){
    document.fonts.load('italic 400 1em "Playfair Display"').then(function(){
      clearTimeout(fallback);
      startIntro();
    }).catch(function(){
      clearTimeout(fallback);
      startIntro();
    });
  } else {
    clearTimeout(fallback);
    startIntro();
  }
})();



// ── INTRO ──
setTimeout(function(){
  document.getElementById('introAnim').classList.add('out');
  setTimeout(function(){document.getElementById('introAnim').style.display='none';},700);
  // Asegurar que el vídeo hero arranca tras el intro
  var hv=document.querySelector('#page-home .hero-vid video');
  if(hv){hv.play().catch(function(){});}
},2000);


// ── NAV ──
function updateNav(){
  var n=document.getElementById('nav');
  var hero=document.querySelector('.page.active .hero,.page.active .svc-hero');
  if(!hero){n.className='';var ap=document.querySelector('.page.active');var darkPg=ap&&(ap.id==='page-presupuesto'||ap.id==='page-reclamaciones');n.classList.add(darkPg?'solid':'light');if(window._navObs){window._navObs.disconnect();}return;}
  if(window._navObs){window._navObs.disconnect();}
  window._navObs=new IntersectionObserver(function(entries){
    var below=entries[0].isIntersecting;
    n.classList.toggle('solid',below);
    n.classList.toggle('light',!below);
  },{rootMargin:'-70px 0px 0px 0px',threshold:0});
  window._navObs.observe(hero);
}
updateNav();

// ── NAVEGACIÓN ENTRE PÁGINAS ──
var _history=['home'];
function stopAllAudio(){
  if(window._stopSb1)window._stopSb1();
  if(window._stopSb2)window._stopSb2();
}
// Carga lazy del soundbar (contiene los blobs base64 del audio). Solo se descarga
// al entrar en #page-hogar, donde vive el reproductor.
var _sbPromise=null;
function ensureSoundbar(){
  if(_sbPromise)return _sbPromise;
  _sbPromise=new Promise(function(resolve,reject){
    var s=document.createElement('script');
    s.src='/js/soundbar.js?v=2';
    s.async=true;
    s.onload=function(){resolve();};
    s.onerror=function(e){_sbPromise=null;reject(e);};
    document.head.appendChild(s);
  });
  return _sbPromise;
}
// Mensajes WA por servicio
var WA_MSGS={
  'home':     'Hola%20obreko%2C%20me%20gustar%C3%ADa%20solicitar%20informaci%C3%B3n',
  'obras':    'Hola%20obreko%2C%20me%20gustar%C3%ADa%20solicitar%20presupuesto%20para%20una%20obra%20o%20proyecto',
  'reforma':  'Hola%20obreko%2C%20me%20gustar%C3%ADa%20solicitar%20presupuesto%20para%20una%20reforma%20integral',
  'manitas':  'Hola%20obreko%2C%20necesito%20un%20servicio%20de%20manitas%20o%20urgencia%20en%20casa',
  'mantenimiento':'Hola%20obreko%2C%20me%20interesa%20un%20plan%20de%20mantenimiento%20para%20mi%20inmueble',
  'hogar':    'Hola%20obreko%2C%20me%20gustar%C3%ADa%20informaci%C3%B3n%20sobre%20hogar%20conectado%20y%20dom%C3%B3tica',
  'unete':    'Hola%20obreko%2C%20me%20gustar%C3%ADa%20unirme%20al%20equipo%20profesional',
  'presupuesto':'Hola%20obreko%2C%20quiero%20solicitar%20un%20presupuesto',
  'reclamaciones':'Hola%20obreko%2C%20quiero%20gestionar%20una%20reclamaci%C3%B3n%20o%20sugerencia',
};
function updateWA(page){
  var btn=document.getElementById('waBtn');
  if(!btn)return;
  var msg=WA_MSGS[page]||WA_MSGS['home'];
  btn.href='javascript:void(0)';
  btn.onclick=function(){window.open('https://wa.me/34698900623?text='+msg,'_blank','noopener');};
}

// ── WHATSAPP MOSTRAR AL BAJAR ──
(function(){
  var wrap=document.getElementById('waWrap');
  if(!wrap)return;
  var isHome=true;

  // ── Estado de secciones en home que ocultan WA ──
  var _secVis={proceso:false,testi:false};
  function _applySectionHide(){
    if(_secVis.proceso||_secVis.testi){
      wrap.classList.add('wa-section-hidden');
    } else {
      wrap.classList.remove('wa-section-hidden');
    }
  }
  function _clearSectionState(){
    _secVis.proceso=false;
    _secVis.testi=false;
    wrap.classList.remove('wa-section-hidden');
  }

  // Observar section.proceso y section.testi dentro de home
  var _homeProceso=document.querySelector('#page-home .proceso');
  var _homeTesti=document.querySelector('#page-home .testi');
  if(_homeProceso){
    new IntersectionObserver(function(entries){
      _secVis.proceso=entries[0].isIntersecting;
      if(isHome)_applySectionHide();
    },{threshold:0}).observe(_homeProceso);
  }
  if(_homeTesti){
    new IntersectionObserver(function(entries){
      _secVis.testi=entries[0].isIntersecting;
      if(isHome)_applySectionHide();
    },{threshold:0}).observe(_homeTesti);
  }

  // Footer observer: oculta el botón cuando el footer es visible
  var footer=document.querySelector('.footer');
  if(footer){
    new IntersectionObserver(function(entries){
      if(entries[0].isIntersecting){wrap.classList.add('wa-at-footer');}
      else{wrap.classList.remove('wa-at-footer');}
    },{threshold:0}).observe(footer);
  }

  // Sentinel en home: muestra WA al bajar del hero
  var sentinel=document.getElementById('waSentinel');
  if(sentinel){
    new IntersectionObserver(function(entries){
      if(!isHome){return;}
      if(!entries[0].isIntersecting){
        wrap.classList.add('wa-visible');
        _applySectionHide(); // re-evaluar secciones visibles
      } else {
        wrap.classList.remove('wa-visible');
        wrap.classList.remove('wa-section-hidden');
      }
    },{threshold:0}).observe(sentinel);
  }

  // Páginas donde WA se oculta completamente
  var WA_HIDDEN_PAGES=['nosotros','proceso','testi','unete','presupuesto','reclamaciones'];
  // Páginas de servicio (ocultar solo en el hero)
  var WA_SVC_PAGES=['obras','reforma','manitas','mantenimiento','hogar'];

  window._waSetPage=function(page){
    isHome=(page==='home');
    _clearSectionState();
    // Limpiar scroll listener anterior
    if(window._svcScroll){
      window.removeEventListener('scroll',window._svcScroll,{passive:true});
      window._svcScroll=null;
    }
    document.body.classList.remove('wa-svc-hero','wa-page-hidden');
    wrap.classList.remove('wa-visible','wa-at-footer');
    wrap.style.removeProperty('display');

    if(WA_HIDDEN_PAGES.indexOf(page)!==-1){
      // Ocultar WA completamente: display none + clase por si acaso
      document.body.classList.add('wa-page-hidden');
      wrap.style.setProperty('display','none','important');

    } else if(WA_SVC_PAGES.indexOf(page)!==-1){
      // Ocultar WA en el hero del servicio, mostrar al hacer scroll
      document.body.classList.add('wa-svc-hero');
      var heroH=window.innerHeight;
      window._svcScroll=function(){
        if(window.scrollY>heroH*0.7){
          document.body.classList.remove('wa-svc-hero');
          window.removeEventListener('scroll',window._svcScroll,{passive:true});
          window._svcScroll=null;
        }
      };
      window.addEventListener('scroll',window._svcScroll,{passive:true});

    }
    // else home: el sentinel y las section-observers lo gestionan
  };
  // Compatibilidad con llamadas antiguas
  window._waSetHome=function(v){window._waSetPage(v?'home':'_svc');}
})();


// ── WHATSAPP TOOLTIP ──
(function(){
  var tip=document.getElementById('waTip');
  var wrap=document.getElementById('waWrap');
  if(!tip||!wrap)return;
  var autoTimer=null;
  // Muestra 10 s al cargar
  function showTip(){tip.classList.add('show');}
  function hideTip(){tip.classList.remove('show');}
  setTimeout(showTip,1200); // pequeña espera tras intro
  autoTimer=setTimeout(hideTip,11200); // 10 s visibles
  // Hover: muestra/oculta manteniendo o cancelando el auto-hide
  wrap.addEventListener('mouseenter',function(){
    clearTimeout(autoTimer);
    showTip();
  });
  wrap.addEventListener('mouseleave',function(){
    hideTip();
  });
})();

// Siempre arrancar desde el top al cargar
if('scrollRestoration' in history){history.scrollRestoration='manual';}
window.scrollTo(0,0);

// Scroll progress bar
// ── MOBILE: usa poster como fondo en lugar de video ──
if(window.innerWidth<=700){
  document.querySelectorAll('.svc-hero-vid').forEach(function(div){
    var v=div.querySelector('video');
    if(v&&v.getAttribute('poster')){
      div.style.backgroundImage='url('+v.getAttribute('poster')+')';
      div.style.backgroundSize='cover';
      div.style.backgroundPosition='center';
    }
  });
}

(function(){
  var bar = document.getElementById('scrollBar');
  var track = document.getElementById('scrollTrack');
  if(!bar || !track) return;
  var _sbTotal = document.documentElement.scrollHeight - window.innerHeight;
  var _sbVH = window.innerHeight;
  function updateScrollBar(){
    var scrolled = window.scrollY || document.documentElement.scrollTop;
    var pct = _sbTotal > 0 ? scrolled / _sbTotal : 0;
    bar.style.height = Math.round(pct * _sbVH) + 'px';
  }
  function recalcScrollBar(){
    _sbTotal = document.documentElement.scrollHeight - window.innerHeight;
    _sbVH = window.innerHeight;
    updateScrollBar();
  }
  window.addEventListener('scroll', updateScrollBar, {passive:true});
  window.addEventListener('resize', recalcScrollBar, {passive:true});
  updateScrollBar();
})();


// Seed browser history so swipe-back stays inside the SPA
history.replaceState({page:'home'},'','');
window.addEventListener('popstate',function(e){
  var page=(e.state&&e.state.page)||'home';
  // Sync our internal history
  if(_history.length>1&&_history[_history.length-1]!==page)_history.pop();
  _navCore(page,false);
});
// Monta <source data-src=...> y <img data-src=...>/<img data-srcset=...>
// la primera vez que se navega a una p\u00e1gina. Evita fetches en p\u00e1ginas ocultas.
function mountLazyAssets(pageEl){
  if(!pageEl||pageEl._srcMounted)return;
  var vids=pageEl.querySelectorAll('video');
  for(var i=0;i<vids.length;i++){
    var v=vids[i], srcs=v.querySelectorAll('source[data-src]'), changed=false;
    for(var j=0;j<srcs.length;j++){
      var s=srcs[j], u=s.getAttribute('data-src');
      if(u){s.setAttribute('src',u);s.removeAttribute('data-src');changed=true;}
    }
    if(changed){try{v.load();}catch(e){}}
  }
  var imgs=pageEl.querySelectorAll('img[data-src],img[data-srcset]');
  for(var k=0;k<imgs.length;k++){
    var im=imgs[k];
    var ss=im.getAttribute('data-srcset');
    if(ss){im.setAttribute('srcset',ss);im.removeAttribute('data-srcset');}
    var sr=im.getAttribute('data-src');
    if(sr){im.setAttribute('src',sr);im.removeAttribute('data-src');}
  }
  pageEl._srcMounted=true;
}
// Compat: nombre antiguo
var mountVideoSources=mountLazyAssets;
function _navCore(page,pushState){
  stopAllAudio();
  var cur=document.querySelector('.page.active');
  var next=document.getElementById('page-'+page);
  if(!next||cur===next)return;
  mountLazyAssets(next);
  cur.classList.remove('active','pg-enter','pg-return');
  next.classList.remove('pg-enter','pg-return');
  next.classList.add('active');
  next.offsetWidth;
  if(page==='home'){
    next.classList.add('pg-return');
    var hv=next.querySelector('.hero-vid video');
    if(hv){hv.play().catch(function(){});}
  } else{next.classList.add('pg-enter');}
  window.scrollTo({top:0,behavior:'instant'});
  // nav links activos
  document.querySelectorAll('.n-link').forEach(function(b){b.classList.remove('on');});
  var mp={obras:0,reforma:1,manitas:2,mantenimiento:3,hogar:4};
  if(mp[page]!==undefined){var ls=document.querySelectorAll('.n-link');if(ls[mp[page]])ls[mp[page]].classList.add('on');}
  setTimeout(initReveals,60);
  setTimeout(initCounters,80);
  if(page==='hogar'){ensureSoundbar();setTimeout(initHogar,120);}
  setTimeout(function(){
    var vids=next.querySelectorAll('video');
    vids.forEach(function(v){v.play().catch(function(){});});
  },100);
  updateNav();
  updateWA(page);
  if(window._waSetPage)window._waSetPage(page);
  closeMenu();
  if(pushState)history.pushState({page:page},'','');
}
function nav(page){
  if(_history.length&&_history[_history.length-1]===page)return;
  _history.push(page);
  _navCore(page,true);
}

// ── STOP AUDIO AL SALIR DE HOGAR CONECTADO ──
(function(){
  var hc=document.querySelector('.hc-scene');
  if(!hc||!window.IntersectionObserver)return;
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting)stopAllAudio();
    });
  },{threshold:0});
  obs.observe(hc);
})();

// ── MEGA MENÚ ──
var _mm=document.getElementById('megaMenu');
function openMenu(){
  _mm.offsetWidth;
  _mm.classList.add('open');
  document.body.style.overflow='hidden';
  mmSel('servicios');
}
function closeMenu(){
  _mm.classList.remove('open');
  document.body.style.overflow='';
}
function mmSel(id){
  document.querySelectorAll('.mm-main:not(.direct)').forEach(function(b){b.classList.remove('on');});
  document.querySelectorAll('.mm-panel').forEach(function(p){p.classList.remove('on');});
  var mp={servicios:[0,'mmServicios'],como:[1,'mmComo'],contacto:[2,'mmContacto']};
  if(!mp[id])return;
  var btns=document.querySelectorAll('.mm-main:not(.direct)');
  if(btns[mp[id][0]])btns[mp[id][0]].classList.add('on');
  var panel=document.getElementById(mp[id][1]);
  if(panel)panel.classList.add('on');
}
function mmClear(){
  document.querySelectorAll('.mm-main:not(.direct)').forEach(function(b){b.classList.remove('on');});
  document.querySelectorAll('.mm-panel').forEach(function(p){p.classList.remove('on');});
}
document.getElementById('nBurger').addEventListener('click',openMenu);

// ── FORMULARIO ÚNETE AL EQUIPO ──
function showFileName(input){
  var lbl=document.getElementById('cvLabel');
  if(!lbl)return;
  lbl.textContent=input.files.length?'📎 '+input.files[0].name:'Haz clic para adjuntar tu CV';
}
function submitUnete(e){
  e.preventDefault();
  var form=e.target;
  var btn=form.querySelector('button[type=submit]');
  btn.disabled=true;
  btn.textContent='Enviando…';
  var data=new FormData(form);
  fetch('https://formspree.io/f/xzdklzvg',{method:'POST',body:data,headers:{Accept:'application/json'}})
    .then(function(r){
      if(r.ok){
        form.reset();
        document.getElementById('cvLabel').textContent='Haz clic para adjuntar tu CV';
        document.getElementById('uneteOk').style.display='block';
        btn.style.display='none';
      } else {
        btn.disabled=false;
        btn.textContent='Enviar candidatura →';
        alert('Error al enviar. Inténtalo de nuevo o escríbenos a hola@obreko.com');
      }
    })
    .catch(function(){
      btn.disabled=false;
      btn.textContent='Enviar candidatura →';
      alert('Error de conexión. Escríbenos directamente a hola@obreko.com');
    });
}
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeMenu();closeLegal();}});

// ── REVEALS ──
var _io=null;
function initReveals(){
  if(_io)_io.disconnect();
  _io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('in');_io.unobserve(e.target);}
    });
  },{threshold:0.08,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.page.active .rv:not(.in),.page.active .rv-h:not(.in)').forEach(function(el){_io.observe(el);});
}
initReveals();

// ── CONTADORES ──
var _cio=null;
function initCounters(){
  if(_cio)_cio.disconnect();
  _cio=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting)return;
      var el=e.target;
      var orig=el.dataset.orig||(el.dataset.orig=el.textContent.trim());
      var num=parseInt(orig.replace(/[^0-9]/g,''));
      if(isNaN(num)||num===0){el.textContent=orig;return;}
      var sfx=orig.replace(/[0-9]/g,'');
      var v=0,inc=Math.ceil(num/55);
      clearInterval(el._ct);
      el._ct=setInterval(function(){v=Math.min(v+inc,num);el.textContent=v+sfx;if(v>=num)clearInterval(el._ct);},16);
      _cio.unobserve(el);
    });
  },{threshold:0.6});
  document.querySelectorAll('.page.active [data-target]').forEach(function(el){_cio.observe(el);});
}
initCounters();

// ── RADIAL NETWORK + TOD ──
(function(){
  var canvas=document.querySelector('.why-canvas');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var section=canvas.closest('.hc-why');
  var W,H,t=0,started=false,spokes=[],mx=-1,my=-1;
  var N=90;

  var TODS={
    dawn:   {bg:'linear-gradient(180deg,#020510 0%,#060a20 40%,#0d1040 100%)',  tc:[80,120,220]},
    sunrise:{bg:'linear-gradient(180deg,#0a0d30 0%,#6b2080 35%,#c04010 70%,#e88020 100%)', tc:[230,130,80]},
    day:    {bg:'linear-gradient(180deg,#0a3a6e 0%,#0e5ca0 40%,#1a7bc4 75%,#4aaad8 100%)', tc:[100,210,255]},
    sunset: {bg:'linear-gradient(180deg,#0a1030 0%,#6b2000 35%,#c04010 65%,#e07010 100%)', tc:[220,140,40]},
    dusk:   {bg:'linear-gradient(180deg,#050810 0%,#380018 30%,#780018 60%,#b03808 100%)', tc:[200,80,60]},
    night:  {bg:'linear-gradient(180deg,#010204 0%,#02040c 40%,#050a18 100%)',  tc:[50,70,180]}
  };
  var curTod='day';

  function setTod(id){
    curTod=id;
    section.style.setProperty('--tod-bg',TODS[id].bg);
    section.querySelectorAll('.why-tod-btn').forEach(function(b){
      b.classList.toggle('active',b.dataset.tod===id);
    });
  }

  function init(){
    spokes=[];
    var cx=W/2, cy=H*1.08;
    for(var i=0;i<N;i++){
      var frac=i/(N-1);
      var angle=Math.PI+frac*Math.PI;
      var len=(0.32+Math.random()*0.58)*Math.max(W,H);
      spokes.push({cx:cx,cy:cy,angle:angle,len:len,
        phase:Math.random()*Math.PI*2,
        speed:0.22+Math.random()*0.38,
        alpha:0.15+Math.random()*0.5,
        width:0.4+Math.random()*0.5});
    }
  }

  function resize(){W=canvas.width=section.offsetWidth;H=canvas.height=section.offsetHeight;init();}

  function draw(){
    ctx.clearRect(0,0,W,H);
    t+=0.006;
    var c=TODS[curTod].tc;
    var i,s,prog,ex,ey,dx,dy,ctrlX,ctrlY,ddx,ddy,dd,force;
    for(i=0;i<spokes.length;i++){
      s=spokes[i];
      s.phase+=s.speed*0.008;
      prog=0.5+Math.sin(s.phase)*0.5;
      ex=s.cx+Math.cos(s.angle)*s.len;
      ey=s.cy+Math.sin(s.angle)*s.len;
      dx=s.cx+Math.cos(s.angle)*s.len*prog;
      dy=s.cy+Math.sin(s.angle)*s.len*prog;

      // Control point for bezier (midpoint, deflected by mouse)
      ctrlX=(s.cx+ex)/2; ctrlY=(s.cy+ey)/2;
      var near=0;
      if(mx>=0){
        ddx=ctrlX-mx; ddy=ctrlY-my;
        dd=Math.sqrt(ddx*ddx+ddy*ddy);
        if(dd<220&&dd>0){
          near=Math.pow((220-dd)/220,1.5);
          force=near*180;
          ctrlX+=ddx/dd*force; ctrlY+=ddy/dd*force;
        }
        // Also check the endpoint proximity for extra pull
        var edx=ex-mx,edy=ey-my,ed=Math.sqrt(edx*edx+edy*edy);
        if(ed<180&&ed>0){var ef=(180-ed)/180*100;ctrlX+=edx/ed*ef;ctrlY+=edy/ed*ef;near=Math.max(near,(180-ed)/180);}
      }

      var lineAlpha=s.alpha*0.2+near*0.35;
      var activeAlpha=s.alpha*0.75+near*0.5;
      var nodeR=1.5+near*3.5;

      // Full line (faint, glows near cursor)
      ctx.beginPath();ctx.moveTo(s.cx,s.cy);
      ctx.quadraticCurveTo(ctrlX,ctrlY,ex,ey);
      ctx.strokeStyle='rgba('+c+','+lineAlpha+')';
      ctx.lineWidth=s.width+near*1.5;ctx.stroke();

      // Active segment (origin → travelling dot)
      var ctrlXp=s.cx+(ctrlX-s.cx)*prog, ctrlYp=s.cy+(ctrlY-s.cy)*prog;
      ctx.beginPath();ctx.moveTo(s.cx,s.cy);
      ctx.quadraticCurveTo(ctrlXp,ctrlYp,dx,dy);
      ctx.strokeStyle='rgba('+c+','+activeAlpha+')';
      ctx.lineWidth=s.width+near*2;ctx.stroke();

      // Travelling node (grows near cursor)
      ctx.beginPath();ctx.arc(dx,dy,nodeR,0,6.283);
      ctx.fillStyle='rgba('+c+','+(s.alpha+near*0.6)+')';ctx.fill();
      if(near>0.3){
        ctx.beginPath();ctx.arc(dx,dy,nodeR+3,0,6.283);
        ctx.fillStyle='rgba('+c+','+(near*0.25)+')';ctx.fill();
      }
    }

    // Origin glow
    var g=ctx.createRadialGradient(W/2,H*1.08,0,W/2,H*1.08,100);
    g.addColorStop(0,'rgba('+c+',.3)');g.addColorStop(1,'rgba('+c+',0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    requestAnimationFrame(draw);
  }

  var _aio=new IntersectionObserver(function(e){
    if(e[0].isIntersecting&&!started){started=true;resize();setTod('day');draw();_aio.disconnect();}
  },{threshold:0.01});
  _aio.observe(canvas);

  section.addEventListener('mousemove',function(e){
    var r=section.getBoundingClientRect();
    mx=e.clientX-r.left;my=e.clientY-r.top;
    section.style.setProperty('--sp-x',((mx/r.width)*100).toFixed(1)+'%');
    section.style.setProperty('--sp-y',((my/r.height)*100).toFixed(1)+'%');
    section.dataset.sp='1';
  });
  section.addEventListener('mouseleave',function(){mx=my=-1;delete section.dataset.sp;});
  section.addEventListener('touchmove',function(e){
    var r=section.getBoundingClientRect(),t0=e.touches[0];
    mx=t0.clientX-r.left;my=t0.clientY-r.top;
  },{passive:true});
  section.addEventListener('touchend',function(){mx=my=-1;});
  section.addEventListener('click',function(e){
    var btn=e.target.closest('.why-tod-btn');
    if(btn)setTod(btn.dataset.tod);
  });
  window.addEventListener('resize',function(){if(started)resize();});
})();

// ── ÚNETE ROWS CANVAS (horizontal lines) ──
(function(){
  var canvas=document.querySelector('.unete-rows-canvas');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var section=canvas.closest('.unete-rows-wrap');
  var W,H,started=false,lines=[],mx=-1,my=-1;
  var N=22,TC=[100,210,255];

  var PALETTES=[
    {bg:'linear-gradient(180deg,#0a3a6e 0%,#0e5ca0 40%,#1a7bc4 75%,#4aaad8 100%)',tc:[100,210,255]},
    {bg:'linear-gradient(180deg,#0a0d30 0%,#6b2080 35%,#c04010 70%,#e88020 100%)',tc:[230,130,80]},
    {bg:'linear-gradient(180deg,#020510 0%,#060a20 40%,#0d1040 100%)',             tc:[80,120,220]},
    {bg:'linear-gradient(180deg,#0a1030 0%,#6b2000 35%,#c04010 65%,#e07010 100%)',tc:[220,140,40]},
    {bg:'linear-gradient(180deg,#050810 0%,#380018 30%,#780018 60%,#b03808 100%)',tc:[200,80,60]},
    {bg:'linear-gradient(180deg,#010204 0%,#02040c 40%,#050a18 100%)',             tc:[50,70,180]}
  ];
  var palIdx=0;
  function nextPalette(){
    palIdx=(palIdx+1)%PALETTES.length;
    TC=PALETTES[palIdx].tc;
    section.style.background=PALETTES[palIdx].bg;
  }

  function init(){
    lines=[];
    for(var i=0;i<N;i++){
      var y=H*(0.05+i/(N-1)*0.9);
      lines.push({
        y:y,
        nodeX:-Math.random()*W,        // nodo empieza fuera por la izquierda
        speed:0.4+Math.random()*1.2,   // píxeles por frame
        alpha:0.1+Math.random()*0.4,
        width:0.3+Math.random()*0.7,
        ctrlOff:0                       // desplazamiento vertical del control bezier
      });
    }
  }

  function resize(){W=canvas.width=section.offsetWidth;H=canvas.height=section.offsetHeight;init();}

  function draw(){
    ctx.clearRect(0,0,W,H);
    var c=TC;
    for(var i=0;i<lines.length;i++){
      var l=lines[i];
      l.nodeX+=l.speed;
      if(l.nodeX>W+20)l.nodeX=-20;

      // Deflexión: el punto de control sigue al ratón si está cerca de la línea
      var ctrlX=W/2, ctrlY=l.y;
      var near=0;
      if(mx>=0){
        // Distancia vertical del ratón a la línea (más sensible)
        var dy=l.y-my;
        var distV=Math.abs(dy);
        if(distV<160){
          // Influencia proporcional a la proximidad vertical y horizontal
          var distH=Math.abs(ctrlX-mx);
          var influence=Math.pow((160-distV)/160,1.2)*(1-Math.min(distH/W,1)*0.5);
          near=influence;
          // El control point se acerca al ratón en Y con mucha fuerza
          ctrlY=l.y+(my-l.y)*influence*0.85;
          // También se desplaza en X hacia el ratón
          ctrlX=W/2+(mx-W/2)*influence*0.3;
        }
      }

      // Línea completa (tenue)
      ctx.beginPath();
      ctx.moveTo(0,l.y);
      ctx.quadraticCurveTo(ctrlX,ctrlY,W,l.y);
      ctx.strokeStyle='rgba('+c+','+(l.alpha*0.22+near*0.3)+')';
      ctx.lineWidth=l.width+near*1.2;
      ctx.stroke();

      // Segmento activo hasta el nodo
      var prog=Math.max(0,Math.min(1,l.nodeX/W));
      if(prog>0&&prog<1){
        var cpx=W/2+(ctrlX-W/2)*prog;
        var cpy=l.y+(ctrlY-l.y)*prog;
        var nx2=l.nodeX, ny2=l.y+(ctrlY-l.y)*4*prog*(1-prog);
        ctx.beginPath();
        ctx.moveTo(0,l.y);
        ctx.quadraticCurveTo(cpx,cpy,nx2,ny2);
        ctx.strokeStyle='rgba('+c+','+(l.alpha*0.85+near*0.45)+')';
        ctx.lineWidth=l.width+near*2;
        ctx.stroke();

        // Nodo viajero
        var nr=2+near*4;
        ctx.beginPath();ctx.arc(nx2,ny2,nr,0,6.283);
        ctx.fillStyle='rgba('+c+','+(l.alpha+near*0.6)+')';
        ctx.fill();
        if(near>0.15){
          ctx.beginPath();ctx.arc(nx2,ny2,nr+5,0,6.283);
          ctx.fillStyle='rgba('+c+','+(near*0.18)+')';ctx.fill();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  var _obs=new IntersectionObserver(function(e){
    if(e[0].isIntersecting&&!started){
      started=true;resize();draw();_obs.disconnect();
      setInterval(nextPalette,10000);
    }
  },{threshold:0.01});
  _obs.observe(canvas);

  section.addEventListener('mousemove',function(e){var r=section.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top;});
  section.addEventListener('mouseleave',function(){mx=my=-1;});
  section.addEventListener('touchmove',function(e){var r=section.getBoundingClientRect(),t0=e.touches[0];mx=t0.clientX-r.left;my=t0.clientY-r.top;},{passive:true});
  section.addEventListener('touchend',function(){mx=my=-1;});
  window.addEventListener('resize',function(){if(started)resize();});
})();

// ── BENTO TILT ──
(function(){
  document.querySelectorAll('.why-card').forEach(function(card){
    card.addEventListener('mousemove',function(e){
      var r=card.getBoundingClientRect();
      var x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      card.style.setProperty('--mx',(x*100).toFixed(1)+'%');
      card.style.setProperty('--my',(y*100).toFixed(1)+'%');
      card.style.transform='perspective(800px) rotateY('+((x-.5)*5)+'deg) rotateX('+(-(y-.5)*5)+'deg) translateZ(6px)';
    });
    card.addEventListener('mouseleave',function(){card.style.transform='';});
  });
})();

// ── FAQ ──
document.addEventListener('click',function(e){
  var q=e.target.closest('.faq-q');
  if(!q)return;
  var item=q.closest('.faq-item');
  var was=item.classList.contains('open');
  item.closest('.faq-list').querySelectorAll('.faq-item').forEach(function(i){i.classList.remove('open');});
  if(!was)item.classList.add('open');
});

// ═══════════════════════════════════════════════════
// EMAILJS — CONFIGURACIÓN
// ─────────────────────────────────────────────────
// 1. Ve a https://www.emailjs.com → Sign Up (gratis)
// 2. Add Email Service → Gmail → copia el Service ID
// 3. Email Templates → Create Template:
//      PLANTILLA 1 (notificación interna):
//        To email: hola@obreko.com
//        Subject:  Nueva solicitud — {{servicio}} · obreko
//        Body:     usa las variables abajo ({{nombre}}, etc.)
//
//      PLANTILLA 2 (auto-respuesta al cliente):
//        To email: {{email_cliente}}
//        Subject:  Hemos recibido tu solicitud · obreko
//        Body:     usa {{nombre_cliente}}, de estilo marca
//
// 4. Account → API Keys → copia tu Public Key
// ───────────────────────────────────────────────────
var EMAILJS_PUBLIC_KEY        = 'PvEyyVyTPCAYnZhDa';
var EMAILJS_SERVICE_ID        = 'service_yupbwyq';
var EMAILJS_TPL_NOTIFY        = 'template_cz02hnn';
var EMAILJS_TPL_AUTOREPLY     = 'template_7mdm2ew';
var EMAILJS_TPL_RC_NOTIFY     = 'template_s3uahjk';
var EMAILJS_TPL_RC_AUTOREPLY  = 'template_jiqo1vd';
// ═══════════════════════════════════════════════════

// Carga lazy de EmailJS: solo se descarga el SDK al interactuar con un formulario
// (o al pulsar Enviar). Evita el coste del script en visitas que nunca tocan el form.
// IMPORTANTE: la privateKey NUNCA debe ir en el cliente. Solo publicKey.
var _ejsPromise=null;
function ensureEmailJS(){
  if(_ejsPromise)return _ejsPromise;
  _ejsPromise=new Promise(function(resolve,reject){
    if(typeof emailjs!=='undefined'){
      try{emailjs.init({publicKey:EMAILJS_PUBLIC_KEY});}catch(e){}
      resolve(window.emailjs);return;
    }
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.async=true;
    s.onload=function(){
      try{emailjs.init({publicKey:EMAILJS_PUBLIC_KEY});}catch(e){}
      resolve(window.emailjs);
    };
    s.onerror=function(e){_ejsPromise=null;reject(e);};
    document.head.appendChild(s);
  });
  return _ejsPromise;
}
// Precarga discreta: se dispara con la primera interacci\u00f3n real con un formulario.
(function(){
  var ids=['pptoNombre','pptoEmail','pptoTel','pptoMsg','pptoSvc','pptoConsent','pptoBtn',
           'rcNombre','rcEmail','rcTel','rcMsg','rcConsent','rcBtn'];
  var fired=false;
  function trig(){if(fired)return;fired=true;ensureEmailJS();off();}
  function off(){
    ids.forEach(function(id){var el=document.getElementById(id);if(el){
      el.removeEventListener('focus',trig,true);
      el.removeEventListener('pointerdown',trig,true);
    }});
  }
  ids.forEach(function(id){var el=document.getElementById(id);if(el){
    el.addEventListener('focus',trig,true);
    el.addEventListener('pointerdown',trig,true);
  }});
})();

var pptoBtn=document.getElementById('pptoBtn');
if(pptoBtn)pptoBtn.addEventListener('click',function(){
  var cb=document.getElementById('pptoConsent');
  if(cb&&!cb.checked){
    cb.closest('.pf-consent').style.outline='2px solid rgba(255,80,80,.6)';
    setTimeout(function(){cb.closest('.pf-consent').style.outline='';},2500);
    return;
  }
  var nombre  = (document.getElementById('pptoNombre')||{}).value||'';
  var tel     = (document.getElementById('pptoTel')||{}).value||'';
  var email   = (document.getElementById('pptoEmail')||{}).value||'';
  var svc     = (document.getElementById('pptoSvc')||{}).value||'No especificado';
  var msg     = (document.getElementById('pptoMsg')||{}).value||'';

  if(!nombre||!email){
    alert('Por favor, rellena al menos tu nombre y tu email.');
    return;
  }

  var btn=this;
  btn.textContent='Enviando…';
  btn.disabled=true;

  var params={
    nombre:nombre,
    telefono:tel||'No facilitado',
    email_cliente:email,
    servicio:svc,
    mensaje:msg||'Sin mensaje adicional',
    nombre_cliente:nombre
  };

  function onOk(){
    btn.textContent='✓ Solicitud enviada — te contactamos en menos de 48h';
    btn.style.background='rgba(255,255,255,.08)';
    btn.style.color='rgba(255,255,255,.6)';
    // limpiar campos
    ['pptoNombre','pptoTel','pptoEmail','pptoMsg'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.value='';
    });
    document.getElementById('pptoSvc').value='';
    document.getElementById('pptoConsent').checked=false;
    setTimeout(function(){btn.textContent='Enviar solicitud →';btn.style.background='';btn.style.color='';btn.disabled=false;},8000);
  }
  function onErr(e){
    console.error('EmailJS error:',e);
    btn.textContent='Error al enviar — inténtalo de nuevo';
    btn.style.color='rgba(255,120,120,.9)';
    setTimeout(function(){btn.textContent='Enviar solicitud →';btn.style.color='';btn.disabled=false;},4000);
  }

  ensureEmailJS()
    .then(function(){return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TPL_NOTIFY, params);})
    .then(function(){return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TPL_AUTOREPLY, params);})
    .then(onOk)
    .catch(onErr);
});

// ── HOGAR CONECTADO — VIRTUAL TOUR ──
function initHogar(){
  var scene=document.getElementById('hcScene');
  if(!scene||scene._hcInit)return;
  scene._hcInit=true;

  var rooms=Array.from(document.querySelectorAll('.hc-room'));
  var tabs=Array.from(document.querySelectorAll('.hc-tab'));
  var panels=Array.from(document.querySelectorAll('.hc-panel-content'));
  var names=['Exterior','Salón','Cocina','Dormitorio','Baño'];
  var current=0;

  function updateNav(){
    // Read names from translated tabs if available
    var tabEls=document.querySelectorAll('.hc-tab');
    if(tabEls.length===names.length){
      tabEls.forEach(function(t,i){names[i]=t.textContent.trim();});
    }
    var btnPrev=document.getElementById('hcPrev');
    var btnNext=document.getElementById('hcNext');
    var prevLabel=document.getElementById('hcPrevLabel');
    var nextLabel=document.getElementById('hcNextLabel');
    var panelTitle=document.getElementById('hcPanelTitle');
    if(panelTitle)panelTitle.textContent=names[current];
    if(btnPrev){
      btnPrev.style.display=current===0?'none':'flex';
      if(prevLabel&&current>0)prevLabel.textContent=names[current-1];
    }
    if(btnNext){
      btnNext.style.display=current===rooms.length-1?'none':'flex';
      if(nextLabel&&current<rooms.length-1)nextLabel.textContent=names[current+1];
    }
  }

  // Parallax (más movimiento)
  var vp=document.getElementById('hcViewport');
  if(vp){
    vp.addEventListener('mousemove',function(e){
      var img=rooms[current].querySelector('img');
      if(!img)return;
      var r=vp.getBoundingClientRect();
      var dx=(e.clientX-r.left)/r.width-.5;
      var dy=(e.clientY-r.top)/r.height-.5;
      img.style.transform='translate('+(-dx*38)+'px,'+(-dy*24)+'px)';
    });
    vp.addEventListener('mouseleave',function(){
      var img=rooms[current].querySelector('img');
      if(img)img.style.transform='';
    });
  }

  // Tooltip descriptions [room][device]
  var pinTips=[
    // 0 · Exterior
    ['Cámara 4K · Vigilancia en tiempo real accesible desde el móvil',
     'Luces exterior · Se activan solas al detectar movimiento o al anochecer',
     'Videoportero · Ve y habla con quien llega sin levantarte del sofá',
     'Cerradura smart · Abre con huella dactilar, código PIN o desde la app',
     'Sensor de movimiento · Activa alarmas y escenas de seguridad automáticamente'],
    // 1 · Salón
    ['Iluminación · Ajusta intensidad y temperatura de color por escena o por voz',
     'Persianas · Apertura programada al amanecer o cierre automático al atardecer',
     'Termostato · Temperatura exacta por horarios, zonas y modo vacaciones',
     'Audio multiroom · Música sincronizada en toda la vivienda desde una sola app',
     'Detector de presencia · Adapta la luz y el clima según si hay alguien en la sala'],
    // 2 · Cocina
    ['Iluminación · Luz de trabajo regulable sin tocar un solo interruptor',
     'Termostato · Zona independiente para mayor confort mientras cocinas',
     'Electrodomésticos · Monitoriza el consumo y controla en remoto',
     'Cámara interior · Vigilancia accesible en cualquier momento desde el móvil',
     'Presencia · La luz se enciende y apaga sola al entrar y salir'],
    // 3 · Dormitorio
    ['Iluminación · Amanecer simulado gradual y escenas de relajación nocturna',
     'Persianas · Apertura gradual programada para despertar de forma natural',
     'Termostato · Temperatura ideal durante el descanso, zona por zona',
     'Equipo de sonido · Música ambiente, alarmas sonoras y control por voz',
     'Detector de presencia · Activa el modo noche automáticamente al detectar reposo'],
    // 4 · Baño
    ['Iluminación · Luz tenue nocturna sin deslumbrar al levantarte',
     'Sensor de humedad · Ventilación automática para prevenir condensación y moho',
     'Agua caliente · Lista a la hora exacta que la necesitas cada día',
     'Suelo radiante · Programación horaria y temperatura exacta bajo tus pies']
  ];

  // Tooltip element
  var tipEl=document.createElement('div');
  tipEl.className='hc-pin-tip';
  tipEl.style.cssText='display:none;position:absolute;z-index:99;background:#1A2236;color:#fff;font-size:11px;font-family:var(--sans,sans-serif);line-height:1.4;padding:6px 10px;max-width:200px;pointer-events:none;white-space:normal;border-left:2px solid #FED544;';
  document.getElementById('hcViewport').appendChild(tipEl);
  var activeTipPin=null;

  function showTip(pin){
    var roomIdx=rooms.indexOf(pin.closest('.hc-room'));
    var devIdx=parseInt(pin.dataset.device);
    if(roomIdx<0||!pinTips[roomIdx]||!pinTips[roomIdx][devIdx]) return;
    tipEl.textContent=pinTips[roomIdx][devIdx];
    tipEl.style.display='block';
    // Position relative to viewport
    var vp=document.getElementById('hcViewport').getBoundingClientRect();
    var pr=pin.getBoundingClientRect();
    var left=(pr.left-vp.left+pr.width+8);
    var top=(pr.top-vp.top);
    // Flip left if near right edge
    if(left+210>vp.width) left=pr.left-vp.left-218;
    tipEl.style.left=left+'px';
    tipEl.style.top=top+'px';
    activeTipPin=pin;
  }

  function hideTip(){ tipEl.style.display='none'; activeTipPin=null; }

  document.getElementById('hcViewport').addEventListener('click',function(e){
    var pin=e.target.closest('.hc-pin');
    if(pin){ if(pin===activeTipPin){hideTip();}else{showTip(pin);} e.stopPropagation(); }
    else hideTip();
  });

  // Conexión bidireccional pin ↔ panel
  function bindPins(){
    var allPins=Array.from(document.querySelectorAll('.hc-pin[data-device]'));

    // Pin → panel
    allPins.forEach(function(pin){
      pin.addEventListener('mouseenter',function(){
        var devIdx=parseInt(pin.dataset.device);
        var panel=panels[current];
        if(!panel)return;
        var devices=Array.from(panel.querySelectorAll('.hc-device'));
        devices.forEach(function(d){d.classList.remove('hl');});
        if(devices[devIdx]){
          devices[devIdx].classList.add('hl');
          devices[devIdx].scrollIntoView({block:'nearest',behavior:'smooth'});
        }
        showTip(pin);
      });
      pin.addEventListener('mouseleave',function(){
        var panel=panels[current];
        if(!panel)return;
        Array.from(panel.querySelectorAll('.hc-device')).forEach(function(d){d.classList.remove('hl');});
        hideTip();
      });
    });

    // Panel → pin
    var allDevices=Array.from(document.querySelectorAll('.hc-device[data-device]'));
    allDevices.forEach(function(dev){
      dev.addEventListener('mouseenter',function(){
        var devIdx=dev.dataset.device;
        var activeRoom=rooms[current];
        if(!activeRoom)return;
        var pins=Array.from(activeRoom.querySelectorAll('.hc-pin[data-device]'));
        pins.forEach(function(p){p.classList.remove('hl');});
        var match=activeRoom.querySelector('.hc-pin[data-device="'+devIdx+'"]');
        if(match)match.classList.add('hl');
      });
      dev.addEventListener('mouseleave',function(){
        var activeRoom=rooms[current];
        if(!activeRoom)return;
        Array.from(activeRoom.querySelectorAll('.hc-pin')).forEach(function(p){p.classList.remove('hl');});
      });
    });
  }
  bindPins();

  window._hcUpdateNav=updateNav;

  window.hcGoTo=function(idx){
    if(idx===current)return;
    if(window._stopSb1)window._stopSb1();
    if(window._stopSb2)window._stopSb2();
    rooms[current].classList.remove('active');
    tabs[current].classList.remove('active');
    if(panels[current])panels[current].classList.remove('active');
    current=((idx%rooms.length)+rooms.length)%rooms.length;
    rooms[current].classList.add('active');
    tabs[current].classList.add('active');
    if(panels[current])panels[current].classList.add('active');
    updateNav();
  };

  var btnPrev=document.getElementById('hcPrev');
  var btnNext=document.getElementById('hcNext');
  if(btnPrev)btnPrev.addEventListener('click',function(){if(current>0)hcGoTo(current-1);});
  if(btnNext)btnNext.addEventListener('click',function(){if(current<rooms.length-1)hcGoTo(current+1);});

  document.addEventListener('keydown',function(e){
    var hogarPage=document.getElementById('page-hogar');
    if(!hogarPage||!hogarPage.classList.contains('active'))return;
    if(e.key==='ArrowRight'&&current<rooms.length-1)hcGoTo(current+1);
    if(e.key==='ArrowLeft'&&current>0)hcGoTo(current-1);
  });

  var touchStartX=0;
  var touchEl=vp||scene;
  touchEl.addEventListener('touchstart',function(e){touchStartX=e.touches[0].clientX;},{passive:true});
  touchEl.addEventListener('touchend',function(e){
    var dx=e.changedTouches[0].clientX-touchStartX;
    if(Math.abs(dx)>50){
      if(dx<0&&current<rooms.length-1)hcGoTo(current+1);
      else if(dx>0&&current>0)hcGoTo(current-1);
    }
  },{passive:true});

  updateNav();
}


// ── FLIP CARDS HOGAR CONECTADO ──
document.querySelectorAll('.hc-feat').forEach(function(card){
  var flipTimer=null;
  card.addEventListener('click',function(){
    if(card.classList.contains('flipped')){
      // Si ya está girada, volver al frente inmediatamente
      clearTimeout(flipTimer);
      card.classList.remove('flipped');
    } else {
      // Girar al reverso y volver automáticamente en 10 s
      card.classList.add('flipped');
      clearTimeout(flipTimer);
      flipTimer=setTimeout(function(){
        card.classList.remove('flipped');
      },10000);
    }
  });
});

// ── SOUNDBAR — movido a js/soundbar.js (lazy-load) ──

// ── TERMOSTATO INTERACTIVO ──
(function(){
  var val=document.getElementById('hcThermoVal');
  var btnUp=document.getElementById('hcThermoUp');
  var btnDown=document.getElementById('hcThermoDown');
  if(!val||!btnUp||!btnDown)return;
  var temp=21;
  function update(){val.textContent=temp;}
  btnUp.addEventListener('click',function(e){
    e.stopPropagation();
    if(temp<30){temp++;update();}
  });
  btnDown.addEventListener('click',function(e){
    e.stopPropagation();
    if(temp>15){temp--;update();}
  });
})();

// ── TERMOSTATO DORMITORIO ──
(function(){
  var val=document.getElementById('hcThermoVal2');
  var btnUp=document.getElementById('hcThermoUp2');
  var btnDown=document.getElementById('hcThermoDown2');
  if(!val||!btnUp||!btnDown)return;
  var temp=19;
  function update(){val.textContent=temp;}
  btnUp.addEventListener('click',function(e){e.stopPropagation();if(temp<30){temp++;update();}});
  btnDown.addEventListener('click',function(e){e.stopPropagation();if(temp>15){temp--;update();}});
})();

// ── SOUNDBAR DORMITORIO — movido a js/soundbar.js (lazy-load) ──

// ── MODALES LEGALES ──
function openLegal(id){document.getElementById(id).classList.add('open');document.body.style.overflow='hidden';}
function closeLegal(id){
  if(id){document.getElementById(id).classList.remove('open');}
  else{document.querySelectorAll('.lmodal.open').forEach(function(m){m.classList.remove('open');});}
  document.body.style.overflow='';
}
document.querySelectorAll('.lmodal').forEach(function(m){
  m.addEventListener('click',function(e){if(e.target===m)closeLegal(m.id);});
});

// ── SWIPE PARA VOLVER ATRÁS (móvil) ──
(function(){
  var startX=0,startY=0,startEdge=false;
  document.addEventListener('touchstart',function(e){
    startX=e.touches[0].clientX;
    startY=e.touches[0].clientY;
    // Detectar si empieza desde el borde izquierdo (zona de gesto nativo del navegador)
    startEdge=startX<30;
  },{passive:false});
  document.addEventListener('touchmove',function(e){
    if(!startEdge)return;
    var dx=e.touches[0].clientX-startX;
    var dy=Math.abs(e.touches[0].clientY-startY);
    // Si es un swipe horizontal desde el borde, prevenimos el gesto del navegador
    if(dx>10&&dy<60){e.preventDefault();}
  },{passive:false});
  document.addEventListener('touchend',function(e){
    if(!startEdge)return;
    var dx=e.changedTouches[0].clientX-startX;
    var dy=Math.abs(e.changedTouches[0].clientY-startY);
    // Swipe derecha (dedo va de izquierda a derecha) = volver atrás
    if(dx>60&&dy<80&&_history.length>1){
      var cur=_history[_history.length-1];
      if(cur!=='home'){history.back();}
    }
    startEdge=false;
  },{passive:true});
})();

// ── VOLVER ATRÁS ──
var pptoBack=document.querySelector('.ppto-back');
if(pptoBack)pptoBack.addEventListener('click',function(){
  if(_history.length>1){history.back();}else{nav('home');}
});

// ── INTERNACIONALIZACIÓN ES / EN ──
var _i18n={
  es:{
    'nos-bc':'Por qué <span class="brand">obreko</span>','nos-tag':'Origen · Valores · Compromiso',
    'mm-unete':'Únete al equipo',
    'unete-bc':'Únete al equipo','unete-tag':'Profesionales · Vocación · Futuro',
    'unete-h1':'Buscamos gente<br><strong>que haga las cosas bien.</strong>',
    'unete-hsub':'En <span class="brand" style="font-size:1.2em;color:var(--yellow)">obreko</span> no fichamos empleados, incorporamos profesionales. Si te enorgullece tu trabajo y quieres formar parte de un equipo serio, te estamos buscando.',
    'unete-eyebrow1':'Por qué <span class="brand" style="font-size:1.4em;color:var(--navy2);text-transform:none">obreko</span>','unete-why-h':'Un sitio donde crecer.',
    'unete-why-p':'<p>Trabajar en <span class="brand" style="font-size:1.1em;color:var(--navy2)">obreko</span> significa estabilidad, respeto y proyectos reales. No subcontratamos para abaratar: formamos equipo para hacer las cosas con orgullo. Buen ambiente, pagos puntuales y la posibilidad de crecer dentro de la empresa.</p>',
    'unete-eyebrow2':'Lo que ofrecemos','unete-bento-h':'Ser nuestro capital humano.',
    'unete-b1-n':'Cobras lo pactado. Siempre.','unete-b1-d':'Nada de esperas ni excusas. El día acordado, el importe acordado. La puntualidad en el pago es tan importante para nosotros como la puntualidad en la obra.',
    'unete-b2-n':'Carga constante','unete-b2-d':'Proyectos reales semana tras semana. Sin temporadas muertas ni incertidumbre.',
    'unete-b3-n':'App propia','unete-b3-d':'Gestionas tu trabajo desde la app de <span class="brand" style="font-size:1.25em;color:var(--yellow)">obreko</span>. Partes, avisos e incidencias en un solo lugar.',
    'unete-b4-n':'Equipo de verdad','unete-b4-d':'Dirección cercana, compañeros comprometidos y un ambiente donde se escucha. Aquí no eres un número.',
    'unete-b5-n':'La seguridad es lo primero.','unete-b5-d':'Trabajamos con todos los equipos de protección necesarios y seguimos los protocolos de seguridad en cada obra. Tu integridad no se negocia.',
    'unete-b6-n':'Tú pones el oficio. Nosotros, el resto.','unete-b6-d':'Herramientas, materiales, vehículo y gestión administrativa. No tienes que poner nada de tu bolsillo para trabajar con nosotros.',
    'unete-eyebrow3':'Perfiles buscados','unete-perfiles-h':'¿Eres de los nuestros?',
    'unete-p1':'Albañiles y oficiales de construcción','unete-p2':'Fontaneros y electricistas',
    'unete-p3':'Pintores y aplicadores de revestimientos','unete-p4':'Carpinteros y montadores',
    'unete-p5':'Técnicos de mantenimiento','unete-p6':'Manitas polivalentes con experiencia',
    'unete-perfiles-p':'Si tu perfil no está en la lista pero crees que encajas, escríbenos igualmente. Valoramos la actitud tanto como el oficio.',
    'unete-cta-h':'¿Te animas?','unete-cta-p':'Mándanos un mensaje con tu experiencia y zona. Te respondemos en 48 horas.',
    'unete-cta-btn':'Escribir a obreko →',
    'unete-f-tel':'Teléfono *','unete-ok':'✓ Candidatura recibida. Nos pondremos en contacto contigo si tu perfil encaja con las candidaturas abiertas y hay vacantes disponibles. ¡Gracias!',
    'nos-h1':'Un equipo que<br><strong>nació para durar.</strong>',
    'nos-hsub':'Profesionales del sector con años de experiencia que decidieron unir fuerzas. Porque sólos llegamos más rápido, pero juntos llegamos más lejos.',
    'nos-eyebrow1':'Nuestra historia','nos-intro-h':'Cómo nace obreko.',
    'nos-intro-p':'<p><span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> nace de la unión de autónomos con amplia trayectoria en construcción, reformas y hogar. Cada uno experto en su oficio. Todos con la misma forma de entender el trabajo: sin atajos, sin excusas y con el cliente siempre en el centro.</p><p>La idea es sencilla: juntar el talento que ya existía, añadir estructura y ofrecer algo que el mercado rara vez da — un servicio serio, coordinado y humano.</p>',
    'nos-quote':'"Sólos llegamos más rápido, pero juntos llegamos más lejos."',
    'nos-eyebrow2':'Nuestros valores','nos-bull-h':'En qué <strong style="font-style:normal">creemos.</strong>',
    'nos-b1-n':'Honestidad','nos-b1-d':'Presupuesto real desde el primer día. Lo que acordamos es lo que pagas. Sin letra pequeña ni cargos inesperados.',
    'nos-b2-n':'Equipo propio','nos-b2-d':'Profesionales especializados que elegimos trabajar juntos. Sin subcontratas ni intermediarios. <strong style="color:var(--navy);font-weight:700">El que va a tu casa somos nosotros.</strong>',
    'nos-b3-n':'Transparencia','nos-b3-d':'Te informamos en cada fase. Fotos, actualizaciones y el parte que necesites. Sin tener que preguntar.',
    'nos-b4-n':'Puntualidad','nos-b4-d':'Cumplimos los calendarios. Si surge un imprevisto, eres el primero en saberlo y en recibir una solución.',
    'nos-b5-n':'Compromiso duradero','nos-b5-d':'No desaparecemos al terminar la obra. Eres cliente para siempre y nos tienes cuando nos necesites.',
    'nos-b6-n':'Medioambiente','nos-b6-d':'Gestión responsable de residuos en cada obra. Colaboramos con gestores autorizados y minimizamos el impacto en el entorno.',
    'nos-eyebrow3':'Sostenibilidad','nos-env-h':'El entorno importa.',
    'nos-env-p':'<p>Cada obra genera residuos. Lo que distingue a un profesional responsable es cómo los gestiona. En <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> trabajamos con gestores de residuos autorizados, separamos materiales para su reciclaje y evitamos vertidos ilegales.</p><p>Tenerife y Madrid son entornos únicos. Cuidarlos es también nuestra responsabilidad.</p>',
    'cb-text':'Usamos cookies para mejorar tu experiencia. Puedes aceptarlas todas o personalizar qué cookies activas.','cb-policy':'Política de cookies','cb-accept':'Aceptar todas','cb-configure':'Configurar',
    'cm-title':'Configuración de cookies','cm-desc':'Selecciona qué tipos de cookies deseas permitir. Las cookies necesarias no pueden desactivarse porque son imprescindibles para el funcionamiento del sitio.',
    'cm-cat-nec':'Cookies necesarias','cm-cat-nec-desc':'Imprescindibles para el funcionamiento del sitio: preferencias de idioma, sesión de formularios. Sin estas cookies el sitio no puede funcionar correctamente.',
    'cm-cat-ana':'Cookies analíticas','cm-cat-ana-desc':'Nos ayudan a entender cómo los usuarios navegan por el sitio para mejorar la experiencia. Los datos son anónimos y agregados.',
    'cm-cat-mkt':'Cookies de marketing','cm-cat-mkt-desc':'Permiten mostrar anuncios relevantes según tus intereses. Actualmente no las utilizamos, pero podrían activarse en el futuro.',
    'cm-reject':'Rechazar opcionales','cm-save':'Guardar preferencias',
    'consent-text':'He leído y acepto la <button onclick="openLegal(\'lPriv\')" style="background:none;border:none;color:rgba(255,255,255,.65);font-size:.82rem;cursor:pointer;text-decoration:underline;padding:0;font-family:inherit">política de privacidad y protección de datos</button>. Consiento el tratamiento de mis datos para gestionar mi solicitud.',
    'priv-h1':'Política de Privacidad','priv-h-resp':'Responsable del tratamiento','priv-p-resp':'obreko · Tenerife, Islas Canarias · hola@obreko.com',
    'priv-h-fin':'Finalidad','priv-p-fin':'Gestionar las solicitudes de presupuesto y contacto recibidas a través del formulario web.',
    'priv-h-leg':'Legitimación','priv-p-leg':'Consentimiento del interesado mediante la marcación de la casilla de aceptación.',
    'priv-h-dest':'Destinatarios','priv-p-dest':'No se cederán datos a terceros salvo obligación legal.',
    'priv-h-der':'Derechos','priv-p-der':'Puedes ejercer tus derechos de acceso, rectificación, supresión y oposición escribiendo a hola@obreko.com.',
    'aviso-h1':'Aviso Legal','aviso-h-tit':'Titular del sitio web','aviso-p-tit':'Pronexo Hábitat SLL (obreko) · Tenerife, Islas Canarias · hola@obreko.com',
    'aviso-h-obj':'Objeto','aviso-p-obj':'El presente aviso legal regula el uso del sitio web obreko, del que es titular Pronexo Hábitat SLL.',
    'aviso-h-pi':'Propiedad intelectual','aviso-p-pi':'Todos los contenidos de este sitio web son propiedad de Pronexo Hábitat SLL y están protegidos por la legislación vigente en materia de propiedad intelectual.',
    'cook-h1':'Política de Cookies','cook-h-que':'¿Qué son las cookies?','cook-p-que':'Las cookies son pequeños archivos de texto que los sitios web almacenan en tu dispositivo.',
    'cook-h-util':'Cookies utilizadas','cook-p-util':'Este sitio web no utiliza cookies de terceros ni de seguimiento. Únicamente se utilizan cookies de sesión estrictamente necesarias para el funcionamiento del sitio.',
    'hc-domotica':'Domótica activa',
    'hc-room-0':'Exterior','hc-room-1':'Salón','hc-room-2':'Cocina','hc-room-3':'Dormitorio','hc-room-4':'Baño',
    'hc-nav-enter':'Entrar a la casa','hc-nav-ext':'Salir al exterior','hc-nav-cocina':'Ir a cocina','hc-nav-dorm':'Ir a dormitorio','hc-nav-bano':'Ir al baño','hc-nav-bsal':'Volver al salón','hc-nav-bcoc':'Volver a cocina','hc-nav-bdor':'Volver a dormitorio',
    'hc-ext-d0-n':'Cámara exterior 4K','hc-ext-d0-v':'Grabando · Online 24/7',
    'hc-ext-d1-n':'Luces jardín y acceso','hc-ext-d1-v':'Sensor de movimiento · Auto',
    'hc-ext-d2-n':'Videoportero','hc-ext-d2-v':'Conectado a tu móvil · App',
    'hc-ext-d3-n':'Cerradura inteligente','hc-ext-d3-v':'Huella / código / app',
    'hc-ext-d4-n':'Sensor de movimiento','hc-ext-d4-v':'Perímetro · Activo',
    'hc-sal-d0-n':'Iluminación','hc-sal-d0-v':'4 zonas · 70% · Tono cálido',
    'hc-sal-d1-n':'Persianas motorizadas','hc-sal-d1-v':'Abiertas · Auto amanecer',
    'hc-sal-d2-n':'Termostato','hc-sal-d2-v':'21°C · Modo confort',
    'hc-sal-d3-n':'Audio multiroom','hc-sal-d3-v':'Sonos / Alexa · Activo',
    'hc-sal-d4-n':'Detector de presencia','hc-sal-d4-v':'Ocupado · Escena activa',
    'hc-coc-d0-n':'Luces inteligentes','hc-coc-d0-v':'LED regulable · Blanco frío',
    'hc-coc-d1-n':'Termostato','hc-coc-d1-v':'22°C · Auto por zona',
    'hc-coc-d2-n':'Electrodomésticos smart','hc-coc-d2-v':'Monitorizados · Conectados',
    'hc-coc-d3-n':'Cámara interior','hc-coc-d3-v':'Grabando · 24/7',
    'hc-coc-d4-n':'Detector de presencia','hc-coc-d4-v':'Activo · Luces automáticas',
    'hc-dor-d0-n':'Luces inteligentes','hc-dor-d0-v':'Cálida · 30% · Modo descanso',
    'hc-dor-d1-n':'Persianas motorizadas','hc-dor-d1-v':'Cerradas · Modo noche',
    'hc-dor-d2-n':'Termostato','hc-dor-d2-v':'19°C · Modo descanso',
    'hc-dor-d3-n':'Equipo de sonido','hc-dor-d3-v':'Multiroom · Activo',
    'hc-dor-d4-n':'Detector de presencia','hc-dor-d4-v':'Ocupado · Modo noche',
    'hc-ban-d0-n':'Luces inteligentes','hc-ban-d0-v':'Regulable · Tono natural',
    'hc-ban-d1-n':'Sensor de humedad','hc-ban-d1-v':'62% · Extractor automático',
    'hc-ban-d2-n':'Agua caliente sanitaria','hc-ban-d2-v':'38°C · Lista para usar',
    'hc-ban-d3-n':'Suelo radiante','hc-ban-d3-v':'23°C · Activo',
    'mm-close':'Cerrar','mm-inicio':'Inicio','mm-servicios':'Servicios','mm-contacto':'Contacto',
    'mm-interesar':'Te puede interesar','mm-wa':'WhatsApp directo','mm-testi':'Testimonios',
    'mm-como':'Cómo trabajamos','mm-proceso':'Nuestro proceso','mm-porqué':'Por qué <span class="brand">obreko</span>',
    'nav-obras':'Obras',
    'nav-reforma':'Reformas',
    'nav-manitas':'Manitas',
    'nav-mant':'Mantenimiento',
    'nav-hogar':'Hogar conectado',
    'nav-ppto':'Presupuesto',
    'hero-h1':'Tu espacio,<strong>transformado.</strong>',
    'hero-sub':'Obras, reformas, mantenimiento y hogar conectado. Un solo equipo. Plazos reales. Sin sorpresas.',
    'btn-ppto':'Solicitar presupuesto',
    'btn-servicios':'Ver servicios',
    'stat-years':'años en Tenerife',
    'strip-obras':'Obras & Proyectos',
    'strip-reforma':'Reforma integral',
    'strip-manitas':'Manitas &amp; Urgencias',
    'strip-mant':'Mantenimiento & Cuidado',
    'strip-hogar':'Hogar conectado',
    'stat-exp':'Años de experiencia',
    'stat-proj':'Proyectos completados',
    'stat-team':'Equipo propio',
    'stat-resp':'Respuesta garantizada',
    'proc-intro':'Sin sorpresas, sin intermediarios. Profesionales con más de 10 años de experiencia. Un único interlocutor coordina todo tu proyecto de principio a fin.',
    'testi-h':'Lo que dicen<br>nuestros clientes.','testi-empty-msg':'Acabamos de lanzar. Sé de los primeros en contarnos tu experiencia.','testi-empty-btn':'Cuéntanos tu experiencia →',
    'cta-eyebrow':'¿Tienes un proyecto?',
    'cta-h':'Presupuesto claro<br>en 48 horas.',
    'cta-sub':'Sin compromiso. Te respondemos con un desglose detallado, sin letra pequeña.',
    'cta-btn':'Solicitar presupuesto →',
    'cov-h':'Dos territorios.<br>El mismo compromiso.',
    'hc-h1':'Todo tu hogar,<br>desde un solo lugar.',
    'hc-h2':'Tu casa que trabaja<br>mientras tú vives.',
    'hc-h3':'Elige tu nivel<br>de automatización.',
    'hc-why-h':'¿Por qué<br>elegirnos?',
    'hc-proc-h':'Proceso de trabajo.',
    'hc-steps-h':'Próximos pasos.',
    'hc-cta-h':'Visita de diagnóstico gratuita.',
    'hc-cta-sub':'Te mostramos lo que es posible en tu hogar. Sin compromiso.',
    'hc-cta-btn':'Solicitar visita →',
    // Shared service page elements
    'svc-hbtn':'Solicitar presupuesto gratuito',
    'bull-eyebrow':'Qué incluye',
    'bull-h':'Todo lo que <strong style="font-style:normal">necesitas.</strong>',
    'faq-eyebrow':'Preguntas frecuentes',
    'faq-h':'Resolvemos<br>tus dudas.',
    'btn-pedir':'Pedir presupuesto →',
    'btn-contactar':'Contactar ahora →',
    // OBRAS
    'obras-tag':'Tabiques · Reformas · Arquitectura · Acabados',
    'obras-h1':'Obras &amp;<br><strong>Proyectos.</strong>',
    'obras-hsub':'Ejecutamos obras de interior y proyectos de arquitectura con rapidez y limpieza. Tabiques, aperturas, alicatados, techos y mucho más. Sin que tengas que gestionar nada.',
    'obras-intro-h':'Tu obra, resuelta sin complicaciones.',
    'svc-cta-start':'¿Listo para empezar?',
    'svc-cta-start-p':'Presupuesto claro en 48 horas. Sin compromiso.',
    // REFORMA
    'reforma-tag':'Transformar · Mejorar · Adaptar',
    'reforma-h1':'Reforma<br><strong>integral.</strong>',
    'reforma-hsub':'Tu casa como siempre quisiste que fuera. Sin caos, sin retrasos, sin facturas sorpresa.',
    'reforma-intro-h':'La reforma que siempre quisiste hacer.',
    // MANITAS
    'manitas-tag':'Rápido · Resolutivo · Sin búsquedas',
    'manitas-h1':'Manitas &amp;<br><strong>Urgencias.</strong>',
    'manitas-hsub':'Pequeños problemas, solución rápida. Sin esperas, sin complicaciones.',
    'manitas-intro-h':'Algo se ha roto. Lo resolvemos.',
    'manitas-cta-h':'¿Necesitas que vayamos?',
    'manitas-cta-p':'Cuéntanos la avería. Respondemos rápido.',
    // MANTENIMIENTO
    'mant-tag':'Prevenir · Conservar · Descansar',
    'mant-h1':'Mantenimiento<br><strong>&amp; Cuidado.</strong>',
    'mant-hsub':'Alguien de confianza que cuida tu propiedad cuando tú no puedes estar.',
    'mant-intro-h':'Tu inmueble en manos de confianza.',
    'mant-cta-h':'¿Quieres despreocuparte de tu inmueble?',
    'mant-cta-p':'Te diseñamos un plan a medida. Sin compromiso.',
    // PRESUPUESTO form
    'ppto-back':'← Volver',
    'ppto-label':'Solicitar presupuesto',
    'ppto-title':'Tu proyecto,<br>en buenas<br><em>manos.</em>',
    'ppto-sub':'Cuéntanos qué necesitas. Un técnico especialista te contacta en menos de 48h con un presupuesto claro y sin sorpresas.',
    'ppto-g1':'Respuesta en menos de 48h',
    'ppto-g2':'Presupuesto sin compromiso',
    'ppto-g3':'Precio cerrado, sin sorpresas',
    'ppto-g4':'Equipo propio, sin subcontratas',
    'ppto-form-t':'Cuéntanos tu proyecto',
    'ppto-btn':'Enviar solicitud →',
    'consent-link':'política de privacidad y protección de datos',
    'btn-saber-mas':'Saber más →',
    'ed-reforma-h':'Tu casa como siempre<br>quisiste que fuera.',
    'ed-reforma-p':'Coordinamos todos los gremios — albañilería, fontanería, electricidad, cerrajería, pintura — para que tú solo tengas que aprobar el resultado final. Sin caos, sin retrasos, sin facturas sorpresa.',
    'ed-reforma-ul':'<li>Reforma de cocina y baño</li><li>Reforma integral de vivienda</li><li>Pintura de fachadas y locales</li><li>Cambio de distribución con permisos</li>',
    'ed-obras-h':'Pequeñas obras,<br>grandes diferencias.',
    'ed-obras-p':'Tabiques, aperturas, alicatados, solados, techos, pequeñas reformas estructurales. Ejecutamos con limpieza y rapidez, sin que tengas que gestionar nada.',
    'ed-obras-ul':'<li>Tabiques y distribución interior</li><li>Aperturas y cierres de huecos</li><li>Alicatados y solados</li><li>Techos y revestimientos</li>',
    'ed-mant-h':'Tu inmueble en manos de confianza.',
    'ed-mant-ul':'<li>Revisiones periódicas programadas</li><li>Gestión de segunda residencia</li><li>Informe detallado con fotos tras cada visita</li><li>Coordinación de incidencias en tu nombre</li>',
    'proc-eyebrow':'Cómo trabajamos',
    'proc-h':'Así lo hacemos.',
    'step1-t':'Nos cuentas qué necesitas','step1-d':'En menos de 48h un técnico real te contacta. Primera consulta sin compromiso.',
    'step2-t':'Presupuesto cerrado y claro','step2-d':'Sin letra pequeña. Desglosamos cada partida. El precio acordado es el precio final.',
    'step3-t':'Planificación sin fricciones','step3-d':'Coordinamos materiales, gremios y plazos. Tú solo apruebas y esperas el resultado.',
    'step4-t':'Ejecución con excelencia','step4-d':'Profesionales propios, materiales de primera. Puntualidad y limpieza innegociables.',
    'step5-t':'Entrega y garantía','step5-d':'Revisión final contigo. Si algo no está al 100%, lo corregimos sin coste adicional.',
    'step6-t':'Tu equipo para siempre','step6-d':'La relación no termina con la obra. Siempre vamos a estar ahí cuando nos necesites.',
    'testi-eyebrow':'Testimonios','testi-hsub':'La mejor prueba de nuestro trabajo es la palabra de quienes ya han confiado en nosotros.',
    'testi1-text':'"Reformaron nuestra cocina y baño en tres semanas. Puntualidad total, precio exacto al presupuesto y un resultado que superó todas las expectativas."',
    'testi1-svc':'Reforma integral · Santa Cruz',
    'testi2-text':'"Tenemos una villa en Tenerife que gestionamos desde Madrid. obreko es de confianza total: nos mantiene informados con fotos y resuelve cualquier incidencia sin que tengamos que volar."',
    'testi2-svc':'Mantenimiento · Adeje',
    'testi3-text':'"Llamé un sábado por una gotera urgente. En dos horas estaban aquí, precio pactado antes de empezar y problema resuelto. Así tiene que ser."',
    'testi3-svc':'Manitas & Urgencias · La Laguna',
    'wa-link':'o escríbenos por WhatsApp',
    'cov-eyebrow':'Dónde operamos',
    'cov-p':'Actuamos en Tenerife y Madrid. Si tienes una propiedad en alguna de estas zonas, estamos ahí. Y si no, pregúntanos — seguimos creciendo.',
    'cov-active':'Activo','cov-tf-zone':'Islas Canarias · Toda la isla',
    'cov-tf-desc':'Nuestra sede de origen. Más de 10 años operando en todos los municipios de la isla, desde Santa Cruz hasta Adeje.',
    'cov-md-zone':'Comunidad de Madrid · Centro y periferia',
    'cov-md-desc':'Capital y área metropolitana. Reformas, mantenimiento y gestión de inmuebles para propietarios que necesitan un equipo de confianza en Madrid.',
    'cov-expansion':'En proceso de expansión a otras ciudades — si tienes propiedades en otra zona, consúltanos.',
    'ft-desc':'Obras, reformas, manitas, mantenimiento y hogar conectado en Tenerife y Madrid. Un solo interlocutor. Sin sorpresas.',
    'ft-servicios':'Servicios','ft-contacto':'Contacto',
    'ft-copy':'© 2026 <span class="brand" style="font-size:1.05rem;color:rgba(255,255,255,.5)">obreko</span> · Todos los derechos reservados',
    'legal-priv':'Privacidad','legal-aviso':'Aviso legal','legal-cookies':'Cookies',
    'hc-feat-eyebrow':'Qué puedes controlar',
    'hc-feat-desc':'La domótica es la integración de tecnología en el hogar para automatizar y controlar de forma inteligente la iluminación, climatización, seguridad y más — mejorando la eficiencia y el confort. En <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> lo instalamos sin obra.',
    'hcf1-t':'Iluminación inteligente','hcf1-p':'Control de intensidad, color y temperatura desde cualquier lugar. Sensores de presencia, escenas y horarios automáticos.',
    'hcf2-t':'Climatización perfecta','hcf2-p':'Termostatos inteligentes con aprendizaje de hábitos. Control por zonas, apagado automático al abrir ventanas.',
    'hcf3-t':'Seguridad y acceso','hcf3-p':'Cerraduras inteligentes con código, huella o smartphone. Cámaras 24/7, videoportero, sensores de apertura y movimiento.',
    'hcf4-t':'Persianas y estores','hcf4-p':'Motorización de persianas existentes. Apertura y cierre según amanecer/atardecer. Compatible con Alexa y Google.',
    'hcf5-t':'Audio multiroom','hcf5-p':'Tu música favorita te sigue por toda la casa. Integración con Sonos, Chromecast y Alexa.',
    'hcf6-t':'Ahorro energético','hcf6-p':'30% de ahorro medio en la factura. Monitorización en tiempo real de cada dispositivo. Persianas que aprovechan la luz natural.',
    'hcb1':'<div class="hc-feat-back-t">Iluminación inteligente</div><ul class="hc-feat-back-list"><li>Control total por voz, app o interruptor convencional</li><li>Escenas personalizadas: cine, trabajo, despertar, noche</li><li>Hasta un 60% de ahorro en consumo de iluminación</li></ul>',
    'hcb2':'<div class="hc-feat-back-t">Climatización perfecta</div><ul class="hc-feat-back-list"><li>Aprende tus rutinas y ajusta la temperatura solo</li><li>Control zona a zona: sala, dormitorios, despacho</li><li>Ahorra hasta un 35% en calefacción y aire acondicionado</li></ul>',
    'hcb3':'<div class="hc-feat-back-t">Seguridad y acceso</div><ul class="hc-feat-back-list"><li>Acceso sin llaves: código, huella dactilar o móvil</li><li>Alertas en tiempo real si se detecta movimiento</li><li>Compatible con sistemas de alarma ya instalados</li></ul>',
    'hcb4':'<div class="hc-feat-back-t">Persianas y estores</div><ul class="hc-feat-back-list"><li>Automatización según la luz solar exterior</li><li>Instalación sobre tus persianas actuales sin obra</li><li>Programa horarios o controla desde cualquier lugar</li></ul>',
    'hcb5':'<div class="hc-feat-back-t">Audio multiroom</div><ul class="hc-feat-back-list"><li>Música diferente en cada habitación a la vez</li><li>Compatible con Spotify, Apple Music, YouTube Music</li><li>Control por voz con Alexa, Google Assistant o Siri</li></ul>',
    'hcb6':'<div class="hc-feat-back-t">Ahorro energético</div><ul class="hc-feat-back-list"><li>Monitorización en tiempo real de cada dispositivo</li><li>Detecta electrodomésticos que consumen en standby</li><li>Inversión que se recupera en menos de 1 año</li></ul>',
    'hc-tl-eyebrow':'Un día en tu hogar',
    'hc-tl1':'Persianas se abren, luces suaves, calefacción sube. Despertar natural.',
    'hc-tl2':'Salida detectada. Todo se apaga, alarma activa, termostato baja.',
    'hc-tl3':'Llegada. Luces encendidas, temperatura perfecta, música de fondo.',
    'hc-tl4':'Modo cine. Luces tenues, persianas cerradas, TV encendida.',
    'hc-tl5':'Buenas noches. Todo apagado, puertas verificadas, alarma activa.',
    'hc-cmp-eyebrow':'¿Cómo funciona?',
    'hc-cmp-p':'Ambas opciones son compatibles con control por voz (Alexa, Google, Siri). Te asesoramos sin compromiso.',
    'hc-cmp-badge':'Recomendado',
    'hc-cmp1-t':'Sin servidor','hc-cmp1-sub':'Google Home · Alexa · Apple Home',
    'hc-cmp1-ul':'<li>Coste inicial más bajo</li><li>Configuración sencilla</li><li>Sin hardware adicional</li><li>Ideal para empezar</li>',
    'hc-cmp2-t':'Con servidor · Home Assistant','hc-cmp2-sub':'Funciona sin internet · Local y privado',
    'hc-cmp2-ul':'<li>Funciona sin internet (local)</li><li>+2.000 integraciones disponibles</li><li>Automatizaciones ilimitadas</li><li>Privacidad total — tus datos en casa</li><li>Sin cuotas mensuales</li><li>Une todas las marcas</li>',
    'hc-why-eyebrow':'Razones para confiar en nosotros',
    'hcw1-t':'Especialización','hcw1-p':'Expertos en domótica e instalaciones inteligentes. Conocemos el sector a fondo.','hcw1-s':'años en el sector',
    'hcw2-t':'Sin cuotas ocultas','hcw2-p':'Home Assistant es código abierto, sin suscripciones obligatorias.','hcw2-s':'en suscripciones',
    'hcw3-t':'Flexibilidad total','hcw3-p':'Adaptamos cada instalación a las necesidades del cliente.','hcw3-s':'proyectos a medida',
    'hcw4-t':'Soporte continuo','hcw4-p':'Mantenimiento preventivo y resolución de incidencias cuando lo necesites.','hcw4-s':'soporte activo',
    'hcw5-t':'Precios competitivos','hcw5-p':'Relación calidad-precio imbatible en el mercado local.','hcw5-s':'retorno de inversión',
    'hcp1-lbl':'Paso 01','hcp1-t':'Contacto','hcp1-p':'Nos cuentas el proyecto y tus necesidades.',
    'hcp2-lbl':'Paso 02','hcp2-t':'Propuesta','hcp2-p':'Elaboramos presupuesto detallado en 48h.',
    'hcp3-lbl':'Paso 03','hcp3-t':'Coordinación','hcp3-p':'Planificamos la instalación con tu equipo de obra.',
    'hcp4-lbl':'Paso 04','hcp4-t':'Instalación','hcp4-p':'Ejecutamos el proyecto de forma limpia y profesional.',
    'hcp5-lbl':'Paso 05','hcp5-t':'Entrega','hcp5-p':'Formación y documentación completa.',
    'hcp6-lbl':'Paso 06','hcp6-t':'Soporte','hcp6-p':'Mantenimiento continuo.',
    'hc-pasos-eyebrow':'Empieza ahora',
    'hcpa1-t':'Reunión de alineación','hcpa1-p':'Definimos modelo de colaboración y condiciones.',
    'hcpa2-t':'Proyecto piloto','hcpa2-p':'Realizamos una primera instalación conjunta.',
    'hcpa3-t':'Ajustes y feedback','hcpa3-p':'Optimizamos el proceso según la experiencia.',
    'hcpa4-t':'Escalado','hcpa4-p':'Integramos la domótica en todos tus proyectos.',
    'hcfaq1-q':'¿Hace falta obra para instalar domótica?','hcfaq1-a':'No necesariamente. Tenemos soluciones inalámbricas WiFi/Zigbee que se instalan sin obra, perfectas para viviendas ya terminadas y reformas.',
    'hcfaq2-q':'¿Hay cuotas mensuales?','hcfaq2-a':'No. Con Home Assistant (nuestra opción recomendada) pagas la instalación una vez y es tuya para siempre. Sin suscripciones ni dependencia del fabricante.',
    'hcfaq3-q':'¿Es compatible con lo que ya tengo en casa?','hcfaq3-a':'En la mayoría de casos sí, o requiere adaptaciones mínimas. Te hacemos una visita gratuita para evaluar tu instalación actual antes de proponer nada.',
    'hcfaq4-q':'¿Qué pasa si hay un corte de luz o internet?','hcfaq4-a':'Con Home Assistant el sistema funciona en local sin internet. Todos los dispositivos mantienen modo manual de emergencia. Nunca te quedas sin control.',
    'obrasfaq1-q':'¿Cuánto tarda una obra pequeña?','obrasfaq1-a':'Depende del trabajo: un tabique puede estar listo en días, un baño completo en 1 o 2 semanas. Siempre te damos un plazo claro antes de empezar.',
    'obrasfaq2-q':'¿Necesito licencia para una obra pequeña?','obrasfaq2-a':'No siempre. Te asesoramos en cada caso y, si hace falta tramitación, nos encargamos nosotros.',
    'obrasfaq3-q':'¿Puedo hacer cambios durante la obra?','obrasfaq3-a':'Sí. Cualquier cambio se presupuesta antes de ejecutarse. Sin sorpresas en la factura.',
    'obrasfaq4-q':'¿En qué zonas trabajáis?','obrasfaq4-a':'Trabajamos en varias zonas. Escríbenos con tu dirección y te confirmamos disponibilidad sin compromiso.',
    'reformafaq1-q':'¿Cuánto tarda una reforma integral?','reformafaq1-a':'Baño: 2-3 semanas. Cocina: 3-4 semanas. Vivienda completa: 6-10 semanas. Siempre con calendario previo.',
    'reformafaq2-q':'¿Tengo que irme de casa durante la reforma?','reformafaq2-a':'En reformas parciales normalmente no. Para integrales completas te lo indicamos antes de empezar.',
    'reformafaq3-q':'¿El presupuesto puede variar?','reformafaq3-a':'Solo si hay imprevistos estructurales o cambias el alcance. Cualquier variación se informa y aprueba antes.',
    'manitasfaq1-q':'¿Actuáis fuera de horario?','manitasfaq1-a':'Sí, tenemos servicio de urgencias. Las urgencias nocturnas o en festivo tienen tarifa diferenciada que te indicamos antes de actuar.',
    'manitasfaq2-q':'¿Me dais precio antes de empezar?','manitasfaq2-a':'Siempre. En reparaciones pequeñas damos precio cerrado por tipo de trabajo. Sin sorpresas al terminar.',
    'manitasfaq3-q':'¿Hacéis trabajos muy pequeños?','manitasfaq3-a':'Sí. No hay trabajo demasiado pequeño para obreko. Preferimos resolverlo ahora que esperar a que sea mayor.',
    'mantfaq1-q':'¿Puedo contratar estando fuera?','mantfaq1-a':'Es exactamente para eso. Muchos de nuestros clientes viven fuera y nos confían el cuidado de su propiedad. Lo gestionamos todo por ti.',
    'mantfaq2-q':'¿Cómo me informáis de las incidencias?','mantfaq2-a':'A través de nuestra propia app, diseñada para que estés al tanto en todo momento: fotos, estado del trabajo, incidencias y presupuestos en tiempo real. Todo en un solo lugar, desde cualquier parte del mundo.',
    'mantfaq3-q':'¿Qué incluye un plan de mantenimiento?','mantfaq3-a':'Desde revisiones trimestrales básicas hasta un servicio mensual completo. Te hacemos una propuesta a medida.',
    'obras-b1-n':'Tabiques y distribución','obras-b1-d':'Construimos, tiramos o modificamos paredes interiores para adaptar el espacio a tus necesidades.',
    'obras-b2-n':'Aperturas y cierres','obras-b2-d':'Puertas, ventanas, huecos nuevos o tapiados. Con los refuerzos necesarios y acabado perfecto.',
    'obras-b3-n':'Alicatados y solados','obras-b3-d':'Colocación de azulejos, gresite, porcelánico y todo tipo de revestimientos en suelos y paredes.',
    'obras-b4-n':'Techos y revestimientos','obras-b4-d':'Falsos techos, molduras, pintura y acabados interiores con atención al detalle.',
    'obras-b5-n':'Pequeñas obras estructurales','obras-b5-d':'Escalones, rampas, refuerzos, soleras y trabajos de obra menor con garantía de calidad.',
    'obras-b6-n':'Coordinación sin estrés','obras-b6-d':'Un solo interlocutor para toda la obra. Tú no tienes que gestionar ni llamar a nadie.',
    'obras-b7-n':'Proyectos de arquitectura','obras-b7-d':'Diseño y dirección de obra con arquitecto colegiado. Planos, licencias, memoria técnica y ejecución. Todo bajo un mismo paraguas.',
    'obras-intro-p':'<p>Desde poner un tabique hasta abrir un hueco, alicatar un baño o reformar un techo. En <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> ejecutamos obras de interior y proyectos de arquitectura con profesionalidad y limpieza, sin que tengas que preocuparte de nada.</p><p style="margin-top:1.2rem;font-size:.92rem;color:var(--muted);line-height:1.9">¿Tienes dudas sobre tu proyecto? Escríbenos sin compromiso y te respondemos en menos de 48 horas.</p>',
    'reforma-intro-p':'<p>En <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> coordinamos todos los oficios — albañilería, fontanería, electricidad, cerrajería, pintura — para que tú solo tengas que aprobar el resultado final.</p><p style="margin-top:1.2rem;font-size:.92rem;color:var(--muted);line-height:1.9">¿No sabes por dónde empezar? Cuéntanos lo que tienes en mente y te orientamos sin compromiso.</p>',
    'manitas-intro-p':'<p>Goteras, enchufes, persianas atascadas, grifos que gotean. En <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> tenemos los profesionales adecuados para cada avería, listos para actuar rápido con precio pactado antes de empezar.</p><p style="margin-top:1.2rem;font-size:.92rem;color:var(--muted);line-height:1.9">Llámanos o escríbenos por WhatsApp para urgencias. Respondemos en minutos.</p>',
    'mant-intro-p':'<p>En <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> ofrecemos planes de mantenimiento periódico pensados para propietarios con segunda residencia, piso en alquiler, o quienes prefieren delegar el cuidado de su casa a profesionales.</p><p style="margin-top:1.2rem;font-size:.92rem;color:var(--muted);line-height:1.9">Muchos de nuestros clientes viven fuera. Somos sus ojos y manos en Tenerife y Madrid.</p>',
    'reforma-b1-n':'Reforma de cocina','reforma-b1-d':'Distribución, instalaciones, encimeras, electrodomésticos integrados. Sin gestionar gremios.',
    'reforma-b2-n':'Reforma de baño','reforma-b2-d':'Desde cambio de revestimientos hasta reforma completa con nueva fontanería. Acabados de calidad.',
    'reforma-b3-n':'Reforma integral de vivienda','reforma-b3-d':'Diseño, gestión y ejecución completa con un solo presupuesto y un único responsable.',
    'reforma-b4-n':'Pintura de fachadas y viviendas','reforma-b4-d':'Pintura interior y exterior, fachadas, locales comerciales. Acabados profesionales duraderos.',
    'reforma-b5-n':'Cambio de distribución','reforma-b5-d':'Derribar tabiques, crear espacios abiertos o dividir estancias. Con permisos y estructura incluidos.',
    'reforma-b6-n':'Rehabilitación energética','reforma-b6-d':'Aislamiento, ventanas eficientes, climatización. Reduce consumo y gana confort.',
    'manitas-b1-n':'Fontanería urgente','manitas-b1-d':'Goteras, fugas, desatascos, reparación de grifería. Actuamos el mismo día o en 48h.',
    'manitas-b2-n':'Electricidad','manitas-b2-d':'Averías eléctricas, instalación de puntos de luz, sustitución de cuadros.',
    'manitas-b3-n':'Carpintería y cerrajería','manitas-b3-d':'Puertas que no cierran, ventanas con problemas, apertura de urgencia, cerraduras.',
    'manitas-b4-n':'Pintura y pequeñas obras','manitas-b4-d':'Reparar un hueco, pintar una habitación, alisar una pared. Arreglos que quedan como nuevos.',
    'manitas-b5-n':'Pequeñas instalaciones','manitas-b5-d':'Montar un mueble, instalar un aparato de aire, anclar una televisión. Rápido y bien hecho.',
    'manitas-b6-n':'Servicio de urgencias','manitas-b6-d':'Disponibles fuera de horario habitual. Precio diferenciado comunicado antes de actuar.',
    'mant-b1-n':'Plan de revisiones periódicas','mant-b1-d':'Visitas programadas para detectar desperfectos antes de que sean urgencias.',
    'mant-b2-n':'Gestión de segunda residencia','mant-b2-d':'Tu casa de vacaciones siempre lista. Revisamos y preparamos la vivienda antes de tu llegada.',
    'mant-b3-n':'Coordinación con propietarios ausentes','mant-b3-d':'Si tu inmueble está en alquiler, gestionamos incidencias y reparaciones en tu nombre.',
    'mant-b4-n':'Mantenimiento de exteriores','mant-b4-d':'Jardines, terrazas, piscinas. Cuidamos los espacios exteriores con la misma dedicación que el interior.',
    'mant-b5-n':'Informes con fotos','mant-b5-d':'Recibes un informe detallado en cada visita. Total transparencia de lo que ocurre en tu propiedad.',
    'mant-b6-n':'Plan a medida','mant-b6-d':'Diseñamos el plan según tu inmueble y tus necesidades. Sin paquetes cerrados.'
  },
  en:{
    'nos-bc':'Why <span class="brand">obreko</span>','nos-tag':'Origin · Values · Commitment',
    'mm-unete':'Join the team',
    'unete-bc':'Join the team','unete-tag':'Professionals · Vocation · Future',
    'unete-h1':'We look for people<br><strong>who do things right.</strong>',
    'unete-hsub':'At obreko we don\'t hire employees, we bring in professionals. If you take pride in your work and want to be part of a serious team, we\'re looking for you.',
    'unete-eyebrow1':'Why <span class="brand" style="font-size:1.4em;color:var(--navy2)">obreko</span>','unete-why-h':'A place to grow.',
    'unete-why-p':'<p>Working at <span class="brand" style="font-size:1.1em;color:var(--navy2)">obreko</span> means stability, respect and real projects. We don\'t subcontract to cut costs — we build a team to do things with pride. Great atmosphere, on-time payments and the chance to grow within the company.</p>',
    'unete-eyebrow2':'What we offer','unete-bento-h':'Being our human capital.',
    'unete-b1-n':'You get paid. Always.','unete-b1-d':'No waiting, no excuses. The agreed day, the agreed amount. Punctuality in payment matters to us as much as punctuality on the job.',
    'unete-b2-n':'Constant workload','unete-b2-d':'Real projects week after week. No quiet spells, no uncertainty.',
    'unete-b3-n':'Our own app','unete-b3-d':'Manage your work from the <span class="brand" style="font-size:1.25em;color:var(--yellow)">obreko</span> app. Job sheets, alerts and incidents all in one place.',
    'unete-b4-n':'A real team','unete-b4-d':'Close management, committed colleagues and an environment where you\'re heard. You\'re not a number here.',
    'unete-b5-n':'Safety comes first.','unete-b5-d':'We work with all necessary protective equipment and follow safety protocols on every job. Your wellbeing is non-negotiable.',
    'unete-b6-n':'You bring the skill. We bring the rest.','unete-b6-d':'Tools, materials, vehicle and admin handled. You don\'t need to put anything in out of pocket to work with us.',
    'unete-eyebrow3':'Profiles we seek','unete-perfiles-h':'Are you one of us?',
    'unete-p1':'Bricklayers and construction workers','unete-p2':'Plumbers and electricians',
    'unete-p3':'Painters and coating applicators','unete-p4':'Carpenters and fitters',
    'unete-p5':'Maintenance technicians','unete-p6':'All-round handymen with experience',
    'unete-perfiles-p':'If your profile isn\'t on the list but you think you\'re a good fit, get in touch anyway. We value attitude as much as skill.',
    'unete-cta-h':'Ready to join?','unete-cta-p':'Send us a message with your experience and area. We\'ll get back to you within 48 hours.',
    'unete-cta-btn':'Write to obreko →',
    'nos-h1':'A team built<br><strong>to last.</strong>',
    'nos-hsub':'Professionals with years of experience who chose to join forces. Because alone we go faster, but together we go further.',
    'nos-eyebrow1':'Our story','nos-intro-h':'How obreko came to be.',
    'nos-intro-p':'<p><em style="font-family:\'Playfair Display\',serif;font-style:italic">obreko</em> was born from the union of independent tradespeople with extensive backgrounds in construction, renovation and home services. Each an expert in their craft. All sharing the same approach: no shortcuts, no excuses, and the client always at the centre.</p><p>The idea is simple: bring together talent that already existed, add structure, and offer something the market rarely delivers — a serious, coordinated and human service.</p>',
    'nos-quote':'"Alone we go faster, but together we go further."',
    'nos-eyebrow2':'Our values','nos-bull-h':'What we <strong style="font-style:normal">believe in.</strong>',
    'nos-b1-n':'Honesty','nos-b1-d':'Real quotes from day one. What we agree is what you pay. No fine print, no hidden charges.',
    'nos-b2-n':'Our own team','nos-b2-d':'We are specialised tradespeople who chose to work together. No subcontractors or middlemen. The person who comes to your home is one of us.',
    'nos-b3-n':'Transparency','nos-b3-d':'We keep you updated at every stage. Photos, updates and whatever progress report you need. Without you having to ask.',
    'nos-b4-n':'Punctuality','nos-b4-d':'We meet our schedules. If something unexpected comes up, you\'re the first to know and receive a solution.',
    'nos-b5-n':'Lasting commitment','nos-b5-d':'We don\'t disappear when the job is done. You\'re a client for life and we\'re here whenever you need us.',
    'nos-b6-n':'Environment','nos-b6-d':'Responsible waste management on every job. We work with authorised handlers, separate materials for recycling and avoid illegal dumping.',
    'nos-eyebrow3':'Sustainability','nos-env-h':'The environment matters.',
    'nos-env-p':'<p>Every job generates waste. What sets a responsible professional apart is how they manage it. At obreko we work with authorised waste handlers, separate materials for recycling and avoid illegal dumping.</p><p>Tenerife and Madrid are unique environments. Looking after them is also our responsibility.</p>',
    'cb-text':'We use cookies to improve your experience. You can accept all or customise which cookies you allow.','cb-policy':'Cookie policy','cb-accept':'Accept all','cb-configure':'Customise',
    'cm-title':'Cookie settings','cm-desc':'Choose which types of cookies you want to allow. Necessary cookies cannot be disabled as they are essential for the site to work.',
    'cm-cat-nec':'Necessary cookies','cm-cat-nec-desc':'Essential for the site to function: language preferences, form sessions. Without these cookies the site cannot work properly.',
    'cm-cat-ana':'Analytics cookies','cm-cat-ana-desc':'Help us understand how users navigate the site to improve the experience. Data is anonymous and aggregated.',
    'cm-cat-mkt':'Marketing cookies','cm-cat-mkt-desc':'Allow relevant ads to be shown based on your interests. We do not currently use them, but they may be activated in the future.',
    'cm-reject':'Reject optional','cm-save':'Save preferences',
    'consent-text':'I have read and accept the <button onclick="openLegal(\'lPriv\')" style="background:none;border:none;color:rgba(255,255,255,.65);font-size:.82rem;cursor:pointer;text-decoration:underline;padding:0;font-family:inherit">privacy and data protection policy</button>. I consent to the processing of my data to handle my request.',
    'priv-h1':'Privacy Policy','priv-h-resp':'Data Controller','priv-p-resp':'obreko · Tenerife, Canary Islands · hola@obreko.com',
    'priv-h-fin':'Purpose','priv-p-fin':'To manage quote requests and enquiries received through the web form.',
    'priv-h-leg':'Legal basis','priv-p-leg':'Consent of the data subject by ticking the acceptance checkbox.',
    'priv-h-dest':'Recipients','priv-p-dest':'Data will not be shared with third parties except where required by law.',
    'priv-h-der':'Rights','priv-p-der':'You may exercise your rights of access, rectification, erasure and objection by writing to hola@obreko.com.',
    'aviso-h1':'Legal Notice','aviso-h-tit':'Website Owner','aviso-p-tit':'Pronexo Hábitat SLL (obreko) · Tenerife, Canary Islands · hola@obreko.com',
    'aviso-h-obj':'Purpose','aviso-p-obj':'This legal notice governs the use of the obreko website, owned by Pronexo Hábitat SLL.',
    'aviso-h-pi':'Intellectual Property','aviso-p-pi':'All content on this website is the property of Pronexo Hábitat SLL and is protected by applicable intellectual property legislation.',
    'cook-h1':'Cookie Policy','cook-h-que':'What are cookies?','cook-p-que':'Cookies are small text files that websites store on your device.',
    'cook-h-util':'Cookies used','cook-p-util':'This website does not use third-party or tracking cookies. Only strictly necessary session cookies required for the site to function are used.',
    'hc-domotica':'Smart Home Active',
    'hc-room-0':'Exterior','hc-room-1':'Living room','hc-room-2':'Kitchen','hc-room-3':'Bedroom','hc-room-4':'Bathroom',
    'hc-nav-enter':'Enter the house','hc-nav-ext':'Go outside','hc-nav-cocina':'Go to kitchen','hc-nav-dorm':'Go to bedroom','hc-nav-bano':'Go to bathroom','hc-nav-bsal':'Back to living room','hc-nav-bcoc':'Back to kitchen','hc-nav-bdor':'Back to bedroom',
    'hc-ext-d0-n':'4K Outdoor Camera','hc-ext-d0-v':'Recording · Online 24/7',
    'hc-ext-d1-n':'Garden & access lights','hc-ext-d1-v':'Motion sensor · Auto',
    'hc-ext-d2-n':'Video doorbell','hc-ext-d2-v':'Connected to your phone · App',
    'hc-ext-d3-n':'Smart lock','hc-ext-d3-v':'Fingerprint / code / app',
    'hc-ext-d4-n':'Motion sensor','hc-ext-d4-v':'Perimeter · Active',
    'hc-sal-d0-n':'Lighting','hc-sal-d0-v':'4 zones · 70% · Warm tone',
    'hc-sal-d1-n':'Motorised blinds','hc-sal-d1-v':'Open · Auto sunrise',
    'hc-sal-d2-n':'Thermostat','hc-sal-d2-v':'21°C · Comfort mode',
    'hc-sal-d3-n':'Multiroom audio','hc-sal-d3-v':'Sonos / Alexa · Active',
    'hc-sal-d4-n':'Presence sensor','hc-sal-d4-v':'Occupied · Scene active',
    'hc-coc-d0-n':'Smart lights','hc-coc-d0-v':'Dimmable LED · Cool white',
    'hc-coc-d1-n':'Thermostat','hc-coc-d1-v':'22°C · Auto by zone',
    'hc-coc-d2-n':'Smart appliances','hc-coc-d2-v':'Monitored · Connected',
    'hc-coc-d3-n':'Indoor camera','hc-coc-d3-v':'Recording · 24/7',
    'hc-coc-d4-n':'Presence sensor','hc-coc-d4-v':'Active · Automatic lights',
    'hc-dor-d0-n':'Smart lights','hc-dor-d0-v':'Warm · 30% · Rest mode',
    'hc-dor-d1-n':'Motorised blinds','hc-dor-d1-v':'Closed · Night mode',
    'hc-dor-d2-n':'Thermostat','hc-dor-d2-v':'19°C · Rest mode',
    'hc-dor-d3-n':'Sound system','hc-dor-d3-v':'Multiroom · Active',
    'hc-dor-d4-n':'Presence sensor','hc-dor-d4-v':'Occupied · Night mode',
    'hc-ban-d0-n':'Smart lights','hc-ban-d0-v':'Dimmable · Natural tone',
    'hc-ban-d1-n':'Humidity sensor','hc-ban-d1-v':'62% · Auto extractor',
    'hc-ban-d2-n':'Hot water','hc-ban-d2-v':'38°C · Ready to use',
    'hc-ban-d3-n':'Underfloor heating','hc-ban-d3-v':'23°C · Active',
    'mm-close':'Close','mm-inicio':'Home','mm-servicios':'Services','mm-contacto':'Contact',
    'mm-interesar':'You might like','mm-wa':'Direct WhatsApp','mm-testi':'Testimonials',
    'mm-como':'How we work','mm-proceso':'Our process','mm-porqué':'Why <span class="brand">obreko</span>',
    'nav-obras':'Works',
    'nav-reforma':'Renovations',
    'nav-manitas':'Handyman',
    'nav-mant':'Maintenance',
    'nav-hogar':'Smart Home',
    'nav-ppto':'Get a Quote',
    'hero-h1':'Your space,<strong>transformed.</strong>',
    'hero-sub':'Construction, renovations, maintenance and smart home. One team. Real deadlines. No surprises.',
    'btn-ppto':'Request a quote',
    'btn-servicios':'View services',
    'stat-years':'years in Tenerife',
    'strip-obras':'Works & Projects',
    'strip-reforma':'Full Renovation',
    'strip-manitas':'Handyman & Urgent',
    'strip-mant':'Maintenance & Care',
    'strip-hogar':'Smart Home',
    'stat-exp':'Years of experience',
    'stat-proj':'Projects completed',
    'stat-team':'In-house team',
    'stat-resp':'Guaranteed response',
    'proc-intro':'No surprises, no middlemen. Professionals with over 10 years of experience. A single point of contact coordinates your entire project from start to finish.',
    'testi-h':'What our<br>clients say.','testi-empty-msg':'We just launched. Be one of the first to share your experience with us.','testi-empty-btn':'Share your experience →',
    'cta-eyebrow':'Have a project?',
    'cta-h':'Clear quote<br>in 48 hours.',
    'cta-sub':'No commitment. We reply with a detailed breakdown, no hidden fees.',
    'cta-btn':'Request a quote →',
    'cov-h':'Two territories.<br>The same commitment.',
    'hc-h1':'Your whole home,<br>from one place.',
    'hc-h2':'Your home works<br>while you live.',
    'hc-h3':'Choose your level<br>of automation.',
    'hc-why-h':'Why<br>choose us?',
    'hc-proc-h':'Work process.',
    'hc-steps-h':'Next steps.',
    'hc-cta-h':'Free diagnostic visit.',
    'hc-cta-sub':'We show you what\'s possible in your home. No commitment.',
    'hc-cta-btn':'Book a visit →',
    // Shared service page elements
    'svc-hbtn':'Request a free quote',
    'bull-eyebrow':'What\'s included',
    'bull-h':'Everything you <strong style="font-style:normal">need.</strong>',
    'faq-eyebrow':'Frequently asked questions',
    'faq-h':'We answer<br>your questions.',
    'btn-pedir':'Request a quote →',
    'btn-contactar':'Contact us now →',
    // OBRAS
    'obras-tag':'Walls · Renovation · Architecture · Finishes',
    'obras-h1':'Works &amp;<br><strong>Projects.</strong>',
    'obras-hsub':'We carry out interior works and architecture projects quickly and cleanly. Walls, openings, tiling, ceilings and much more. Without you having to manage anything.',
    'obras-intro-h':'Your work, sorted without complications.',
    'svc-cta-start':'Ready to get started?',
    'svc-cta-start-p':'Clear quote in 48 hours. No commitment.',
    // REFORMA
    'reforma-tag':'Transform · Improve · Adapt',
    'reforma-h1':'Full<br><strong>renovation.</strong>',
    'reforma-hsub':'Your home exactly as you always wanted it. No chaos, no delays, no surprise bills.',
    'reforma-intro-h':'The renovation you always wanted to do.',
    // MANITAS
    'manitas-tag':'Fast · Reliable · No searching',
    'manitas-h1':'Handyman &amp;<br><strong>Urgent repairs.</strong>',
    'manitas-hsub':'Small problems, fast solutions. No waiting, no hassle.',
    'manitas-intro-h':'Something broke. We fix it.',
    'manitas-cta-h':'Need us to come over?',
    'manitas-cta-p':'Tell us the problem. We respond fast.',
    // MANTENIMIENTO
    'mant-tag':'Prevent · Preserve · Relax',
    'mant-h1':'Maintenance<br><strong>&amp; Care.</strong>',
    'mant-hsub':'A trusted team that looks after your property when you can\'t be there.',
    'mant-intro-h':'Your property in trusted hands.',
    'mant-cta-h':'Want peace of mind about your property?',
    'mant-cta-p':'We design a custom plan for you. No commitment.',
    // PRESUPUESTO form
    'ppto-back':'← Back',
    'ppto-label':'Request a quote',
    'ppto-title':'Your project,<br>in safe<br><em>hands.</em>',
    'ppto-sub':'Tell us what you need. A specialist technician will contact you within 48h with a clear, no-surprise quote.',
    'ppto-g1':'Response within 48h',
    'ppto-g2':'No-commitment quote',
    'ppto-g3':'Fixed price, no surprises',
    'ppto-g4':'In-house team, no subcontractors',
    'ppto-form-t':'Tell us about your project',
    'ppto-btn':'Send request →',
    'consent-link':'privacy and data protection policy',
    'btn-saber-mas':'Learn more →',
    'ed-reforma-h':'Your home exactly<br>as you always wanted.',
    'ed-reforma-p':'We coordinate all trades — masonry, plumbing, electrical, locksmithing, painting — so you only have to approve the final result. No chaos, no delays, no surprise bills.',
    'ed-reforma-ul':'<li>Kitchen and bathroom renovation</li><li>Full home renovation</li><li>Facade and commercial painting</li><li>Layout changes with permits</li>',
    'ed-obras-h':'Small works,<br>big differences.',
    'ed-obras-p':'Partition walls, openings, tiling, flooring, ceilings, minor structural work. We execute cleanly and quickly, without you having to manage anything.',
    'ed-obras-ul':'<li>Walls and interior layout</li><li>Openings and closures</li><li>Tiling and flooring</li><li>Ceilings and linings</li>',
    'ed-mant-h':'Your property in trusted hands.',
    'ed-mant-ul':'<li>Scheduled periodic inspections</li><li>Second home management</li><li>Detailed photo report after each visit</li><li>Incident coordination on your behalf</li>',
    'proc-eyebrow':'How we work',
    'proc-h':'How we do it.',
    'step1-t':'You tell us what you need','step1-d':'A real technician contacts you within 48h. First consultation at no charge.',
    'step2-t':'Fixed and clear quote','step2-d':'No fine print. We break down every item. The agreed price is the final price.',
    'step3-t':'Friction-free planning','step3-d':'We coordinate materials, trades and timelines. You just approve and await the result.',
    'step4-t':'Excellence in execution','step4-d':'Our own professionals, top-quality materials. Punctuality and cleanliness are non-negotiable.',
    'step5-t':'Delivery and warranty','step5-d':'Final review with you. If anything isn\'t 100%, we fix it at no extra cost.',
    'step6-t':'Your team, always','step6-d':'The relationship doesn\'t end with the project. We\'ll always be there when you need us.',
    'testi-eyebrow':'Testimonials','testi-hsub':'The best proof of our work is the word of those who have already trusted us.',
    'testi1-text':'"They renovated our kitchen and bathroom in three weeks. Total punctuality, exact price as quoted and a result that exceeded all expectations."',
    'testi1-svc':'Full renovation · Santa Cruz',
    'testi2-text':'"We have a villa in Tenerife that we manage from Madrid. obreko is totally trustworthy: they keep us informed with photos and resolve any incident without us having to fly over."',
    'testi2-svc':'Maintenance · Adeje',
    'testi3-text':'"I called on a Saturday about an urgent leak. Within two hours they were here, price agreed before starting and problem solved. That\'s how it should be."',
    'testi3-svc':'Handyman & Urgent · La Laguna',
    'wa-link':'or message us on WhatsApp',
    'cov-eyebrow':'Where we operate',
    'cov-p':'We operate in Tenerife and Madrid. If you have a property in either area, we\'re there. And if not, ask us — we keep growing.',
    'cov-active':'Active','cov-tf-zone':'Canary Islands · The whole island',
    'cov-tf-desc':'Our home base. Over 15 years operating across all municipalities of the island, from Santa Cruz to Adeje.',
    'cov-md-zone':'Community of Madrid · Centre and outskirts',
    'cov-md-desc':'Capital and metropolitan area. Renovations, maintenance and property management for owners who need a trusted team in Madrid.',
    'cov-expansion':'Expanding to other cities — if you have properties elsewhere, ask us.',
    'ft-desc':'Construction, renovations, handyman, maintenance and smart home in Tenerife and Madrid. One point of contact. No surprises.',
    'ft-servicios':'Services','ft-contacto':'Contact',
    'ft-copy':'© 2026 <span class="brand" style="font-size:1.05rem;color:rgba(255,255,255,.5)">obreko</span> · All rights reserved',
    'legal-priv':'Privacy','legal-aviso':'Legal notice','legal-cookies':'Cookies',
    'hc-feat-eyebrow':'What you can control',
    'hc-feat-desc':'Smart home technology integrates automation into your home to intelligently control lighting, climate, security and more — improving efficiency and comfort. At <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> we install it without building work.',
    'hcf1-t':'Smart lighting','hcf1-p':'Control brightness, colour and temperature from anywhere. Presence sensors, scenes and automatic schedules.',
    'hcf2-t':'Perfect climate control','hcf2-p':'Smart thermostats that learn your habits. Zone control, automatic switch-off when windows open.',
    'hcf3-t':'Security and access','hcf3-p':'Smart locks with code, fingerprint or smartphone. 24/7 cameras, video doorbell, door and motion sensors.',
    'hcf4-t':'Blinds and shutters','hcf4-p':'Motorise your existing blinds. Open and close at sunrise/sunset. Compatible with Alexa and Google.',
    'hcf5-t':'Multiroom audio','hcf5-p':'Your favourite music follows you around the home. Integration with Sonos, Chromecast and Alexa.',
    'hcf6-t':'Energy saving','hcf6-p':'Average 30% saving on your bill. Real-time monitoring of every device. Blinds that make the most of natural light.',
    'hcb1':'<div class="hc-feat-back-t">Smart lighting</div><ul class="hc-feat-back-list"><li>Full control by voice, app or conventional switch</li><li>Custom scenes: cinema, work, wake-up, night</li><li>Up to 60% savings on lighting consumption</li></ul>',
    'hcb2':'<div class="hc-feat-back-t">Perfect climate control</div><ul class="hc-feat-back-list"><li>Learns your routines and adjusts temperature automatically</li><li>Zone-by-zone control: living room, bedrooms, office</li><li>Save up to 35% on heating and air conditioning</li></ul>',
    'hcb3':'<div class="hc-feat-back-t">Security and access</div><ul class="hc-feat-back-list"><li>Keyless entry: code, fingerprint or smartphone</li><li>Real-time alerts when movement is detected</li><li>Compatible with existing alarm systems</li></ul>',
    'hcb4':'<div class="hc-feat-back-t">Blinds and shutters</div><ul class="hc-feat-back-list"><li>Automation based on outdoor sunlight</li><li>Installed on your existing blinds — no building work</li><li>Set schedules or control from anywhere</li></ul>',
    'hcb5':'<div class="hc-feat-back-t">Multiroom audio</div><ul class="hc-feat-back-list"><li>Different music in each room at the same time</li><li>Compatible with Spotify, Apple Music, YouTube Music</li><li>Voice control with Alexa, Google Assistant or Siri</li></ul>',
    'hcb6':'<div class="hc-feat-back-t">Energy saving</div><ul class="hc-feat-back-list"><li>Real-time monitoring of every device</li><li>Detects appliances consuming power on standby</li><li>Investment recovered in under 1 year</li></ul>',
    'hc-tl-eyebrow':'A day in your home',
    'hc-tl1':'Blinds open, soft lights, heating rises. Natural wake-up.',
    'hc-tl2':'Departure detected. Everything off, alarm on, thermostat down.',
    'hc-tl3':'Arrival. Lights on, perfect temperature, background music.',
    'hc-tl4':'Cinema mode. Dim lights, blinds closed, TV on.',
    'hc-tl5':'Good night. Everything off, doors verified, alarm active.',
    'hc-cmp-eyebrow':'How does it work?',
    'hc-cmp-p':'Both options are compatible with voice control (Alexa, Google, Siri). We advise you with no commitment.',
    'hc-cmp-badge':'Recommended',
    'hc-cmp1-t':'Without server','hc-cmp1-sub':'Google Home · Alexa · Apple Home',
    'hc-cmp1-ul':'<li>Lower initial cost</li><li>Simple setup</li><li>No additional hardware</li><li>Ideal for getting started</li>',
    'hc-cmp2-t':'With server · Home Assistant','hc-cmp2-sub':'Works without internet · Local and private',
    'hc-cmp2-ul':'<li>Works without internet (local)</li><li>+2,000 integrations available</li><li>Unlimited automations</li><li>Total privacy — your data stays home</li><li>No monthly fees</li><li>Connects all brands</li>',
    'hc-why-eyebrow':'Reasons to trust us',
    'hcw1-t':'Specialisation','hcw1-p':'Experts in smart home and intelligent installations. We know the industry inside out.','hcw1-s':'years in the field',
    'hcw2-t':'No hidden fees','hcw2-p':'Home Assistant is open source, with no mandatory subscriptions.','hcw2-s':'in subscriptions',
    'hcw3-t':'Total flexibility','hcw3-p':'We adapt every installation to the client\'s needs.','hcw3-s':'custom projects',
    'hcw4-t':'Ongoing support','hcw4-p':'Preventive maintenance and incident resolution whenever you need it.','hcw4-s':'active support',
    'hcw5-t':'Competitive pricing','hcw5-p':'Unbeatable value for money in the local market.','hcw5-s':'return on investment',
    'hcp1-lbl':'Step 01','hcp1-t':'Contact','hcp1-p':'You tell us about the project and your needs.',
    'hcp2-lbl':'Step 02','hcp2-t':'Proposal','hcp2-p':'We prepare a detailed quote within 48h.',
    'hcp3-lbl':'Step 03','hcp3-t':'Coordination','hcp3-p':'We plan the installation with your build team.',
    'hcp4-lbl':'Step 04','hcp4-t':'Installation','hcp4-p':'We execute the project cleanly and professionally.',
    'hcp5-lbl':'Step 05','hcp5-t':'Handover','hcp5-p':'Full training and documentation.',
    'hcp6-lbl':'Step 06','hcp6-t':'Support','hcp6-p':'Ongoing maintenance.',
    'hc-pasos-eyebrow':'Get started now',
    'hcpa1-t':'Alignment meeting','hcpa1-p':'We define the collaboration model and terms.',
    'hcpa2-t':'Pilot project','hcpa2-p':'We carry out a first joint installation.',
    'hcpa3-t':'Adjustments and feedback','hcpa3-p':'We optimise the process based on experience.',
    'hcpa4-t':'Scaling','hcpa4-p':'We integrate smart home into all your projects.',
    'hcfaq1-q':'Is building work needed to install smart home?','hcfaq1-a':'Not necessarily. We have wireless WiFi/Zigbee solutions that install without any building work, perfect for finished homes and renovations.',
    'hcfaq2-q':'Are there monthly fees?','hcfaq2-a':'No. With Home Assistant (our recommended option) you pay for the installation once and it\'s yours forever. No subscriptions or manufacturer dependency.',
    'hcfaq3-q':'Is it compatible with what I already have?','hcfaq3-a':'In most cases yes, or it requires minimal adaptations. We do a free visit to assess your current setup before proposing anything.',
    'hcfaq4-q':'What happens if there\'s a power or internet outage?','hcfaq4-a':'With Home Assistant the system runs locally without internet. All devices keep manual emergency mode. You\'re never left without control.',
    'obrasfaq1-q':'How long does a small job take?','obrasfaq1-a':'It depends on the work: a partition wall can be done in days, a full bathroom in 1 to 2 weeks. We always give you a clear timeline before we start.',
    'obrasfaq2-q':'Do I need a permit for small works?','obrasfaq2-a':'Not always. We advise you case by case and, if paperwork is needed, we handle it for you.',
    'obrasfaq3-q':'Can I make changes during the work?','obrasfaq3-a':'Yes. Any change is quoted before being carried out. No surprises on the bill.',
    'obrasfaq4-q':'What areas do you cover?','obrasfaq4-a':'We work in several areas. Send us your address and we\'ll confirm availability with no commitment.',
    'reformafaq1-q':'How long does a full renovation take?','reformafaq1-a':'Bathroom: 2-3 weeks. Kitchen: 3-4 weeks. Full home: 6-10 weeks. Always with a schedule agreed in advance.',
    'reformafaq2-q':'Do I need to leave home during the renovation?','reformafaq2-a':'For partial renovations usually not. For complete full-home renovations we\'ll let you know beforehand.',
    'reformafaq3-q':'Can the quote change?','reformafaq3-a':'Only if there are unforeseen structural issues or you change the scope. Any variation is communicated and approved first.',
    'manitasfaq1-q':'Do you work outside business hours?','manitasfaq1-a':'Yes, we have an emergency service. Night or holiday call-outs have a differentiated rate which we communicate before acting.',
    'manitasfaq2-q':'Do you give a price before starting?','manitasfaq2-a':'Always. For small repairs we give a fixed price by job type. No surprises at the end.',
    'manitasfaq3-q':'Do you do very small jobs?','manitasfaq3-a':'Yes. No job is too small for obreko. We prefer to fix it now rather than wait for it to get worse.',
    'mantfaq1-q':'Can I hire you from abroad?','mantfaq1-a':'That\'s exactly what we\'re here for. Many of our clients live abroad and trust us with the care of their property. We handle everything for you.',
    'mantfaq2-q':'How do you keep me informed of incidents?','mantfaq2-a':'Through our own app, designed so you\'re always in the loop: photos, job status, incidents and quotes in real time. Everything in one place, from anywhere in the world.',
    'mantfaq3-q':'What does a maintenance plan include?','mantfaq3-a':'From basic quarterly checks to a full monthly service. We make you a tailored proposal.',
    'obras-b1-n':'Walls and partitions','obras-b1-d':'We build, demolish or modify interior walls to adapt the space to your needs.',
    'obras-b2-n':'Openings and closures','obras-b2-d':'Doors, windows, new or blocked openings. With necessary reinforcements and perfect finish.',
    'obras-b3-n':'Tiling and flooring','obras-b3-d':'Installation of tiles, mosaic, porcelain and all types of wall and floor coverings.',
    'obras-b4-n':'Ceilings and linings','obras-b4-d':'Drop ceilings, mouldings, painting and interior finishes with attention to detail.',
    'obras-b5-n':'Minor structural works','obras-b5-d':'Steps, ramps, reinforcements, slabs and minor building works with quality guarantee.',
    'obras-b6-n':'Stress-free coordination','obras-b6-d':'One single point of contact for the whole project. You don\'t have to manage or call anyone.',
    'obras-b7-n':'Architecture projects','obras-b7-d':'Design and site management with a registered architect. Plans, permits, technical report and execution. All under one roof.',
    'obras-intro-p':'<p>From putting up a partition to opening a wall, tiling a bathroom or renovating a ceiling. At <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> we carry out interior works and architecture projects with professionalism and care, without you having to worry about a thing.</p><p style="margin-top:1.2rem;font-size:.92rem;color:var(--muted);line-height:1.9">Have questions about your project? Write to us with no commitment and we\'ll get back to you within 48 hours.</p>',
    'reforma-intro-p':'<p>At <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> we coordinate all the trades — masonry, plumbing, electrical, locksmithing, painting — so you only have to approve the final result.</p><p style="margin-top:1.2rem;font-size:.92rem;color:var(--muted);line-height:1.9">Not sure where to start? Tell us what you have in mind and we\'ll guide you with no commitment.</p>',
    'manitas-intro-p':'<p>Leaks, sockets, stuck blinds, dripping taps. At <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> we have the right professional for every breakdown, ready to act quickly with an agreed price before we start.</p><p style="margin-top:1.2rem;font-size:.92rem;color:var(--muted);line-height:1.9">Call us or message us on WhatsApp for urgent jobs. We respond in minutes.</p>',
    'mant-intro-p':'<p>At <span class="brand" style="font-size:1.25em;color:var(--navy2)">obreko</span> we offer periodic maintenance plans designed for owners with a second home, a rental property, or those who prefer to leave the care of their home to professionals.</p><p style="margin-top:1.2rem;font-size:.92rem;color:var(--muted);line-height:1.9">Many of our clients live elsewhere. We are their eyes and hands in Tenerife and Madrid.</p>',
    'reforma-b1-n':'Kitchen renovation','reforma-b1-d':'Layout, installations, worktops, integrated appliances. No need to manage trades.',
    'reforma-b2-n':'Bathroom renovation','reforma-b2-d':'From replacing finishes to a full renovation with new plumbing. Quality finishes.',
    'reforma-b3-n':'Full home renovation','reforma-b3-d':'Design, management and full execution with a single quote and a single point of responsibility.',
    'reforma-b4-n':'Facade and home painting','reforma-b4-d':'Interior and exterior painting, facades, commercial premises. Long-lasting professional finishes.',
    'reforma-b5-n':'Layout changes','reforma-b5-d':'Knock down walls, create open spaces or divide rooms. Permits and structure included.',
    'reforma-b6-n':'Energy refurbishment','reforma-b6-d':'Insulation, efficient windows, climate control. Reduce consumption and gain comfort.',
    'manitas-b1-n':'Emergency plumbing','manitas-b1-d':'Leaks, blockages, tap repairs. We act the same day or within 48h.',
    'manitas-b2-n':'Electrical','manitas-b2-d':'Electrical faults, light point installation, panel replacement.',
    'manitas-b3-n':'Joinery and locksmithing','manitas-b3-d':'Doors that won\'t close, window problems, emergency entry, locks.',
    'manitas-b4-n':'Painting and small works','manitas-b4-d':'Patch a hole, paint a room, smooth a wall. Repairs that look like new.',
    'manitas-b5-n':'Small installations','manitas-b5-d':'Assemble furniture, install an air unit, mount a TV. Fast and done right.',
    'manitas-b6-n':'Emergency service','manitas-b6-d':'Available outside regular hours. Differentiated price communicated before we act.',
    'mant-b1-n':'Periodic inspection plan','mant-b1-d':'Scheduled visits to detect issues before they become emergencies.',
    'mant-b2-n':'Second home management','mant-b2-d':'Your holiday home always ready. We check and prepare the property before your arrival.',
    'mant-b3-n':'Coordination for absent owners','mant-b3-d':'If your property is rented, we manage incidents and repairs on your behalf.',
    'mant-b4-n':'Exterior maintenance','mant-b4-d':'Gardens, terraces, pools. We care for outdoor spaces with the same dedication as indoors.',
    'mant-b5-n':'Photo reports','mant-b5-d':'You receive a detailed report after each visit. Full transparency of what\'s happening at your property.',
    'mant-b6-n':'Tailored plan','mant-b6-d':'We design the plan around your property and needs. No fixed packages.'
  }
};

var _i18nPlaceholders={
  es:{
    pptoNombre:'Nombre *', pptoTel:'Teléfono *', pptoEmail:'Email *',
    pptoMsg:'Cuéntanos qué necesitas...',
    pptoSvc:'Tipo de servicio *'
  },
  en:{
    pptoNombre:'Name *', pptoTel:'Phone *', pptoEmail:'Email *',
    pptoMsg:'Tell us what you need...',
    pptoSvc:'Type of service *'
  }
};

function switchLang(lang){
  if(!_i18n[lang])return;
  var dict=_i18n[lang];
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    var key=el.getAttribute('data-i18n');
    if(!dict[key])return;
    if(el.getAttribute('data-i18n-html')==='1'){
      el.innerHTML=dict[key];
    } else {
      el.textContent=dict[key];
    }
  });
  // update form placeholders
  var ph=_i18nPlaceholders[lang];
  if(ph){
    ['pptoNombre','pptoTel','pptoEmail','pptoMsg'].forEach(function(id){
      var el=document.getElementById(id);
      if(el)el.placeholder=ph[id];
    });
    var sel=document.getElementById('pptoSvc');
    if(sel&&sel.options[0])sel.options[0].text=ph.pptoSvc;
  }
  // update lang toggle button states
  document.querySelectorAll('.lang-btn').forEach(function(btn){
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase()===lang);
  });
  // update html lang attribute
  document.documentElement.lang=lang==='es'?'es':'en';
  // re-sync room names in smart home panel
  if(window._hcUpdateNav)window._hcUpdateNav();
  // persist
  try{localStorage.setItem('obreko-lang',lang);}catch(e){}
  // update page title
  document.title=lang==='es'
    ? 'obreko · Reformas y mantenimiento en Tenerife'
    : 'obreko · Home renovations & maintenance in Tenerife';
}

// restore saved language on load
(function(){
  try{
    var saved=localStorage.getItem('obreko-lang');
    if(saved&&saved!=='es')switchLang(saved);
  }catch(e){}
})();




(function(){
  var STORAGE_KEY = 'obreko-cookies-v2';

  function getPrefs(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)); }catch(e){ return null; }
  }
  function savePrefs(analytics, marketing){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({analytics:analytics, marketing:marketing, ts:Date.now()})); }catch(e){}
  }

  var bar   = document.getElementById('cookieBar');
  var modal = document.getElementById('cookieModal');
  if(!bar || !modal) return;

  // If already decided, skip banner
  if(getPrefs()) return;

  // Show banner after intro animation
  setTimeout(function(){ bar.classList.add('cb-show'); }, 2600);

  // Accept all
  document.getElementById('cookieAccept').addEventListener('click', function(){
    savePrefs(true, true);
    hideBanner();
    if(window._gaConsentCallback) window._gaConsentCallback();
  });

  // Open config modal
  document.getElementById('cookieConfigure').addEventListener('click', function(){
    modal.classList.add('cm-open');
    document.body.style.overflow = 'hidden';
  });

  // Close modal X
  document.getElementById('cmClose').addEventListener('click', closeModal);

  // Click outside modal box closes it
  modal.addEventListener('click', function(e){
    if(e.target === modal) closeModal();
  });

  // Reject optional
  document.getElementById('cmReject').addEventListener('click', function(){
    savePrefs(false, false);
    closeModal();
    hideBanner();
  });

  // Save custom prefs
  document.getElementById('cmSave').addEventListener('click', function(){
    var ana = document.getElementById('ckAnalytics').checked;
    var mkt = document.getElementById('ckMarketing').checked;
    savePrefs(ana, mkt);
    closeModal();
    hideBanner();
    if(ana && window._gaConsentCallback) window._gaConsentCallback();
  });

  function hideBanner(){
    bar.classList.remove('cb-show');
  }
  function closeModal(){
    modal.classList.remove('cm-open');
    document.body.style.overflow = '';
  }
})();


// ══════════════════════════════════════════════════
// CANAL DE RECLAMACIONES, QUEJAS Y SUGERENCIAS
// ══════════════════════════════════════════════════
(function(){
  var _rcTipo = '';

  // Genera número de referencia: OBR-YYYYMMDD-XXXX
  function rcGenRef(){
    var now=new Date();
    var d=now.getFullYear().toString()+
      String(now.getMonth()+1).padStart(2,'0')+
      String(now.getDate()).padStart(2,'0');
    var r=String(Math.floor(1000+Math.random()*9000));
    return 'OBR-'+d+'-'+r;
  }

  // Plazo según tipo
  function rcPlazo(tipo){
    return tipo==='Reclamación' ? '15 días hábiles' : '30 días';
  }

  // Selección de categoría
  window.rcSelectCat=function(btn){
    document.querySelectorAll('.rc-cat').forEach(function(b){b.classList.remove('rc-active');});
    btn.classList.add('rc-active');
    _rcTipo=btn.getAttribute('data-tipo');
    var cb=document.getElementById('rcContinueBtn');
    if(cb){cb.disabled=false;cb.style.opacity='1';cb.style.cursor='pointer';}
  };

  // Ir al paso 2
  window.rcStep2=function(){
    if(!_rcTipo)return;
    document.getElementById('rcStep1').style.display='none';
    document.getElementById('rcStep2').style.display='block';
    document.getElementById('rcTipoLabel').textContent=_rcTipo;
    // Color del badge según tipo
    var badge=document.getElementById('rcTipoBadge');
    if(badge){
      badge.style.borderColor=_rcTipo==='Reclamación'?'rgba(248,113,113,.4)':
        _rcTipo==='Queja'?'rgba(251,191,36,.4)':'rgba(52,211,153,.4)';
      badge.style.background=_rcTipo==='Reclamación'?'rgba(239,68,68,.08)':
        _rcTipo==='Queja'?'rgba(245,158,11,.08)':'rgba(16,185,129,.08)';
    }
  };

  // Volver al paso 1
  window.rcBack=function(){
    document.getElementById('rcStep2').style.display='none';
    document.getElementById('rcStep1').style.display='block';
  };

  // Reset completo
  window.rcReset=function(){
    _rcTipo='';
    document.querySelectorAll('.rc-cat').forEach(function(b){b.classList.remove('rc-active');});
    var cb=document.getElementById('rcContinueBtn');
    if(cb){cb.disabled=true;cb.style.opacity='.35';cb.style.cursor='not-allowed';}
    ['rcNombre','rcTel','rcEmail','rcDesc'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.value='';
    });
    var sel1=document.getElementById('rcUbicacion');if(sel1)sel1.selectedIndex=0;
    var sel2=document.getElementById('rcServicio');if(sel2)sel2.selectedIndex=0;
    var cb2=document.getElementById('rcConsent');if(cb2)cb2.checked=false;
    document.getElementById('rcSuccess').style.display='none';
    document.getElementById('rcStep1').style.display='block';
    document.getElementById('rcStep2').style.display='none';
  };

  // Envío del formulario
  var rcBtn=document.getElementById('rcBtn');
  if(rcBtn)rcBtn.addEventListener('click',function(){
    var nombre   =(document.getElementById('rcNombre')||{}).value||'';
    var tel      =(document.getElementById('rcTel')||{}).value||'';
    var email    =(document.getElementById('rcEmail')||{}).value||'';
    var ubicacion=(document.getElementById('rcUbicacion')||{}).value||'';
    var servicio =(document.getElementById('rcServicio')||{}).value||'No especificado';
    var desc     =(document.getElementById('rcDesc')||{}).value||'';
    var consent  = document.getElementById('rcConsent');

    if(!nombre||!email||!ubicacion||!desc){
      alert('Por favor, completa los campos obligatorios: nombre, email, ubicación y descripción.');
      return;
    }
    if(consent&&!consent.checked){
      consent.closest('.pf-consent').style.outline='2px solid rgba(255,80,80,.6)';
      setTimeout(function(){consent.closest('.pf-consent').style.outline='';},2500);
      return;
    }

    var btn=this;
    btn.textContent='Enviando…';
    btn.disabled=true;

    var referencia=rcGenRef();
    var fecha=new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
    var plazo=rcPlazo(_rcTipo);

    var params={
      tipo:        _rcTipo,
      referencia:  referencia,
      nombre:      nombre,
      email_cliente: email,
      telefono:    tel||'No facilitado',
      ubicacion:   ubicacion,
      servicio:    servicio,
      descripcion: desc,
      fecha:       fecha,
      plazo:       plazo
    };

    function onOk(){
      // Mostrar pantalla de éxito
      document.getElementById('rcStep2').style.display='none';
      var suc=document.getElementById('rcSuccess');
      suc.style.display='block';
      document.getElementById('rcSuccessTitle').textContent=_rcTipo+' registrada';
      document.getElementById('rcRefDisplay').textContent=referencia;
      document.getElementById('rcSuccessNote').innerHTML=
        'Plazo máximo de respuesta: <strong>'+plazo+'</strong>. '+
        'Si necesitas contactarnos antes, indica siempre tu número de referencia.';
      btn.textContent='Enviar →';
      btn.disabled=false;
    }
    function onErr(e){
      console.error('EmailJS rc error:',e);
      btn.textContent='Error — inténtalo de nuevo';
      btn.style.color='rgba(255,120,120,.9)';
      setTimeout(function(){btn.textContent='Enviar →';btn.style.color='';btn.disabled=false;},4000);
    }

    ensureEmailJS()
      .then(function(){return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TPL_RC_NOTIFY, params);})
      .then(function(){return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TPL_RC_AUTOREPLY, params);})
      .then(onOk)
      .catch(onErr);
  });
})();
