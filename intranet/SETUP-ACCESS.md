# Activar la intranet — guía de Cloudflare Access (~10 minutos)

La intranet y las herramientas internas se protegen con **Cloudflare Access
(Zero Trust)**: cada empleado entra con su email y recibe un código de un
solo uso. Solo entran los emails de la lista. Es gratis hasta 50 usuarios y
protege las páginas en el borde de Cloudflare, antes de servirse nada.

Esto se configura UNA VEZ en el dashboard (no vive en el código). Pasos:

## 1. Abrir Zero Trust

1. Entra en https://one.dash.cloudflare.com con tu cuenta de Cloudflare.
2. Si es la primera vez, te pedirá crear un "team" — elige un nombre
   (p. ej. `obreko`) y el **plan Free**.

## 2. Crear la aplicación

1. Menú lateral: **Access → Applications → Add an application**.
2. Tipo: **Self-hosted**.
3. Application name: `obreko intranet`.
4. En **Application domain**, añade estas rutas (botón *Add domain* para
   cada una). Primero sobre `obreko.pages.dev`:

   | Subdomain/Domain      | Path                       |
   |-----------------------|----------------------------|
   | obreko.pages.dev      | intranet                   |
   | obreko.pages.dev      | propuestas-interno         |
   | obreko.pages.dev      | herramienta-presupuestos   |
   | obreko.pages.dev      | archivo                    |
   | obreko.pages.dev      | api/budget-tool            |
   | obreko.pages.dev      | api/archive                |

   Y las mismas seis sobre **obreko.com** (el dominio propio sirve el mismo
   sitio). Si el asistente limita el nº de dominios por aplicación, crea una
   segunda aplicación igual (`obreko intranet 2`) con las restantes y la
   misma política.

5. Session Duration: **1 week** (cada empleado se loguea una vez por semana
   y dispositivo).

## 3. Política de acceso

1. En el paso de **Policies**: Add a policy.
2. Policy name: `Empleados` · Action: **Allow**.
3. En **Include** → selector **Emails**, añade:
   - `manu.hdezsantos@gmail.com`
   - `rafa.rldt@gmail.com`
4. Guardar. (Para dar acceso a alguien nuevo en el futuro: editar esta
   política y añadir su email — sin tocar código ni redeployar.)

## 4. Método de login

En **Settings → Authentication → Login methods**, comprueba que
**One-time PIN** está activo (viene por defecto). No hace falta configurar
Google ni nada más: el empleado escribe su email, recibe un código de 6
dígitos y entra.

## 5. Probar

1. Abre una ventana de incógnito y ve a `https://obreko.pages.dev/intranet/`.
2. Debe aparecer la pantalla de login de Cloudflare (no la intranet).
3. Entra con `manu.hdezsantos@gmail.com` → te llega el código → pegas → ves
   la intranet.
4. Prueba con un email que NO esté en la lista → Access lo rechaza.
5. Comprueba también `https://obreko.com/intranet/` si el dominio propio
   está activo.

## Notas

- **La web pública no se toca**: obreko.com, landings y blog siguen abiertos.
- Los PIN actuales de las herramientas (equipo/archivo) siguen funcionando
  como segunda capa por si algún día se comparte un enlace por error.
- Los **deploys de preview** (`<hash>.obreko.pages.dev`) no quedan cubiertos
  por estas rutas. Si quieres protegerlos: dashboard de Pages → proyecto
  `obreko` → Settings → **Enable Access** (protege todos los previews).
- Si cambias el dominio o añades otra herramienta interna nueva bajo otra
  ruta, recuerda añadir esa ruta a la aplicación de Access.
