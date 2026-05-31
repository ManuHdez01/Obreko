// js/soundbar.js — Hogar Conectado soundbars
// ── SOUNDBAR 1 (Salón) ──────────────────────────────────────────────────────
(function(){
  var bar     = document.getElementById('hcSoundbar');
  if(!bar) return;
  var btnPlay = document.getElementById('hcSbPlay');
  var btnNext = document.getElementById('hcSbNext');
  var btnUp   = document.getElementById('hcSbUp');
  var btnDown = document.getElementById('hcSbDown');
  var fill    = document.getElementById('hcSbFill');
  var volLbl  = document.getElementById('hcSbVol');
  var trackEl = document.getElementById('hcSbTrack');

  var songs = ['/song1.mp3.m4a', '/song2.mp3.mp3'];
  var cur = 0, volume = 0.5, dragging = false;
  var audio = new Audio();
  audio.volume = volume;
  audio.loop = true;

  function load(idx, autoplay) {
    cur = ((idx % songs.length) + songs.length) % songs.length;
    audio.src = songs[cur];
    audio.load();
    if(autoplay) {
      audio.play().catch(function(err){ console.warn('Audio play:', err); });
      bar.classList.add('playing');
    }
    updateBtn();
  }

  function updateBtn() {
    if(btnPlay) btnPlay.innerHTML = audio.paused ? '&#9654;' : '&#9646;&#9646;';
  }

  function setVol(v) {
    volume = Math.max(0, Math.min(1, v));
    audio.volume = volume;
    if(volLbl) volLbl.textContent = Math.round(volume * 100) + '%';
  }

  // Progress bar
  audio.addEventListener('timeupdate', function() {
    if(!dragging && audio.duration && fill) {
      fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
    }
  });
  audio.addEventListener('ended', function() {
    bar.classList.remove('playing'); updateBtn();
  });

  btnPlay.addEventListener('click', function(e) {
    e.stopPropagation();
    if(!audio.src || audio.src === window.location.href) { load(cur, true); return; }
    if(audio.paused) {
      audio.play().catch(function(){});
      bar.classList.add('playing');
    } else {
      audio.pause();
      bar.classList.remove('playing');
    }
    updateBtn();
  });

  if(btnNext) btnNext.addEventListener('click', function(e) {
    e.stopPropagation(); load(cur + 1, true);
  });
  if(btnUp)   btnUp.addEventListener('click',   function(e) { e.stopPropagation(); setVol(volume + 0.1); });
  if(btnDown) btnDown.addEventListener('click', function(e) { e.stopPropagation(); setVol(volume - 0.1); });

  if(trackEl) trackEl.addEventListener('mousedown', function(e) {
    e.preventDefault(); e.stopPropagation(); dragging = true;
    function seek(ev) {
      var r = trackEl.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      if(audio.duration) audio.currentTime = p * audio.duration;
      if(fill) fill.style.width = (p * 100) + '%';
    }
    seek(e);
    document.addEventListener('mousemove', seek);
    document.addEventListener('mouseup', function up() {
      dragging = false;
      document.removeEventListener('mousemove', seek);
      document.removeEventListener('mouseup', up);
    });
  });

  bar.addEventListener('click', function() {
    if(!audio.src || audio.src === window.location.href) load(cur, true);
  });

  setVol(0.5);
  window._stopSb = function() {
    if(!audio.paused) { audio.pause(); bar.classList.remove('playing'); updateBtn(); }
  };
})();

// ── SOUNDBAR 2 (Dormitorio) ──────────────────────────────────────────────────
(function(){
  var bar     = document.getElementById('hcSoundbar2');
  if(!bar) return;
  var btnPlay = document.getElementById('hcSbPlay2');
  var btnNext = document.getElementById('hcSbNext2');
  var btnUp   = document.getElementById('hcSbUp2');
  var btnDown = document.getElementById('hcSbDown2');
  var fill    = document.getElementById('hcSbFill2');
  var volLbl  = document.getElementById('hcSbVol2');
  var trackEl = document.getElementById('hcSbTrack2');

  var songs = ['/song2.mp3.mp3', '/song1.mp3.m4a'];
  var cur = 0, volume = 0.5, dragging = false;
  var audio = new Audio();
  audio.volume = volume;
  audio.loop = true;

  function load(idx, autoplay) {
    cur = ((idx % songs.length) + songs.length) % songs.length;
    audio.src = songs[cur];
    audio.load();
    if(autoplay) {
      audio.play().catch(function(err){ console.warn('Audio play:', err); });
      bar.classList.add('playing');
    }
    updateBtn();
  }

  function updateBtn() {
    if(btnPlay) btnPlay.innerHTML = audio.paused ? '&#9654;' : '&#9646;&#9646;';
  }

  function setVol(v) {
    volume = Math.max(0, Math.min(1, v));
    audio.volume = volume;
    if(volLbl) volLbl.textContent = Math.round(volume * 100) + '%';
  }

  audio.addEventListener('timeupdate', function() {
    if(!dragging && audio.duration && fill) {
      fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
    }
  });
  audio.addEventListener('ended', function() {
    bar.classList.remove('playing'); updateBtn();
  });

  btnPlay.addEventListener('click', function(e) {
    e.stopPropagation();
    if(!audio.src || audio.src === window.location.href) { load(cur, true); return; }
    if(audio.paused) {
      audio.play().catch(function(){});
      bar.classList.add('playing');
    } else {
      audio.pause();
      bar.classList.remove('playing');
    }
    updateBtn();
  });

  if(btnNext) btnNext.addEventListener('click', function(e) {
    e.stopPropagation(); load(cur + 1, true);
  });
  if(btnUp)   btnUp.addEventListener('click',   function(e) { e.stopPropagation(); setVol(volume + 0.1); });
  if(btnDown) btnDown.addEventListener('click', function(e) { e.stopPropagation(); setVol(volume - 0.1); });

  if(trackEl) trackEl.addEventListener('mousedown', function(e) {
    e.preventDefault(); e.stopPropagation(); dragging = true;
    function seek(ev) {
      var r = trackEl.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      if(audio.duration) audio.currentTime = p * audio.duration;
      if(fill) fill.style.width = (p * 100) + '%';
    }
    seek(e);
    document.addEventListener('mousemove', seek);
    document.addEventListener('mouseup', function up() {
      dragging = false;
      document.removeEventListener('mousemove', seek);
      document.removeEventListener('mouseup', up);
    });
  });

  bar.addEventListener('click', function() {
    if(!audio.src || audio.src === window.location.href) load(cur, true);
  });

  setVol(0.5);
  window._stopSb2 = function() {
    if(!audio.paused) { audio.pause(); bar.classList.remove('playing'); updateBtn(); }
  };
})();
