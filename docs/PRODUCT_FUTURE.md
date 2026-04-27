# PRODUCT_FUTURE.md — CWE como producto público (horizonte 3)

> **Importante**: este documento describe el horizonte 3 — CWE convertido en producto público para creadores externos. **NO es lo que estamos construyendo en MVP.** Sirve como norte conceptual de largo plazo.
>
> Ver `MVP_SCOPE.md` para qué es lo que sí estamos construyendo ahora.

---

## Cuándo se vuelve relevante este documento

Solo después de que:

1. MVP está completo (Pablo desarrolla AGENTS.INC con CWE).
2. AGENTS.INC está publicado y tiene tracción medible.
3. La arquitectura de CWE demostró ser sólida y reusable.

Si esos tres no se cumplieron, este documento es ficción interesante. Si se cumplieron, este documento es la guía para el siguiente movimiento.

---

## La promesa pública (cuando llegue)

> **"Crea un mundo, dale personalidad a sus habitantes y genera escenas dentro de él hablando con la IA."**

Esa frase es la promesa al usuario externo. Si CWE entrega esa promesa, el producto funciona. Si no, ningún feature avanzado lo salva.

---

## El problema que resuelve

Hoy, alguien con una idea creativa para una experiencia interactiva tiene tres caminos:

1. **Aprender a programar** (Unity, Godot, Unreal). Curva de meses a años. La mayoría abandona.
2. **Usar herramientas no-code** (Roblox Studio, Construct). Limitadas o todavía requieren mucho aprendizaje técnico.
3. **No hacer nada**. La idea se queda en la cabeza.

CWE crea un cuarto camino: **conversación con IA → mundo narrativo jugable**. La idea sale de la cabeza al motor sin pasar por código ni por una UI compleja.

---

## Value proposition

### Para vibe coders y creativos tech

> "Convierte tu idea en una experiencia interactiva describiéndola en español. Sin programar, sin instalar nada. Lo armas conversando."

### Para narrative designers y educadores

> "Prototipa mundos narrativos con personajes vivos en minutos, no semanas. Exporta cinematics para presentar tu idea."

### Para niños interesados en videojuegos

> "Cuéntale a la computadora qué mundo quieres crear y lo hace. Después puedes hablarle a los personajes."

---

## Audiencias

### Primary: vibe coders y creativos tech

- Edad 18-35.
- Conocimiento medio-alto de tecnología.
- Activos en Twitter, Discord, TikTok.
- Han probado Cursor, ChatGPT, Midjourney, v0.dev.
- Tienen ideas que no ejecutan por falta de skill técnico.
- Comparten lo que crean (motor de viralidad).

Es el target inicial cuando CWE se lance como producto.

### Secondary: niños 8-15

Enorme potencial pero implica:
- COPPA (US) y GDPR (EU) compliance.
- Controles parentales.
- Moderación robusta.
- Cuentas supervisadas.

No es batalla para el primer release. Se aborda cuando el primary está validado.

### Tertiary: indie devs, narrative designers, educadores

- Profesionales de creación digital.
- Buscan herramientas de prototipado rápido.
- Aprecian poder exportar trabajos.

Nicho profesional con expectativas más altas. Viene cuando hay producto sólido.

---

## Niveles de control progresivos

CWE escala con la habilidad y ambición del usuario.

### Nivel 0 — Onboarding mágico (vibe coder puro)

Canvas vacío con input:

> "Describe el mundo que quieres crear."

En 60 segundos hay un mundo poblado, agentes con personalidades, listo para explorar.

A partir de ahí, todo es conversación. **Default del producto.**

### Nivel 1 — Editor visual (toquetón)

Para usuarios que quieren más control: editor visual con paneles de edición. Pero la IA sigue presente con botón "regenerar" en cada elemento.

### Nivel 2 — DSL de cutscenes (creador serio)

Usuario que quiere control total escribe DSL a mano:

```markdown
# Encuentro en la cocina

## Plano 1 — Establecer (2s)
Cámara: wide_establishing
- mike camina_a cris
```

### Nivel 3 — Custom assets y código (developer)

- Subir modelos 3D propios.
- Escribir acciones custom para agentes.
- Modificar el motor (cuando CWE sea más maduro como ecosistema).

---

## Estructura de loops

### Loop de creación (engagement)

```
Usuario tiene una idea
     ↓
La describe a CWE
     ↓
CWE genera el mundo en 60s
     ↓
Usuario itera conversacionalmente
     ↓
El mundo se siente "suyo"
     ↓
Quiere mostrarlo a alguien
```

Métricas críticas:
- **Time to first wow**: < 2 minutos.
- **Iterations per session**: > 5.
- **Session duration**: > 15 minutos.

### Loop social (growth)

```
Usuario crea mundo que le encanta
     ↓
Lo comparte (link público o video)
     ↓
Otros lo ven y juegan
     ↓
Algunos se inscriben
     ↓
Algunos remixean el original
     ↓
La comunidad crece
```

Métricas críticas:
- **Share rate**: > 20% de usuarios comparten al menos un mundo.
- **Conversion from share**: > 10% de visitantes se inscriben.
- **Remix rate**: > 5% de mundos vistos son remixeados.

---

## Modelo de negocio (a definir cuando haya datos)

**Importante**: el modelo se define cuando hay producto sólido y datos reales de uso. Lo que sigue es **dirección**, no compromiso.

### Filosofía

- **Free tier generoso** para que el onboarding sea sin fricción.
- **Paid tiers para usuarios power** que generan más uso intensivo.
- **Bring your own key (BYOK)** siempre disponible como alternativa.
- **Transparencia en costos**: el usuario debería poder ver cuánto LLM consumió.

