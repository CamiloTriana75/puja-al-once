# Preparación y operación en producción

Este documento describe el camino de publicación de V1 y sus límites actuales. El alcance y los criterios de salida aprobados están en [el plan alpha](superpowers/plans/2026-09-25-alpha.md#gate-de-salida-pública--versión-1-2026-09-27).

El servicio se despliega en **Render** con la imagen Docker del repositorio. No hay build command ni start command: el `Dockerfile` compila el cliente y el servidor y arranca `node` sobre el JS ya compilado, que es lo único que se necesita en runtime.

## Lo que ya queda preparado

- `render.yaml` declara el servicio: imagen, plan, `healthCheckPath` y `PUBLIC_ORIGINS` sin valor (se rellena en el panel, no en el repo). Crear el servicio es "New > Blueprint" apuntando a este repositorio.
- CI y el flujo de despliegue también inician la imagen Docker localmente y comprueban `/health/ready` y `/` con `scripts/smoke-container.sh`.
- CI en cada push y pull request: instalación congelada, validación del dataset, typecheck, suite de pruebas y build.
- Despliegue manual desde GitHub Actions. Repite los gates, pide confirmación explícita, usa el environment `production` y comprueba `/health/ready` al terminar.
- Las GitHub Actions están fijadas a revisiones inmutables y Dependabot revisa sus actualizaciones semanalmente.
- El servidor acepta el mismo origen y los orígenes declarados en `PUBLIC_ORIGINS` (o `PUBLIC_ORIGIN`). En producción limita por IP el directorio público, la búsqueda por código y el matchmaking.
- La guía para jugadores está en [Cómo jugar](COMO-JUGAR.md).

## Antes del primer despliegue público

- [ ] Ejecutar `CI` en la rama que se vaya a publicar y revisar que todas las comprobaciones terminen en verde.
- [ ] Crear el servicio en Render con el blueprint (**New > Blueprint**, repositorio este). Comprobar que el build de la imagen sale verde: es la primera vez que esa imagen se construye en un Linux de verdad.
- [ ] Elegir el dominio público. Render da `subasta-futbolera.onrender.com` sin coste; un dominio propio se añade en Settings > Custom Domains y Render gestiona el certificado. No está fijado en el repositorio.
- [ ] Poner `PUBLIC_ORIGINS` con el origen HTTPS exacto del juego. Como cliente y servidor se sirven desde el mismo dominio, basta el origen del sitio. En el panel: Environment > el servicio > Environment Variables.
- [ ] Crear el deploy hook (Settings > Deploys > Deploy Hook) y guardarlo como secreto `RENDER_DEPLOY_HOOK` del environment `production` de GitHub. Copiar la salida una sola vez: Render solo la muestra al crearla.
- [ ] Crear el environment `production` en GitHub con `PRODUCTION_URL` como variable y, si quieres, revisores requeridos ([configuración de environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)).
- [ ] Decidir si la variedad actual es suficiente: el validador encuentra 10 candidatos por posición y avisa que las partidas repetirán candidatos.
- [ ] Decidir el plan. `free` se duerme tras 15 minutos sin tráfico: el primer acceso posterior paga un arranque en frío de unos segundos. `starter` no se duerme nunca y cuesta unos pocos dólares al mes. Un plan de pago tampoco da más de una instancia, así que la regla de estado en memoria se sigue respetando igual.
- [ ] Completar los gates de aceptación V1 pendientes: partida E2E entre navegadores, móvil/teclado/movimiento reducido/Chrome/Safari y auditoría de datos y atribuciones.
- [ ] Elegir un canal y destinatarios para alertas. El servidor escribe errores en logs y Render comprueba salud, pero aún no hay alertas externas configuradas.
- [ ] Probar el despliegue y la recuperación en una ventana de prueba antes de anunciarlo.

## CI local

Requiere Node 26 y pnpm 9.15.9, igual que la imagen Docker.

```powershell
pnpm install --frozen-lockfile
pnpm dataset:check
pnpm typecheck
pnpm test
pnpm build
docker build --tag subasta-futbolera:local .
bash scripts/smoke-container.sh subasta-futbolera:local
```

## Primer despliegue

1. Crear el servicio desde el blueprint y esperar a que el primer build termine.
2. Abrir la URL que Render asigna y comprobar que `/health/ready` responde `{"status":"ok"}`.
3. Poner `PUBLIC_ORIGINS` con el origen exacto del servicio.
4. Guardar el deploy hook como secreto `RENDER_DEPLOY_HOOK` y `PRODUCTION_URL` como variable del environment `production`.
5. Lanzar el workflow: **Actions > Deploy production > Run workflow**, escribir `deploy` y aprobar el environment protegido.

El flujo automatizado es manual a propósito. Un push a `main` no despliega: `autoDeploy` está en `false` en el blueprint, y el workflow repite la puerta de calidad completa (incluido el build de la imagen y su smoke) antes de disparar el hook. Lo que el hook no hace es decirte si el servicio quedó sano, así que el último paso del workflow es el que espera a `/health/ready`.

## Después del despliegue

1. Abre `PRODUCTION_URL/health/ready` y confirma `{"status":"ok"}`.
2. Abre el sitio en una ventana limpia; crea una sala privada y otra pública; comprueba que solo la pública salga en el vestuario.
3. Entra con otro navegador, comienza una partida corta, revisa reveal, resultados y reconexión.
4. Revisa los logs del servicio en el panel de Render y su estado de salud.
5. Confirma que hay una sola instancia. Las partidas viven en memoria; una segunda instancia separaría a los jugadores y un reinicio termina las partidas activas. Ningún plan escala horizontalmente por su cuenta: no hay réplicas configuradas.

## Incidente y recuperación

- Mira los logs y el estado de salud antes de reiniciar; conserva la salida que explique el fallo.
- Render guarda las imágenes de los deploys recientes. Si el nuevo está roto, en el historial de deploys se puede volver a desplegar una versión anterior estable.
- Verifica otra vez salud, sitio y creación de sala después de recuperar.
- Ese procedimiento revierte el código, no la configuración: revisa aparte los cambios de variables de entorno.
- Si la instancia se reinicia, informa que las partidas que estaban activas se perdieron. V1 no tiene almacenamiento persistente de salas.

## Decisiones de infraestructura pendientes

El sistema de salas públicas y matchmaking usa estado local del proceso. No escales horizontalmente hasta migrar salas y presencia a un driver compartido y probarlo. El directorio tampoco conserva cuentas ni historial entre reinicios. El despliegue seguirá siendo manual hasta que se elija dominio, se creen secretos y se proteja el environment de producción.
