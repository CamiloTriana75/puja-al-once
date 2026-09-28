# Preparación y operación en producción

Este documento describe el camino de publicación de V1 y sus límites actuales. El alcance y los criterios de salida aprobados están en [el plan alpha](superpowers/plans/2026-09-25-alpha.md#gate-de-salida-pública--versión-1-2026-09-27).

## Lo que ya queda preparado

- CI y el flujo de despliegue también inician la imagen Docker localmente y comprueban `/health/ready` y `/` con `scripts/smoke-container.sh`.
- CI en cada push y pull request: instalación congelada, validación del dataset, typecheck, suite de pruebas y build.
- Despliegue manual desde GitHub Actions. Repite los gates, pide confirmación explícita, usa el environment `production` y comprueba `/health/ready` al terminar.
- Las GitHub Actions están fijadas a revisiones inmutables y Dependabot revisa sus actualizaciones semanalmente.
- Fly comprueba `/health/ready`; el servidor también expone `/health/live`.
- El servidor acepta el mismo origen y los orígenes declarados en `PUBLIC_ORIGINS` (o `PUBLIC_ORIGIN`). En producción limita por IP el directorio público, la búsqueda por código y el matchmaking.
- La guía para jugadores está en [Cómo jugar](COMO-JUGAR.md).

## Antes del primer despliegue público

- [ ] Ejecutar `CI` en la rama que se vaya a publicar y revisar que todas las comprobaciones terminen en verde.
- [ ] Confirmar propiedad y configuración de `subasta-futbolera` en Fly.io; la configuración local apunta a ese nombre.
- [ ] Elegir el dominio público y apuntar DNS/certificado a Fly. No está fijado en el repositorio.
- [ ] Crear el environment `production` en GitHub. Configurar revisores requeridos y restricciones de rama cuando el plan de GitHub lo permita ([configuración de environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)).
- [ ] Guardar `FLY_API_TOKEN` como secreto de ese environment y `PRODUCTION_URL` como variable, por ejemplo `https://juego.tudominio.com`.
- [ ] Al crear el token, limitarlo a la app y usar una expiración definida; copia su salida una sola vez al secreto de GitHub y no la guardes en el repositorio.
- [ ] Configurar `PUBLIC_ORIGINS` en Fly con el origen HTTPS exacto del juego. Si se sirve cliente y servidor desde el mismo dominio, basta el origen del sitio.
- [ ] Decidir si la variedad actual es suficiente: el validador encuentra 10 candidatos por posición y avisa que las partidas repetirán candidatos.
- [ ] Decidir si se acepta el arranque en frío. `min_machines_running = 0` ahorra al quedar inactivo, pero el primer acceso puede esperar a que despierte la máquina.
- [ ] Mantener exactamente una Machine. Las partidas viven en memoria; dos instancias pueden separar jugadores y un reinicio termina las partidas activas. Esta configuración de Fly no impone un máximo por sí sola.
- [ ] Completar los gates de aceptación V1 pendientes: partida E2E entre navegadores, móvil/teclado/movimiento reducido/Chrome/Safari y auditoría de datos y atribuciones.
- [ ] Elegir un canal y destinatarios para alertas. El servidor escribe errores en logs y Fly comprueba salud, pero aún no hay alertas externas configuradas.
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

## Primer despliegue manual con Fly

Después de completar las decisiones de dominio, cuenta y billing:

```powershell
fly auth login
fly tokens create deploy -a subasta-futbolera -x 8760h
fly status -a subasta-futbolera
fly scale count 1 -a subasta-futbolera
fly secrets set PUBLIC_ORIGINS=https://juego.tudominio.com -a subasta-futbolera
fly deploy -a subasta-futbolera
fly checks list -a subasta-futbolera
fly status -a subasta-futbolera
```

Configura además el certificado y DNS según el dominio elegido. Copia la salida del token al secreto `FLY_API_TOKEN` del environment `production`; configura ahí `PRODUCTION_URL` como variable. Fly documenta [tokens de despliegue](https://fly.io/docs/flyctl/tokens-create/) y el [inicio/parada automática de Machines](https://fly.io/docs/reference/fly-proxy-autostop-autostart/). El despliegue automatizado de GitHub es manual: selecciona **Deploy production**, escribe `deploy` y aprueba el environment protegido. Antes, verifica que ambos valores estén presentes.

## Después del despliegue

1. Abre `PRODUCTION_URL/health/ready` y confirma `{"status":"ok"}`.
2. Abre el sitio en una ventana limpia; crea una sala privada y otra pública; comprueba que solo la pública salga en el vestuario.
3. Entra con otro navegador, comienza una partida corta, revisa reveal, resultados y reconexión.
4. Consulta `fly checks list`, `fly status` y `fly logs -a subasta-futbolera`.
5. Confirma que solo existe una Machine (`fly machines list -a subasta-futbolera`).

## Incidente y recuperación

- Mira `fly logs` y el estado de salud antes de reiniciar; conserva la salida que explique el fallo.
- Si el despliegue nuevo está roto, localiza la imagen de una release estable con `fly releases --image -a subasta-futbolera` y vuelve a desplegarla con `fly deploy --image <imagen-estable> -a subasta-futbolera` ([comando releases](https://fly.io/docs/flyctl/releases/)).
- Verifica otra vez salud, sitio y creación de sala después de recuperar.
- Ese procedimiento vuelve a desplegar la imagen anterior; no revierte cambios de configuración, secretos ni datos externos. Revisa esos cambios aparte.
- Si la Machine reinició, informa que las partidas que estaban activas se perdieron. V1 no tiene almacenamiento persistente de salas.

## Decisiones de infraestructura pendientes

El sistema de salas públicas y matchmaking usa estado local del proceso. No escales horizontalmente hasta migrar salas y presencia a un driver compartido y probarlo. El directorio tampoco conserva cuentas ni historial entre reinicios. El despliegue seguirá siendo manual hasta que se elija dominio, se creen secretos y se proteja el environment de producción.
