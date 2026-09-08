import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Sin proxy de "/silhouettes": el cliente construye URLs absolutas
// (roomId + publicId) contra el servidor, nunca rutas relativas -- ver
// net/types.ts y screens/Lobby.tsx. Un proxy aqui nunca se usaria.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
});
