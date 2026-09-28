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
    expect(screen.getByRole("button", { name: "Reaccionar: fuego" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reaccionar: risa" })).toBeInTheDocument();
  });

  it("al pulsar un emoji llama a onSend con ese emoji", () => {
    const onSend = vi.fn();
    render(<Reactions myName="Ana" onSend={onSend} />);
    act(() => {
      screen.getByRole("button", { name: "Reaccionar: fuego" }).click();
    });
    expect(onSend).toHaveBeenCalledWith("🔥");
  });

  it("tras pulsar, muestra una burbuja con el nombre de quien la mando", () => {
    render(<Reactions myName="Ana" />);
    act(() => {
      screen.getByRole("button", { name: "Reaccionar: risa" }).click();
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
      screen.getByRole("button", { name: "Reaccionar: risa" }).click();
    });
    expect(screen.getByRole("button", { name: "Reaccionar: fuego" })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByRole("button", { name: "Reaccionar: fuego" })).not.toBeDisabled();
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
      screen.getByRole("button", { name: "Reaccionar: risa" }).click();
    });
    act(() => {
      screen.getByRole("button", { name: "Reaccionar: fuego" }).click();
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("pinta las burbujas de incoming ademas de las propias", () => {
    render(
      <Reactions
        myName="Ana"
        incoming={[{ id: "servidor-1", emoji: "🔥", senderName: "Bea" }]}
      />,
    );
    const bubble = screen.getByRole("status");
    expect(bubble).toHaveTextContent("Bea");
    expect(bubble).toHaveTextContent("🔥");
  });

  it("con noRise, una burbuja propia se retira sola tras BUBBLE_LIFETIME_MS sin esperar a onAnimationComplete", () => {
    render(<Reactions myName="Ana" noRise />);
    act(() => {
      screen.getByRole("button", { name: "Reaccionar: risa" }).click();
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("onExpire se llama con el id de una burbuja propia que termina de animarse", () => {
    const onExpire = vi.fn();
    render(<Reactions myName="Ana" noRise onExpire={onExpire} />);
    act(() => {
      screen.getByRole("button", { name: "Reaccionar: risa" }).click();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
