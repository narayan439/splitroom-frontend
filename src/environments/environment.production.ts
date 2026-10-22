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
      ? 'https://splitroom-backend.onrender.com'
      : (window.__SPLITROOM_CONFIG__?.apiUrl ?? 'https://splitroom-backend.onrender.com').replace(
          /\/+$/,
          '',
        ),
};
