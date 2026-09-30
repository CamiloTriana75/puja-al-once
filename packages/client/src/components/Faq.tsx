import { FAQ } from "../data/faq.js";

/**
 * Preguntas frecuentes, en la parte baja de la portada y justo antes de la
 * entrada a jugar. Dos trabajos en una sola pieza:
 *
 *   - AEO: la pregunta es el encabezado y la respuesta contesta en la
 *     primera frase, que es la forma que los buscadores usan para citar un
 *     fragmento directo ("¿Cuántos jugadores...?" -> "De 2 a 4...").
 *   - GEO: texto que un motor generativo puede citar tal cual, porque son
 *     hechos concretos y no adjetivos.
 *
 * Sin `<details>` a proposito: el contenido plegado es contenido que muchos
 * rastreadores leen como ausente, y aqui lo que interesa es que se lea.
 */
export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-8">
      <h2 id="faq-title" className="font-display text-3xl font-black uppercase tracking-wide text-white sm:text-4xl">
        Preguntas frecuentes
      </h2>
      <div className="mt-6 flex flex-col gap-3">
        {FAQ.map((entry) => (
          <article key={entry.question} className="panel bg-ink p-5">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-lime sm:text-xl">{entry.question}</h3>
            <p className="mt-2 font-body text-base text-white/80">{entry.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
