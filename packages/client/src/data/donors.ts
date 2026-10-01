/**
 * Quienes han apoyado el proyecto y han dado permiso para aparecer en la portada.
 *
 * PayPal no avisa al juego de las donaciones: esta lista se mantiene a mano.
 * Regla: solo se anade a alguien que lo haya pedido o aceptado por escrito, y
 * con el nombre (o apodo) que quiera ver. Quien pida salir, se quita aqui y se
 * redespliega. Nunca se publican correos, importes ni datos de PayPal.
 */
export interface Donor {
  /** Nombre o apodo tal como la persona quiere que se vea. */
  name: string;
}

export const DONORS: readonly Donor[] = [];
