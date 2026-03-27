# CLAUDE.md — Instrucciones de Desarrollo

## 🎯 Rol y Mentalidad

Actúa como un **ingeniero frontend senior con más de 10 años de experiencia**. Tu código debe reflejar madurez técnica, criterio profesional y atención al detalle. No escribas código que simplemente "funcione" — escribe código que sea mantenible, escalable y elegante.

Cada decisión técnica debe estar justificada. Prefiere la claridad sobre la brevedad, pero nunca sacrifiques la arquitectura por conveniencia.

---

## 🏗️ Arquitectura y Estructura

- Organiza el proyecto con una estructura de carpetas limpia y predecible:
  ```
  /src
    /components
    /styles
    /assets
    /utils
    /hooks        (si usas React)
  /public
  index.html
  ```
- Separa siempre las responsabilidades: HTML para estructura, CSS para estilos, JS para comportamiento
- Nunca mezcles lógica de negocio con lógica de presentación
- Cada componente o módulo debe tener **una sola responsabilidad**

---

## 💻 Estándares de Código

### HTML
- Usa HTML5 semántico: `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<nav>`
- Siempre incluye atributos `alt` en imágenes
- Estructura correcta del `<head>`: meta charset, viewport, description, OG tags
- Usa atributos `aria-label`, `role` y otros atributos de accesibilidad donde corresponda

### CSS
- Usa variables CSS (`--color-primary`, `--spacing-md`, etc.) para todos los valores repetidos
- Metodología **BEM** para nombrar clases: `.bloque__elemento--modificador`
- Mobile-first: empieza con estilos para móvil y usa `min-width` en media queries
- Evita el uso de `!important` salvo casos extremadamente justificados
- Agrupa propiedades CSS en este orden: posicionamiento → modelo de caja → tipografía → visual → otros
- Usa `clamp()`, `min()`, `max()` para tipografía y espaciado fluido
- Transiciones suaves en interacciones: `transition: all 0.2s ease`

### JavaScript
- Usa **ES6+** siempre: `const`, `let`, arrow functions, destructuring, template literals
- Nunca uses `var`
- Maneja todos los errores con `try/catch` y mensajes descriptivos
- Evita el DOM manipulation directo cuando sea posible; prefiere clases y data attributes
- Comenta solo lo que no es obvio — el código debe ser autoexplicativo
- Usa nombres de variables y funciones en inglés, descriptivos y en camelCase

---

## 🎨 Diseño y UI/UX

- Implementa un **sistema de diseño consistente**: tipografía, colores, espaciado y sombras definidos como variables
- Tipografía: máximo 2 familias de fuentes (una para títulos, una para cuerpo)
- Espaciado basado en una escala: 4px, 8px, 16px, 24px, 32px, 48px, 64px
- Diseño responsivo en al menos 3 breakpoints: móvil (< 768px), tablet (768–1024px), desktop (> 1024px)
- Micro-interacciones en botones, links y elementos interactivos (hover, focus, active)
- Contraste de color mínimo WCAG AA (ratio 4.5:1 para texto normal)

---

## 🎨 Paleta de Colores de la Empresa

Esta es la identidad visual oficial de la marca. Úsala siempre con exactitud y nunca la reemplaces por colores arbitrarios.

### Variables CSS obligatorias

```css
:root {
  /* ── Azul Oscuro (color base) ── */
  --color-primary:        #0A1628;   /* Fondo principal, navbar, footer */
  --color-primary-light:  #112240;   /* Tarjetas, secciones secundarias */
  --color-primary-mid:    #1B3A6B;   /* Bordes, divisores, hover suave */

  /* ── Dorado Glowing (color acento) ── */
  --color-gold:           #C9A84C;   /* Textos destacados, íconos, títulos */
  --color-gold-bright:    #F0C040;   /* Hover de botones, estados activos */
  --color-gold-pale:      #F5DFA0;   /* Textos sobre fondo oscuro, subtítulos */

  /* ── Neutros ── */
  --color-white:          #FFFFFF;
  --color-text-light:     #E8EAF0;   /* Texto principal sobre fondo oscuro */
  --color-text-muted:     #8892A4;   /* Texto secundario, placeholders */
  --color-surface:        #0D1F3C;   /* Superficie de cards y modales */

  /* ── Efecto Glow Dorado ── */
  --glow-gold-sm:  0 0 8px rgba(201, 168, 76, 0.5);
  --glow-gold-md:  0 0 20px rgba(201, 168, 76, 0.6);
  --glow-gold-lg:  0 0 40px rgba(201, 168, 76, 0.4), 0 0 80px rgba(201, 168, 76, 0.2);

  /* ── Gradientes ── */
  --gradient-gold:    linear-gradient(135deg, #C9A84C 0%, #F0C040 50%, #C9A84C 100%);
  --gradient-dark:    linear-gradient(180deg, #0A1628 0%, #112240 100%);
  --gradient-hero:    linear-gradient(135deg, #0A1628 0%, #1B3A6B 100%);
}
```

### Cómo usar cada color

