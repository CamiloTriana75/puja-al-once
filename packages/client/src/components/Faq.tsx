import { FAQ } from "../data/faq.js";

/**
 * Preguntas frecuentes de la portada. La pregunta es el encabezado y la
 * respuesta contesta en la primera frase (fragmento directo para buscadores).
 *
 * Sin `<details>` a proposito: el contenido plegado es contenido que muchos
 * rastreadores leen como ausente, y aqui lo que interesa es que se lea.
 */
export function Faq() {
  return (
    <section id="preguntas" aria-labelledby="faq-title" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[76rem] px-4 sm:px-6 lg:px-8">
        <h2
          id="faq-title"
          className="text-center font-headline text-[clamp(1.85rem,3.4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-forest"
        >
          Preguntas frecuentes
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {FAQ.map((entry) => (
            <article key={entry.question} className="rounded-[1.75rem] bg-forest p-7 sm:p-9">
              <h3 className="font-headline text-[1.08rem] font-semibold leading-[1.35] tracking-[-0.02em] text-white">{entry.question}</h3>
              <p className="mt-3 font-copy text-[1.08rem] leading-[1.6] text-white/80">{entry.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
