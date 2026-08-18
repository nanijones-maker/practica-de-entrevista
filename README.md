# Armá tu CV

Constructor de CV guiado, en español rioplatense, pensado para personas que arman su primer currículum. Seis pasos, reglas concretas mientras escribís, vista previa en hoja A4 real y descarga en PDF.

Sitio estático: un solo archivo HTML, sin build, sin dependencias, sin backend. Los datos nunca salen del navegador.

---

## Deploy en Vercel

### Opción 1 — desde la web (más rápido)

1. Subí esta carpeta a un repo de GitHub.
2. Entrá a [vercel.com/new](https://vercel.com/new) e importá el repo.
3. En **Framework Preset** elegí **Other**. Dejá Build Command y Output Directory vacíos.
4. Deploy.

### Opción 2 — desde la terminal

```bash
npm i -g vercel
cd cv-builder
vercel          # preview
vercel --prod   # producción
```

No hay `package.json` a propósito: Vercel detecta el sitio como estático y sirve `index.html` directamente.

### Probarlo local

```bash
npx serve .
```

Abrilo en `http://localhost:3000`. Abrir el archivo con `file://` también funciona, pero las fuentes de Google pueden tardar más.

---

## Qué hace

**Seis pasos.** Contacto, perfil, experiencia, educación, habilidades y revisión final.

**Experiencia en un solo campo.** "Qué hiciste" es un textarea multilínea: un renglón por frase, Enter para separar. La app analiza cada renglón por separado y muestra avisos solo para los que necesitan algo — si el renglón 2 arranca con "Fui responsable de", aparece ese renglón numerado con seis verbos tocables que lo reescriben sin tocar los demás.

**Foto opcional.** Se recorta cuadrada y se achica a 400 px antes de guardar. La leyenda aclara qué se espera: sola, de los hombros para arriba, fondo liso; nada de selfies, fotos con familia o amigos, cuerpo entero, lentes de sol o recortes de otra imagen. Como el CV argentino funciona igual sin foto, el campo aclara que muchas empresas prefieren que no la tenga.

**Fechas con mes y año.** Selectores desplegables en experiencia, educación y cursos — nada de texto libre, así el formato sale parejo en todo el CV. Se muestran como "Mar 2024 – Dic 2024"; si dejás el mes vacío queda solo el año. El check "Sigo acá" convierte el fin en "Actualidad" y bloquea el campo. La app avisa si la fecha de fin es anterior a la de inicio, si falta el año o si el año todavía no llegó.

**Ayuda con IA.** Botón "Mejorar con IA" en el perfil y en cada frase de experiencia. Devuelve tres versiones alternativas, cada una con una línea explicando qué cambió, y elegís cuál usar. El prompt tiene prohibido inventar cifras o logros que no estén en el texto original: reescribe lo que pusiste, no completa lo que falta.

**Reglas mientras escribís.** No son un tutorial: corrigen en el momento.

| Regla | Qué hace |
|---|---|
| Verbo de acción | Detecta arranques flojos ("fui responsable de", "mis tareas eran") y ofrece verbos que reescriben la frase entera |
| Números | Marca las frases sin ninguna cifra y sugiere qué contar |
| Fechas | Valida que el fin no sea anterior al inicio y que no falte el año |
| Datos de más | Detecta DNI, CUIL, edad, estado civil, foto y avisa por qué sacarlos |
| Mail informal | Marca direcciones poco profesionales |
| Frases hechas | Señala "proactivo", "trabajo en equipo" y similares |
| Una página | Mide la hoja renderizada y marca dónde termina la página 1 |

**Asistente de frase.** Tres preguntas — qué hiciste, sobre qué, cuánto — y arma la frase sola.

**Tres plantillas.** Clásico (serif, encabezado centrado), Moderno (sans con filete de color) y Encabezado (bloque de color arriba). Cuatro colores de acento y dos densidades. Todas en una sola columna, sin tablas ni íconos, para que los sistemas de filtrado automático (ATS) puedan leer el texto.

**Revisión final.** Catorce chequeos con estado verde, ámbar o rojo, cada uno con un botón que lleva al paso donde corregirlo.

---

## La ayuda con IA en producción

Este es el único punto que necesita atención al deployar.

Dentro de Claude, la llamada a la API funciona sola. **Una vez deployado en Vercel, hace falta una clave de Anthropic.** La primera vez que alguien toca "Mejorar con IA", la app le pide la clave y la guarda en `localStorage` de su navegador — no viaja a ningún servidor tuyo.

Eso sirve para uso propio, pero **no para un público general**: no vas a pedirle a cada chico de un taller que se saque una API key. Si querés que funcione para todos, la opción es agregar una función serverless que guarde tu clave del lado del servidor:

1. Creá `api/mejorar.js` en el proyecto con un handler que reciba el prompt, llame a la API de Anthropic con `process.env.ANTHROPIC_API_KEY` y devuelva la respuesta.
2. Cargá `ANTHROPIC_API_KEY` en Vercel → Settings → Environment Variables.
3. En `index.html`, cambiá la URL de `llamarIA` de `https://api.anthropic.com/v1/messages` a `/api/mejorar` y sacá los headers de autenticación.

Poné un límite de uso por IP: si la clave es tuya, el consumo también.

**El resto de la app no depende de esto.** Las reglas, la validación de fechas, el asistente de frase, las plantillas y la descarga en PDF funcionan sin clave y sin conexión.

---

## Notas técnicas

- **Sin frameworks.** HTML, CSS y JS vanilla en un archivo.
- **Guardado.** Usa `window.storage` si existe (entorno Claude) y `localStorage` si no. Todo local, nada se envía a ningún servidor.
- **PDF y saltos de página.** Vía `window.print()` con `@page { size: A4; margin: 15mm 16mm }`. Los márgenes viven en `@page`, no en el padding de la hoja, así la página 2 arranca con el mismo margen que la 1. Las secciones **pueden** cortarse entre páginas (`break-inside: auto`) — forzar lo contrario es lo que dejaba un hueco enorme entre Perfil y Experiencia — pero los títulos nunca quedan solos al pie (`break-after: avoid` en los `h2`, `break-before: avoid` en el primer ítem) y ningún ítem se parte al medio.
- **Medición de la página.** La hoja se renderiza a tamaño A4 real (794 × 1123 px a 96 dpi) y se mide con `scrollHeight`. El área útil en pantalla (674 × 1011 px) coincide con la de impresión (673 × 1009 px), así que el "% usado" predice el PDF real. Por eso el modo compacto reduce interlineado y espacios pero **no** el padding: si lo cambiara, la vista previa dejaría de coincidir con la salida.
- **Foto.** Se procesa con canvas: recorte cuadrado centrado, 400 px de lado, JPEG al 82 % (~30 KB). Se guarda como data URL junto al resto del CV.
- **Fuentes.** Fraunces, Archivo, Source Serif 4 y Source Sans 3 desde Google Fonts, con fallbacks del sistema. Si Google Fonts está bloqueado, el sitio sigue funcionando.
- **Accesibilidad.** Labels asociadas, foco visible, `prefers-reduced-motion` respetado, tipografía de 16 px en inputs para evitar el zoom automático en iOS.

## Personalizar

Casi todo se ajusta desde las constantes al principio del `<script>`:

- `VERBOS` — verbos sugeridos por tipo de experiencia
- `ARRANQUES_DEBILES` — frases que se marcan como arranque flojo
- `SENSIBLES` — datos personales que no deberían ir en el CV
- `HAB_SUGERIDAS` — chips de habilidades sugeridas
- `ACENTOS` — colores de acento disponibles
- `PASOS` — títulos y textos de cada paso
- `MESES` y `ANIOS` — opciones de los selectores de fecha
- `REGLAS_IA` — las reglas que la IA tiene que respetar al reescribir

En impresión, el bloque `@media print` es el que gobierna la paginación. Si cambiás los márgenes de `@page`, actualizá también el negativo de `.sheet.t-encabezado .doc-head` (que sangra el bloque de color hasta el borde) y el `disponible` de `medir()`.

Los colores de la interfaz están en `:root`; los de la hoja, en las reglas `.sheet.t-*`.
