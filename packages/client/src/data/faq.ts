/**
 * Preguntas que la gente hace (y por lo tanto pregunta en Google) sobre un
 * juego de subastas de cartas de futbol, en las palabras que usaria
 * alguien buscando, no en las que usaria el manual.
 *
 * ESTA ES LA FUENTE UNICA de las respuestas: las pinta `<Faq>` en la portada
 * Y alimenta el JSON-LD `FAQPage` que vive en `index.html`. El test
 * `tools/__tests__/seo.test.ts` compara ambas copias y falla si se
 * desincronizan -- es exactamente el tipo de duplicacion que Google penaliza
 * ("contenido que no coincide con la pagina"), asi que que se rompa a la
 * vista en CI sale mas barato que descubrirlo en Search Console.
 *
 * Como las respuestas son cortas y van en parrafo, tambien funcionan como
 * fragmento de respuesta directa (AEO): la pregunta es el encabezado y el
 * texto de abajo contesta en la primera frase.
 */
export interface FaqEntry {
  question: string;
  /** Respuesta en prosa, sin HTML ni saltos de linea: se usa tal cual en el JSON-LD. */
  answer: string;
}

export const FAQ: FaqEntry[] = [
  {
    question: "¿Cuántos jugadores caben en una partida de Puja el Once?",
    answer:
      "De 2 a 4 jugadores por partida. La sala de espera admite cuatro asientos y el arranque automático se dispara en cuanto los conectados pulsan todos Listo, así que una partida a dos es igual de válida que una a cuatro.",
  },
  {
    question: "¿Cuánto cuesta Puja el Once?",
    answer:
      "Nada. No hay compras, ni monedas, ni suscripciones, ni anuncios: se entra, se juega la subasta y se termina. Tampoco hace falta registro ni tarjeta.",
  },
  {
    question: "¿Necesito crear una cuenta para jugar?",
    answer:
      "No. No hay cuentas ni contraseñas. Escribes un nombre corto, creas una sala y compartes el código de cinco letras (o la marcas como pública para que aparezca en el vestuario). Nada de eso se guarda en tu navegador.",
  },
  {
    question: "¿Cómo sé a quién estoy pujando?",
    answer:
      "No lo sabes, y por eso puja a ciegas. De la carta solo se ven cuatro pistas: altura, pie dominante, origen y década. La temporada y el nombre aparecen al revelarse la jugada.",
  },
  {
    question: "¿Gana quien más dinero tiene al final?",
    answer:
      "Gana quien mejor complete su once. El presupuesto es el límite, pero la clasificación final puntúa las fichas que has ganado y cómo se combinan, no el gasto. El mejor fichaje sin presupuesto se queda sin obra.",
  },
  {
    question: "¿Funciona en el móvil y hay que instalar algo?",
    answer:
      "Sí, funciona en el móvil y no hay que instalar nada: se juega entero en el navegador, con la partida en vivo por conexión directa. También funciona en portátil y escritorio con el mismo enlace.",
  },
];