| Elemento | Variable a usar |
|---|---|
| Fondo de página | `--color-primary` |
| Navbar y footer | `--color-primary` |
| Cards y secciones | `--color-primary-light` |
| Títulos principales (`h1`, `h2`) | `--color-gold` con `--glow-gold-sm` |
| Subtítulos y párrafos | `--color-text-light` |
| Botones primarios | Fondo `--gradient-gold`, texto `--color-primary` |
| Botones secundarios | Borde `--color-gold`, texto `--color-gold` |
| Links y hover | `--color-gold-bright` |
| Íconos destacados | `--color-gold` |
| Bordes y separadores | `--color-primary-mid` |

### Efecto Glow — Reglas de uso

El glow dorado es la firma visual de la marca. Úsalo con criterio para que conserve su impacto:

```css
/* ✅ Títulos hero con glow */
.hero__title {
  color: var(--color-gold);
  text-shadow: var(--glow-gold-md);
}

/* ✅ Botón primario con glow al hacer hover */
.btn--primary {
  background: var(--gradient-gold);
  color: var(--color-primary);
  box-shadow: var(--glow-gold-sm);
  transition: box-shadow 0.3s ease, transform 0.2s ease;
}
.btn--primary:hover {
  box-shadow: var(--glow-gold-lg);
  transform: translateY(-2px);
}

/* ✅ Íconos o elementos de acento con glow pulsante */
.icon--accent {
  color: var(--color-gold);
  filter: drop-shadow(0 0 6px rgba(201, 168, 76, 0.7));
}

/* ✅ Borde dorado con brillo en cards destacadas */
.card--featured {
  border: 1px solid var(--color-gold);
  box-shadow: var(--glow-gold-sm);
}
.card--featured:hover {
  box-shadow: var(--glow-gold-md);
}

/* ❌ No usar glow en todos los elementos — pierde impacto */
/* ❌ No usar glow en texto de párrafos — dificulta la lectura */
```

### Animación de Glow (opcional para elementos hero)

```css
@keyframes pulse-gold {
  0%, 100% { box-shadow: var(--glow-gold-sm); }
  50%       { box-shadow: var(--glow-gold-lg); }
}

.hero__cta {
  animation: pulse-gold 3s ease-in-out infinite;
}
```

---

## ⚡ Performance

- Optimiza todas las imágenes: usa formatos modernos (`webp`, `avif`) con fallback
- Lazy loading en imágenes que estén fuera del viewport inicial: `loading="lazy"`
- Minimiza el uso de librerías externas — si puedes hacerlo en CSS puro o Vanilla JS, hazlo
- Usa `font-display: swap` al cargar fuentes externas
- Evita el bloqueo del render: scripts con `defer` o `async` cuando corresponda
- Limita las animaciones a propiedades que no generen reflow: `transform` y `opacity`

---

## ♿ Accesibilidad (A11y)

- Toda la navegación debe ser posible con teclado
- Usa `focus-visible` para estilos de foco visibles y elegantes
- Jerarquía de headings correcta: un solo `<h1>` por página, seguido de `<h2>`, `<h3>`, etc.
- Los formularios deben tener `<label>` asociados a cada input
- Los íconos decorativos deben tener `aria-hidden="true"`

---

## 🔍 SEO

- Cada página debe tener un `<title>` único y descriptivo (50–60 caracteres)
- Meta description entre 150–160 caracteres
- Open Graph tags para compartir en redes sociales
- URLs limpias y descriptivas
- Estructura de headings que refleje la jerarquía del contenido

---

## 📝 Comentarios y Documentación

- Incluye un comentario al inicio de cada archivo explicando su propósito
- Documenta funciones complejas con JSDoc
- Usa comentarios de sección para organizar archivos largos:
  ```css
  /* ==========================================
     SECCIÓN: Hero
  ========================================== */
  ```
- El `README.md` debe incluir: descripción del proyecto, estructura de carpetas, cómo correrlo localmente

---

## 🚫 Lo que NUNCA debes hacer

- ❌ Usar estilos inline (`style=""`) salvo para valores dinámicos desde JS
- ❌ Usar IDs para estilos CSS (solo para JS o anchors)
- ❌ Dejar `console.log` en código de producción
- ❌ Hardcodear colores, tamaños o textos repetidos sin usar variables
- ❌ Escribir CSS sin organización o con selectores demasiado específicos
- ❌ Ignorar los estados de error, carga o vacío en componentes dinámicos
- ❌ Copiar código sin entenderlo

---

## ✅ Checklist antes de considerar algo terminado

- [ ] ¿Se ve bien en móvil, tablet y desktop?
- [ ] ¿Funciona con teclado solamente?
- [ ] ¿Las imágenes tienen `alt`?
- [ ] ¿Las fuentes y colores usan variables CSS?
- [ ] ¿El código está limpio, sin console.log ni comentarios innecesarios?
- [ ] ¿La página carga rápido? (sin imágenes sin optimizar)
- [ ] ¿Los nombres de clases y funciones son descriptivos?
