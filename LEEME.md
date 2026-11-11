# Ruptura Kai · Prototipo jugable (v0.6)

Prototipo mínimo para móvil y tablet: templo (hub) → combate por turnos → choque de ráfagas → resultado con subida de nivel y guardado automático.

## Cómo probarlo
- **En el ordenador:** abre `index.html` con doble clic (Chrome, Edge o Safari). Funciona sin conexión.
- **En el móvil o la tablet:** necesita estar alojado en un enlace (por ejemplo, un enlace privado de Claude). Una vez abierto, en el navegador del móvil: *Compartir → Añadir a pantalla de inicio* para usarlo a pantalla completa.
- Para ver el formato móvil en el ordenador: Chrome → F12 → icono de móvil/tablet.

## Qué incluye
- 3 rivales propios con desbloqueo progresivo (Bandido de la Duna → Lobo Yamato → Tigre Colmillo de Trueno).
- Acciones: Golpe rápido, Patada furia, Cargar Kai, Guardia, Ración (curación) y Estallido Kai.
- **Esquiva táctil:** cuando el rival ataca, toca la pantalla cuando el anillo se cierra (perfecta = 0 daño y +Kai).
- **Coraza del rival:** golpes seguidos la rompen y recibe +50% de daño durante 2 turnos.
- **Choque de ráfagas:** toca sin parar durante 6 s para empujar el punto de choque.
- Guardado local (nivel, EXP, oro, victorias, rivales vencidos).
- Diseño adaptable: móvil vertical, móvil horizontal, tablet vertical y tablet horizontal (escenario a la izquierda y mandos a la derecha).

## Arte (v0.3)
Personajes y escenarios ilustrados: Ren, Bandido de la Duna (dunas), Lobo Yamato (norte nevado), Tigre Colmillo de Trueno (cañón de tormenta) y el templo en el menú principal. Cada personaje tiene una sola pose. v0.4 añade animación por código: anticipación (se echa atrás), embestida con estela y líneas de velocidad, pausa en el impacto con onda expansiva, retroceso del que recibe, cargar Kai agachado y temblando, esquiva con salto atrás y KO en el que sale despedido, cae y rebota. v0.5: Ren usa poses ilustradas (puñetazo, patada, recibir golpe, cargar Kai y KO); v0.6: los tres rivales también tienen sus cinco poses.

## Por qué Phaser 3 + Capacitor
- Las pantallas de Stitch ya son HTML/CSS: se reutiliza el sistema de diseño (colores, tipografías) sin rehacer nada.
- Phaser 3 es un motor 2D maduro, gratuito (licencia MIT) y pensado para navegador y táctil.
- Capacitor empaqueta el mismo código como app de iOS y Android (tiendas, compras integradas, notificaciones) sin reescribirlo.
- Todo es texto (código), lo que permite que la IA lo desarrolle y modifique de punta a punta. Motores como Unity o Godot dependen de un editor visual que exige manejo técnico.
- Limitación: para efectos 3D pesados o combate en tiempo real muy exigente, Unity o Godot rinden mejor. Para un RPG de combate por turnos con minijuegos táctiles, Phaser es suficiente.

## Archivos
- `index.html` — pantallas y botones.
- `style.css` — estilos y adaptación a móvil/tablet (tokens de `shonen_ki_battle/DESIGN.md`).
- `stage.js` — escenario animado (Phaser): luchadores, auras, impactos, rayos.
- `game.js` — reglas del combate, IA del rival, minijuegos y guardado.
- `arte/assets.js` — ilustraciones de personajes y escenarios (generadas con IA en Canva), incluidas dentro del archivo para que funcione con doble clic.
- `vendor/phaser.min.js` — motor Phaser 3.80.1 incluido para que funcione sin internet.

## Nota sobre propiedad intelectual
v0.2: el juego pasa a llamarse **Ruptura Kai**. La energía se llama *Kai* (no «Ki»), el ataque final es el *Estallido Kai* y la rotura de coraza se anuncia como *¡Ruptura!*. El héroe usa un diseño propio (gi verde azulado, moño rojo).

Los personajes, nombres y arte de este prototipo son propios. Las pantallas de referencia de Stitch incluyen personajes y elementos de Dragon Ball (Goku, Saiyan, Capsule Corp, etc.) y no se han utilizado: no podrían comercializarse sin licencia.
