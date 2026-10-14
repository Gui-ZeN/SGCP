import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    // Chave de SITE do reCAPTCHA (App Check). Aceita também sem o prefixo
    // VITE_: a Vercel não deixa marcar variável VITE_ como sensível, e o nome
    // usado lá é RECAPTCHA_SITE_KEY. É pública de qualquer jeito — vai no
    // código do site, é assim que o reCAPTCHA funciona.
    define: {
      'import.meta.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(env.VITE_RECAPTCHA_SITE_KEY || env.RECAPTCHA_SITE_KEY || ''),
    },
    build: {
      rollupOptions: {
        output: {
          // Vendors em chunks próprios: eles quase não mudam entre deploys, então
          // o navegador reaproveita o cache e só rebaixa o código do app.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
