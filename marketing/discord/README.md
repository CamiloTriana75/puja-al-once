# Servidor de Discord de Puja el Once

Un script (discord.js) que monta y mantiene el servidor entero: roles, canales, permisos, foros,
mensajes fijos, reglas, AutoMod, "Canales y roles", pantalla de bienvenida, emojis, icono, webhook
del formulario de comentarios y enlace de invitación. **Es repetible**: lo que ya existe se actualiza,
no se duplica. No forma parte del workspace pnpm (tiene su propio `npm install`).

Todo lo que se crea está en `config/` (estructura en `server.mjs`, textos en `content.mjs`). Para
cambiar un texto o un canal, edítalo ahí y vuelve a ejecutar.

## Lo que hay que hacer a mano (10 minutos)

1. **Crea el servidor**: en Discord, `+` → *Crear el mío* → *Para un club o comunidad*. El nombre
   da igual, el script lo cambia. Activa el **modo desarrollador** (Ajustes de usuario → Avanzado) y
   copia el **ID del servidor** (clic derecho en el icono → *Copiar ID*).
2. **Crea el bot de configuración**: <https://discord.com/developers/applications> → *New Application* →
   pestaña **Bot** → *Reset Token* → copia el token. **No actives ningún "Privileged Intent".**
3. **Invítalo con permiso de administrador**: abre
   `https://discord.com/oauth2/authorize?client_id=ID_DE_LA_APLICACION&scope=bot&permissions=8`
   (el ID está en *General Information*) y elige tu servidor.
4. **Sube su rol**: Ajustes del servidor → Roles → arrastra el rol del bot **al primer puesto**.
   Sin esto Discord no deja al bot ordenar ni asignar roles.

## Ejecutarlo

```bash
cd marketing/discord
npm install
cp .env.example .env      # rellena DISCORD_TOKEN y GUILD_ID (el .env está en .gitignore)
npm run assets            # opcional: regenera icono, banners y emojis (ya vienen hechos)
npm run plan              # valida la config y muestra lo que va a crear; NO toca Discord
npm run setup             # aplica todo (pide confirmación escribiendo SI)
```

Opciones: `npm run setup -- --only=content` (solo una parte: `roles, channels, settings, content,
emojis, automod, onboarding, webhook, invite`), `--limpiar` (borra los canales que trae la plantilla de Discord:
"bienvenida-y-reglas", "recursos", "moderator-only", "Canales de texto"…; los nuestros llevan emoji y nunca se tocan) y `--yes` (sin confirmación). Si algo falla, el script lo dice y sigue con lo
demás; corrige y vuelve a ejecutar.

## Después

- **Webhook de comentarios**: la URL queda en `out/webhook-url.txt` (es secreta). Pégala en Render como
  `FEEDBACK_WEBHOOK_URL` y los comentarios del juego llegarán a `#comentarios-del-juego`.
- **Invitación**: queda en `out/invite-url.txt`. Es el enlace para la bio, el trailer y Reddit.
- **Seguridad**: el bot de configuración ya no hace falta. Expúlsalo del servidor o, como mínimo,
  quítale el rol de administrador y resetea el token. Vuelve a invitarlo solo cuando quieras cambiar algo.
- **Activa la verificación en dos pasos** en tu cuenta de Discord y exígela a los moderadores
  (Ajustes → Moderación de seguridad).
- **Banner y fondo de invitación**: Discord los pide con boosts (nivel 2 y nivel 1). Ya están listos en
  `assets/banner.png` y `assets/splash.png` para subirlos cuando toque.
- **Descubrimiento de servidores** (que aparezca en el buscador de Discord): exige una antigüedad y una
  actividad mínimas; se activa en Ajustes → Descubrimiento cuando lo permita.
- El rol **Fundador** se asigna solo al dueño del servidor. **Moderador**, **Tester**, **Creador** y
  **La hinchada** los das tú a mano; los de "Canales y roles" (avisos, región…) los elige cada persona.

## Qué se crea

Ver la lista completa con `npm run plan`. En resumen: 6 categorías (Bienvenida, A jugar, Comunidad, El
proyecto, Voz y Staff privada), 27 canales —con foros de **sugerencias** y **bugs** con etiquetas—,
4 salas de voz de 4 plazas (como el juego), 11 roles, 5 reglas de AutoMod, 7 emojis, 7 mensajes fijos
con cabeceras de marca y "Canales y roles" para elegir avisos y región.

## Pruebas

`npm test` valida la configuración contra los límites de Discord y ejecuta el script entero contra un
servidor **simulado**, incluida la segunda ejecución (que no debe duplicar nada). No habla con Discord:
no sustituye a una ejecución real.