### Estructura tentativa

**Free**
- Limited de creación con IA al día.
- N mundos guardados.
- Compartir con watermark "Made with CWE".

**Paid (precio a definir)**
- Más LLM por día.
- Mundos ilimitados.
- Sin watermark.
- Asset packs premium.
- Object builder con IA.

**BYOK siempre disponible**: API key propia de Anthropic.

**Educational tier (futuro)**: licencias para escuelas con admin tools.

### Posibles fuentes de revenue futuras

- Suscripciones (lo principal).
- Asset pack store con revenue share.
- Premium worlds creados por creators.
- Licenciamiento educativo.
- Servicios profesionales.

---

## Estrategia de licencia

### Estado actual: closed source

Por ahora CWE es propietario. Decisiones técnicas son de Pablo. Razón: en validación temprana, el control acelera iteración.

### Reconsideración cuando haya producto sólido

Evaluar pasar a **open core con SaaS encima**:
- Motor (CWE) en GitHub bajo licencia AGPL o similar.
- Coto Studio (la app web hosteada con AI Orchestration) cerrada y de pago.

Razones para abrir:
- Comunidad open source genera adopción orgánica.
- Trust: usuarios saben que si Coto cierra, el motor sigue.
- Devs serios prefieren código accesible.

Razones para no apurarse:
- Open source temprano dispersa foco.
- Riesgo de clones cuando el producto valida.
- Decisiones técnicas se vuelven caras de cambiar.

**Plan**: revisitar cuando haya producto y primeros usuarios pagos.

---

## Diferenciadores (cuando llegue el horizonte 3)

### vs Roblox Studio
- CWE es **conversacional-first**. Roblox requiere aprender Lua.
- CWE es **isométrico narrativo**. Roblox es 3D libre, más complejo.

### vs Unity / Godot
- CWE es **web nativo, instalación cero**.
- CWE es **IA-first**.
- CWE es para **mundos narrativos pequeños**.

### vs Bitsy / RPG Maker / Tiled
- CWE es **3D**. Esos son 2D.
- CWE tiene **agentes con LLM**.
- CWE genera **cinematics**.

### vs The Sims
- CWE es **herramienta para crear**, Sims es juego para jugar.
- En CWE puedes hacer **cualquier mundo**.
- En CWE los personajes **hablan con LLM real**.

### vs ChatGPT / Claude (general purpose)
- CWE genera **mundos jugables**, no texto.
- CWE tiene **persistencia y mundos guardables**.
- CWE es **especializada**.

---

## Métricas norte (cuando lance)

En orden de importancia:

1. **Activation rate**: ¿cuántos completan su primera creación? Target: > 70%.
2. **Day 1 retention**: > 40%.
3. **Week 1 retention**: > 25%.
4. **Time to first wow**: < 2 minutos.
5. **Worlds created per active user**: > 3 por mes.
6. **Share rate**: > 20%.

Cuando estas estén verdes, monetizar es la conversación. Antes, foco en producto.

---

## No-goals (lo que no perseguimos)

Para mantener foco:

- **No** ser un motor general-purpose. CWE es opinionado: isométrico, narrativo, agéntico.
- **No** competir en realismo gráfico. Estética toon-low-poly es el lane.
- **No** multiplayer real-time pronto. Compartir asíncrono cubre el 80%.
- **No** apuntar a developers AAA. Ese mercado es Unity/Unreal.
- **No** enfocarnos en performance extrema. Hardware modesto alcanza.

---

## Riesgos

### Altos

- **Costos de LLM descontrolados**: free tier muy generoso → pierdes plata. Muy restrictivo → pierdes onboarding.
- **Calidad inconsistente de generación**: a veces la IA va a generar mal. Primer mundo feo = abandono.
- **Moderación de contenido**: usuarios van a probar romper la herramienta.

### Medios

- **Competencia**: Inworld, Convai, otros pueden meterse en este espacio.
- **Saturación de IA tools**: hay muchas, hay que destacar.
- **Trust en early stage**: nadie confía en herramienta nueva sin trayectoria.

### Bajos

- **Tecnología**: piezas existen y son maduras (Three.js, Anthropic, Supabase). Bajo riesgo técnico.

---

## Roadmap aproximado del horizonte 3

Cuando MVP y AGENTS.INC publicado estén listos:

### Fase 3.A (3-6 meses): foundation pública

- World Generator funcional (descripción → mundo de cero).
- Conversation Manager con memoria persistente.
- Onboarding mágico pulido.
- Auth + cuentas de usuario.
- Backend escalable.

### Fase 3.B (3-6 meses): plataforma

- Marketplace de mundos.
- Sharing con remix.
- Asset packs adicionales (medieval, school, sci-fi).
- Tiers de pricing implementados.

### Fase 3.C (3-6 meses): expansion

- Object builder con IA.
- Educational tier.
- Internacionalización profunda.
- Engine improvements y editor improvements.

### Fase 3.D (variable): comunidad y crecimiento

- Marketing.
- Documentación pública.
- Comunidad Discord.
- Open core con SaaS si la decisión madura.

---

## Para retomar este documento

Si vas a leer/escribir esto, recordá:

1. **Esto es horizonte 3**. No es ahora. No es lo que estamos construyendo.
2. **Cualquier feature de aquí que aparezca tentado a meter al MVP requiere parar y pensar dos veces**. La regla es estricta.
3. **Este documento se actualiza solo cuando haya datos reales del horizonte 1 y 2** que invaliden o validen las hipótesis.

Si te encontrás trabajando con este documento abierto durante MVP, algo está mal.
