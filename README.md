# Lead Magnet Zona de Bienestar

Proyecto Vite con captura de registros, diagnóstico interactivo y backend serverless para el seguimiento por correo del Sistema de Zonificación Creativa con Mascota™.

## Seguimiento por correo

La secuencia usa la base Neon aislada `zca-lead-recovery`. El formulario guarda nombre, email normalizado, la versión del consentimiento aceptado y su fecha. El primer correo queda programado para la ventana diaria del día UTC siguiente. La función diaria envía como máximo un correo por persona durante seis días y actualiza el registro de envíos. La secuencia continúa aunque la persona compre. Una baja voluntaria la detiene; si esa persona vuelve a registrarse con consentimiento explícito, comienza una generación nueva sin borrar el historial de entregas anterior. Un registro repetido mientras la secuencia sigue activa no la reinicia. Si Resend devuelve un resultado ambiguo, la secuencia se pausa para evitar duplicados y requiere revisión manual.

En el proyecto hijo, la baja está disponible en `/api/unsubscribe`; en el dominio público se expone como `/lead-magnet/api/unsubscribe`. El formulario de confirmación publica sobre la misma URL desde la que fue abierto, por lo que funciona tanto en el dominio de Vercel como a través del proxy. El enlace de un clic de los clientes de correo usa POST. Si el proveedor de correo acepta una solicitud pero la conexión se corta antes de confirmar, esa secuencia se pausa para revisión y así evitar reenvíos duplicados.

## Configuración de Vercel

Vercel conecta `zca-lead-recovery` solo con este proyecto. Las credenciales se guardan como secretos con prefijo `ZCA_LEAD_`; el código usa `ZCA_LEAD_DATABASE_URL`. No copies sus valores al repositorio ni al frontend.

1. Aplicá, en este orden, `db/migrations/001_lead_recovery.sql`, `db/migrations/002_daily_sequence_index.sql` y `db/migrations/003_sequence_generations.sql` en la rama de Production de Neon. La migración 003 debe estar aplicada antes de desplegar el código que usa generaciones.
2. Confirmá que Production y Preview tengan la URL de base correspondiente. Preview usa una rama separada; debe tener aplicada la migración antes de probar formularios allí.
3. Configurá `CRON_SECRET` como secreto aleatorio de al menos 16 caracteres.
4. Revisá el remitente verificado en Resend (`RESEND_API_KEY` y `RESEND_FROM_EMAIL`) y la URL pública de la baja (`ZCA_LEAD_SITE_URL`).

El proyecto que atiende `cuidatebien.com` debe reenviar `/lead-magnet/api/:path*` a `/api/:path*` de este proyecto. La ruta con namespace evita interceptar otras funciones `/api` que pertenezcan al sitio principal. El cron conserva su ruta interna `/api/sequence-cron` y Vercel lo ejecuta directamente en este proyecto.

El cron está programado a las 13:00 UTC (10:00 en Buenos Aires). Cada envío queda vencido a las 12:00 UTC del día calendario siguiente para que la variación de inicio del cron no desplace gradualmente la secuencia. En el plan Hobby, Vercel solo permite una ejecución por día y puede iniciarla con hasta 59 minutos de variación, por lo que la entrega real puede ocurrir entre las 13:00 y las 13:59 UTC. Cada ejecución procesa como máximo 20 correos; si el volumen diario supera ese lote, se acumula una cola y los correos excedentes quedan para ejecuciones posteriores. Los envíos con resultado ambiguo quedan pausados y requieren revisión manual.

## Desarrollo y verificación

```bash
npm install
npm test
npm run build
```

El build de Vite no ejecuta rutas serverless. Para probar las rutas en un entorno desplegado se necesita Vercel CLI y credenciales de desarrollo propias; nunca uses registros reales para pruebas.
