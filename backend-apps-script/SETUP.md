# RIX API · Instalación en Google Apps Script

Este backend conecta GitHub Pages con la hoja **RIX · Base Catálogo Online**.

## 1. Abrir Apps Script

Abrir la Google Sheet `RIX · Base Catálogo Online` y luego:

**Extensiones → Apps Script**

## 2. Pegar el backend

En el archivo `Código.gs` / `Code.gs` borrar el contenido existente y pegar completo el contenido de:

`backend-apps-script/Code.gs`

Guardar el proyecto.

## 3. Primera autorización

En Apps Script, elegir la función `doGet` y pulsar **Ejecutar** una vez.

Google pedirá autorización para que el script pueda leer/escribir la planilla. Esta autorización la hace solamente el propietario de RIX, no los clientes.

Si la ejecución manual de `doGet` muestra un error relacionado con el evento `e`, no es problema: lo importante es completar la autorización del proyecto.

## 4. Implementar como aplicación web

Ir a:

**Implementar → Nueva implementación**

Tipo:

**Aplicación web**

Configurar:

- Descripción: `RIX API v0.2`
- Ejecutar como: **Yo**
- Quién tiene acceso: **Cualquier usuario** / **Anyone**

Luego tocar **Implementar**.

Copiar la URL que termina en `/exec`.

Ejemplo:

`https://script.google.com/macros/s/XXXXXXXXXXXX/exec`

## 5. Probar salud del backend

Abrir en el navegador:

`TU_URL_EXEC?action=health`

Debe devolver algo similar a:

```json
{"ok":true,"service":"RIX API","version":"0.2.0"}
```

## 6. Conectar GitHub Pages

La URL `/exec` debe colocarse en `js/config.js` como `API_URL` y cambiar `DEMO_MODE` a `false`.

ChatGPT puede hacer este cambio directamente en GitHub una vez que el propietario le pase la URL `/exec`.

## Seguridad

- La planilla de Google Sheets permanece privada.
- Los clientes no autorizan Google ni reciben acceso a Drive.
- El frontend nunca decide el precio final: el backend vuelve a consultar `PRODUCTOS` antes de registrar cada pedido.
- El backend evita duplicados mediante `requestId` y la hoja oculta `API_REQUESTS`.
- El número de pedido se genera en servidor con bloqueo para evitar colisiones.
