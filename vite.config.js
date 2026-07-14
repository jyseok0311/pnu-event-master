import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" 로 두면 GitHub Pages 의 /저장소이름/ 하위 경로에서도 그대로 동작합니다.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
