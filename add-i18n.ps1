# Añade atributos data-i18n a elementos clave del HTML
$htmlPath = Join-Path $PSScriptRoot "obreko.html"
$html = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

# Función helper para reemplazar exactamente una vez
function Rep($old, $new) {
    if ($html.Contains($old)) {
        $html = $html.Replace($old, $new)
        Write-Host "OK: $($old.Substring(0, [Math]::Min(60,$old.Length)))"
    } else {
        Write-Host "NO ENCONTRADO: $($old.Substring(0, [Math]::Min(60,$old.Length)))" -ForegroundColor Yellow
    }
}

# ── NAVBAR DESKTOP ──
Rep '<li><button class="n-link" onclick="nav(''obras'')">Obras</button></li>' '<li><button class="n-link" onclick="nav(''obras'')" data-i18n="nav-obras">Obras</button></li>'
Rep '<li><button class="n-link" onclick="nav(''reforma'')">Reformas</button></li>' '<li><button class="n-link" onclick="nav(''reforma'')" data-i18n="nav-reforma">Reformas</button></li>'
Rep '<li><button class="n-link" onclick="nav(''manitas'')">Manitas</button></li>' '<li><button class="n-link" onclick="nav(''manitas'')" data-i18n="nav-manitas">Manitas</button></li>'
Rep '<li><button class="n-link" onclick="nav(''mantenimiento'')">Mantenimiento</button></li>' '<li><button class="n-link" onclick="nav(''mantenimiento'')" data-i18n="nav-mant">Mantenimiento</button></li>'
Rep '<li><button class="n-link" onclick="nav(''hogar'')">Hogar conectado</button></li>' '<li><button class="n-link" onclick="nav(''hogar'')" data-i18n="nav-hogar">Hogar conectado</button></li>'
Rep '<button class="n-cta" onclick="nav(''presupuesto'')">Presupuesto</button>' '<button class="n-cta" onclick="nav(''presupuesto'')" data-i18n="nav-ppto">Presupuesto</button>'

# ── HERO ──
Rep '<h1 class="hero-h1">Tu espacio,<strong>transformado.</strong></h1>' '<h1 class="hero-h1" data-i18n="hero-h1" data-i18n-html="1">Tu espacio,<strong>transformado.</strong></h1>'
Rep '<p class="hero-sub">Obras, reformas, mantenimiento y hogar conectado. Un solo equipo. Plazos reales. Sin sorpresas.</p>' '<p class="hero-sub" data-i18n="hero-sub">Obras, reformas, mantenimiento y hogar conectado. Un solo equipo. Plazos reales. Sin sorpresas.</p>'
Rep '<button class="btn-yellow" onclick="nav(''presupuesto'')">Solicitar presupuesto</button>' '<button class="btn-yellow" onclick="nav(''presupuesto'')" data-i18n="btn-ppto">Solicitar presupuesto</button>'
Rep '<button class="btn-ghost" onclick="openMenu()">Ver servicios</button>' '<button class="btn-ghost" onclick="openMenu()" data-i18n="btn-servicios">Ver servicios</button>'
Rep '<div class="hero-stat-l">años en Tenerife</div>' '<div class="hero-stat-l" data-i18n="stat-years">años en Tenerife</div>'

# ── STRIP DE SERVICIOS ──
Rep '<span class="ss-name">Obras &amp; Proyectos</span>' '<span class="ss-name" data-i18n="strip-obras">Obras &amp; Proyectos</span>'
Rep '<span class="ss-name">Reforma integral</span>' '<span class="ss-name" data-i18n="strip-reforma">Reforma integral</span>'
Rep '<span class="ss-name">Manitas &amp; Urgencias</span>' '<span class="ss-name" data-i18n="strip-manitas">Manitas &amp; Urgencias</span>'
Rep '<span class="ss-name">Mantenimiento &amp; Cuidado</span>' '<span class="ss-name" data-i18n="strip-mant">Mantenimiento &amp; Cuidado</span>'
Rep '<span class="ss-name">Hogar conectado</span>' '<span class="ss-name" data-i18n="strip-hogar">Hogar conectado</span>'

# ── ESTADÍSTICAS ──
Rep '<div class="stat-l">Años de experiencia</div>' '<div class="stat-l" data-i18n="stat-exp">Años de experiencia</div>'
Rep '<div class="stat-l">Proyectos completados</div>' '<div class="stat-l" data-i18n="stat-proj">Proyectos completados</div>'
Rep '<div class="stat-l">Equipo propio</div>' '<div class="stat-l" data-i18n="stat-team">Equipo propio</div>'
Rep '<div class="stat-l">Respuesta garantizada</div>' '<div class="stat-l" data-i18n="stat-resp">Respuesta garantizada</div>'

# ── CTA BAND ──
Rep '<h2 class="cta-h">¿Listo para empezar?</h2>' '<h2 class="cta-h" data-i18n="cta-h">¿Listo para empezar?</h2>'
Rep '<p class="cta-sub">Cuéntanos tu proyecto. Presupuesto en 48h, sin compromiso.</p>' '<p class="cta-sub" data-i18n="cta-sub">Cuéntanos tu proyecto. Presupuesto en 48h, sin compromiso.</p>'
# CTA btn handled separately (arrow char)

