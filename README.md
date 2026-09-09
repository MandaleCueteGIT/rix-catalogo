# RIX · Catálogo Online

Catálogo mayorista y sistema de toma de pedidos de RIX Distribuciones.

## Objetivo

El cliente arma una **solicitud de pedido**. No existe pago online ni checkout. RIX recibe la solicitud, valida stock y condiciones, y luego la deriva a depósito para preparación.

## Arquitectura

- **GitHub Pages**: interfaz pública del catálogo.
- **Google Sheets**: base privada de productos, clientes, pedidos y depósito.
- **Backend**: puente servidor para consultar el catálogo y registrar pedidos sin exponer la planilla ni credenciales.

## Estado actual

- Interfaz responsive mobile-first.
- Buscador y filtros por categoría.
- Carrito persistente con `localStorage`.
- Modo demo con Smartwatches RIX.
- Capa API desacoplada para conectar el backend.

## Activación

La publicación se hará desde la rama `main` usando GitHub Pages. La URL prevista es:

`https://mandalecuetegit.github.io/rix-catalogo/`

## Seguridad

El navegador nunca será fuente de verdad para precios. Al registrar un pedido, el backend debe volver a consultar SKU, estado y precio en la base privada antes de guardar el pedido.
