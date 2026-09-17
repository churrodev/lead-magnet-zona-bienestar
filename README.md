# Lead Magnet Zona de Bienestar

Base técnica del Lead Magnet **¿Cuál es tu Zona de Bienestar?™**. Esta fase contiene solamente el entorno Vite y una función serverless inicial; todavía no incluye páginas, componentes ni integración con Resend.

## Desarrollo local

```bash
npm install
npm run dev
```

La función `POST /api/lead` recibe un cuerpo JSON con esta estructura:

```json
{
  "name": "Nombre",
  "email": "persona@ejemplo.com"
}
```

Por ahora valida los campos y responde `{ "success": true }`. El envío de correo se conectará en una fase posterior.

## Variables de entorno en Vercel

1. Importa este directorio como un proyecto nuevo en Vercel.
2. Abre **Settings > Environment Variables**.
3. Crea `RESEND_API_KEY` con una API key activa de Resend.
4. Crea `RESEND_FROM_EMAIL` con el remitente verificado en Resend.
5. Activa ambas variables para Production, Preview y Development según corresponda.
6. Ejecuta un nuevo deployment después de guardar las variables.

No escribas la API key en `.env.example`, en el código del frontend ni en el repositorio. Para desarrollo local, copia `.env.example` como `.env.local` y completa los valores únicamente en ese archivo ignorado por Git.

