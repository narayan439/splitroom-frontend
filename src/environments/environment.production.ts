declare global {
  interface Window {
    __SPLITROOM_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

export const environment = {
  production: true,
  apiUrl:
    typeof window === 'undefined'
      ? 'https://splitroom-backend.vercel.app'
      : (window.__SPLITROOM_CONFIG__?.apiUrl ?? 'https://splitroom-backend.vercel.app').replace(
          /\/+$/,
          '',
        ),
};
