import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Reactions } from "./Reactions.js";

describe("Reactions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pinta los seis botones de emoji, cada uno con su aria-label", () => {
    render(<Reactions myName="Ana" />);
    const group = screen.getByRole("group", { name: "Reacciones" });
    expect(group.querySelectorAll("button")).toHaveLength(6);
  });

  it("al pulsar un emoji llama a onSend con ese emoji", () => {
    const onSend = vi.fn();
    render(<Reactions myName="Ana" onSend={onSend} />);
    act(() => {
      screen.getByRole("button", { name: "Reaccionar con 🔥" }).click();
    });
    expect(onSend).toHaveBeenCalledWith("🔥");
  });

  it("tras pulsar, muestra una burbuja con el nombre de quien la mando", () => {
    render(<Reactions myName="Ana" />);
    act(() => {
      screen.getByRole("button", { name: "Reaccionar con 😂" }).click();
    });
    // "Ana" y el emoji aparecen tambien fuera de la burbuja (el propio boton
    // sigue en pantalla) -- se comprueba el `status` de la burbuja en si,
    // no el texto suelto.
    const bubble = screen.getByRole("status");
    expect(bubble).toHaveTextContent("Ana");
    expect(bubble).toHaveTextContent("😂");
  });

  it("se deshabilitan los botones durante el enfriamiento de 600ms", () => {
    render(<Reactions myName="Ana" />);
    act(() => {
      screen.getByRole("button", { name: "Reaccionar con 😂" }).click();
    });
    expect(screen.getByRole("button", { name: "Reaccionar con 🔥" })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole("button", { name: "Reaccionar con 🔥" })).not.toBeDisabled();
  });

  it("no manda una segunda reaccion mientras esta en enfriamiento", () => {
    const onSend = vi.fn();
    render(<Reactions myName="Ana" onSend={onSend} />);
    // Dos clicks reales del usuario son dos eventos de DOM separados, no
    // una unica actualizacion de React por lote -- de ahi dos `act()`
    // distintos, para que el segundo click vea ya `disabled` en el boton
    // (React 19 aplica el primer setState antes de que el navegador entregue
    // el segundo evento de click real).
    act(() => {
      screen.getByRole("button", { name: "Reaccionar con 😂" }).click();
    });
    act(() => {
      screen.getByRole("button", { name: "Reaccionar con 🔥" }).click();
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
