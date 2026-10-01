import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EarlyAccessNotice } from "./EarlyAccessNotice.js";
import { FeedbackHost } from "./FeedbackDialog.js";
import { closeFeedback, openFeedback } from "../net/feedback.js";

describe("aviso de fase temprana", () => {
  beforeEach(() => sessionStorage.clear());

  it("sale al entrar y avisa de las fotos y de los errores", () => {
    render(<EarlyAccessNotice />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /fase temprana de desarrollo/i })).toBeInTheDocument();
    expect(screen.getByText(/fotos de jugadores no se ven o salen mal/i)).toBeInTheDocument();
  });

  it("se cierra al aceptar y no vuelve a salir en la misma sesion", async () => {
    const { unmount } = render(<EarlyAccessNotice />);
    fireEvent.click(screen.getByRole("button", { name: "Entendido, a jugar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    unmount();

    render(<EarlyAccessNotice />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("se cierra tambien con Escape", async () => {
    render(<EarlyAccessNotice />);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("comentarios", () => {
  afterEach(() => {
    act(() => closeFeedback());
    vi.unstubAllGlobals();
  });

  it("no sale hasta que se abre y valida un mensaje corto", () => {
    render(<FeedbackHost />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => openFeedback());
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tu mensaje"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));
    expect(screen.getByRole("alert")).toHaveTextContent("al menos 5 caracteres");
  });

  it("envia tipo, mensaje y contacto al servidor y da las gracias", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }));
    vi.stubGlobal("fetch", fetchMock);

    render(<FeedbackHost />);
    act(() => openFeedback());
    fireEvent.click(screen.getByRole("button", { name: /Una idea/ }));
    fireEvent.change(screen.getByLabelText("Tu mensaje"), { target: { value: "Faltan jugadores de los 90" } });
    fireEvent.change(screen.getByLabelText(/Cómo contactarte/), { target: { value: "ana@correo.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));

    await screen.findByText("¡Gracias!");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }];
    expect(url).toMatch(/\/feedback$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ kind: "sugerencia", message: "Faltan jugadores de los 90", contact: "ana@correo.com", website: "" });
  });

  it("muestra el motivo cuando el servidor rechaza el envio", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "RATE_LIMITED" }) })));

    render(<FeedbackHost />);
    act(() => openFeedback());
    fireEvent.change(screen.getByLabelText("Tu mensaje"), { target: { value: "Un mensaje valido" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("varios comentarios seguidos");
  });
});
