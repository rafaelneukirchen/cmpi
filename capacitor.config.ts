import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d910cd20188546ef9050b7659cb2a37c',
  appName: 'voto-compass',
  webDir: 'dist',
  server: {
    url: 'https://d910cd20-1885-46ef-9050-b7659cb2a37c.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    BackgroundGeolocation: {
      // Desativa o som padrão "alerta de rastreamento" no Android
      backgroundMessage: 'Rastreamento ativo',
      backgroundTitle: 'Voto Compass',
      requestPermissions: true,
      stale: false,
      distanceFilter: 50,
    },
    Geolocation: {
      permissions: ['location', 'coarseLocation'],
    },
  },
};

export default config;