# ── PROCESO ──
Rep '<h2 class="proceso-h h2-serif rv d1">Cómo trabajamos.</h2>' '<h2 class="proceso-h h2-serif rv d1" data-i18n="proc-h">Cómo trabajamos.</h2>'
Rep '<p class="proceso-intro rv d2">Sin sorpresas, sin intermediarios. Profesionales con más de 10 años de experiencia. Un único interlocutor coordina todo tu proyecto de principio a fin.</p>' '<p class="proceso-intro rv d2" data-i18n="proc-intro">Sin sorpresas, sin intermediarios. Profesionales con más de 10 años de experiencia. Un único interlocutor coordina todo tu proyecto de principio a fin.</p>'

# ── TESTIMONIOS ──
Rep '<h2 class="h2-serif rv d1">Lo que dicen<br>nuestros clientes.</h2>' '<h2 class="h2-serif rv d1" data-i18n="testi-h">Lo que dicen<br>nuestros clientes.</h2>'

# ── COBERTURA ──
Rep '<h2>Dos territorios.<br>El mismo compromiso.</h2>' '<h2 data-i18n="cov-h">Dos territorios.<br>El mismo compromiso.</h2>'
Rep '<div class="cov-name">Tenerife</div>' '<div class="cov-name" data-i18n="cov-tf">Tenerife</div>'
Rep '<div class="cov-name">Madrid</div>' '<div class="cov-name" data-i18n="cov-md">Madrid</div>'

# ── MEGA MENÚ ──
Rep 'onclick="nav(''obras'');closeMenu()">Obras &amp; Proyectos</button>' 'onclick="nav(''obras'');closeMenu()" data-i18n="strip-obras">Obras &amp; Proyectos</button>'
Rep 'onclick="nav(''reforma'');closeMenu()">Reforma integral</button>' 'onclick="nav(''reforma'');closeMenu()" data-i18n="strip-reforma">Reforma integral</button>'
Rep 'onclick="nav(''manitas'');closeMenu()">Manitas &amp; Urgencias</button>' 'onclick="nav(''manitas'');closeMenu()" data-i18n="strip-manitas">Manitas &amp; Urgencias</button>'
Rep 'onclick="nav(''mantenimiento'');closeMenu()">Mantenimiento &amp; Cuidado</button>' 'onclick="nav(''mantenimiento'');closeMenu()" data-i18n="strip-mant">Mantenimiento &amp; Cuidado</button>'
Rep 'onclick="nav(''hogar'');closeMenu()">Hogar conectado</button>' 'onclick="nav(''hogar'');closeMenu()" data-i18n="strip-hogar">Hogar conectado</button>'

# ── HOGAR CONECTADO — secciones clave ──
Rep '<h2 class="hc-heading rv d1">Todo tu hogar,<br>desde un solo lugar.</h2>' '<h2 class="hc-heading rv d1" data-i18n="hc-h1">Todo tu hogar,<br>desde un solo lugar.</h2>'
Rep '<h2 class="hc-heading rv d1" style="text-align:center">Tu casa que trabaja<br>mientras tú vives.</h2>' '<h2 class="hc-heading rv d1" style="text-align:center" data-i18n="hc-h2">Tu casa que trabaja<br>mientras tú vives.</h2>'
Rep '<h2 class="hc-heading rv d1">Elige tu nivel<br>de automatización.</h2>' '<h2 class="hc-heading rv d1" data-i18n="hc-h3">Elige tu nivel<br>de automatización.</h2>'
Rep '<h2 class="hc-heading rv d1">¿Por qué<br>elegirnos?</h2>' '<h2 class="hc-heading rv d1" data-i18n="hc-why-h">¿Por qué<br>elegirnos?</h2>'
Rep '<h2 class="hc-heading rv d1" style="text-align:center">Proceso<br>de trabajo.</h2>' '<h2 class="hc-heading rv d1" style="text-align:center" data-i18n="hc-proc-h">Proceso<br>de trabajo.</h2>'
Rep '<h2 class="hc-heading rv d1" style="text-align:center;color:#fff">Próximos<br>pasos.</h2>' '<h2 class="hc-heading rv d1" style="text-align:center;color:#fff" data-i18n="hc-steps-h">Próximos<br>pasos.</h2>'

# ── FOOTER CTA ──
Rep '<h2 class="svc-cta-h">Visita de diagnóstico gratuita.</h2>' '<h2 class="svc-cta-h" data-i18n="hc-cta-h">Visita de diagnóstico gratuita.</h2>'
Rep '<p class="svc-cta-p">Te mostramos lo que es posible en tu hogar. Sin compromiso.</p>' '<p class="svc-cta-p" data-i18n="hc-cta-sub">Te mostramos lo que es posible en tu hogar. Sin compromiso.</p>'

[System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.Encoding]::UTF8)
Write-Host "`ndata-i18n añadidos correctamente." -ForegroundColor Green
