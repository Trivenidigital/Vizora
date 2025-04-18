import { defineConfig, PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url';
// import path from 'path'; // Commented out as unused

// <<< Import PostCSS plugins directly >>>
import tailwindcssPostcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

// <<< REMOVE import of postcssConfig file >>>
// import postcssConfig from './postcss.config.cjs'; 

// https://vite.dev/config/
// Use function syntax to access the mode
export default defineConfig(({ mode }: { mode: string }) => {
  return {
    // <<< Force a new cache directory >>>
    cacheDir: 'node_modules/.vite/custom-cache-dir', 
    plugins: [react()] as PluginOption[],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@vizora/common': fileURLToPath(new URL('../common/src', import.meta.url)),
        '@vizora/display': fileURLToPath(new URL('../VizoraDisplay/src', import.meta.url))
      },
      // Add dedupe for react to potentially resolve HMR/double-render issues
      dedupe: ['react', 'react-dom'] 
    },
    optimizeDeps: {
      include: ['framer-motion'], // <<< Force include framer-motion
    },
    // Remove optimizeDeps.exclude for the old library
    // optimizeDeps: {
    //   exclude: ['qrcode.react'] 
    // },
    // Use the 'mode' parameter passed to the config function
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode || 'development')
    },
    // Add server config if not present, otherwise ensure port is set
    server: {
      port: 3001, // Ensure port 3001 is explicitly set here too
      strictPort: true,
      host: true, // Allows access from network if needed
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['..'] 
      }
    },
    css: { // <<< Define postcss plugins inline >>>
      postcss: {
        plugins: [
          tailwindcssPostcss, // Use the imported plugin
          autoprefixer,      // Use the imported plugin
        ],
      },
    },
  }
})
