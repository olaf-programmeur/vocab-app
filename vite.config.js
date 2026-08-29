import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Le greffon React était installé mais jamais chargé, faute de ce fichier :
  // chaque modification rechargeait la page entière et remettait l'application
  // à zéro. Avec lui, l'état survit aux modifications (Fast Refresh).
  plugins: [react()],
  server: {
    // Écoute aussi sur le réseau local : Vite affiche alors une adresse du type
    // http://192.168.x.x:5173, à ouvrir sur un vrai téléphone. L'affichage
    // mobile se juge sur l'appareil, pas dans un navigateur de bureau redimensionné.
    host: true,
    port: 5173,
    // Sans cela, un port 5173 déjà pris fait basculer Vite sur 5174 en silence
    // et l'on teste une application qui n'est pas celle que l'on croit.
    strictPort: true,
  },
})
