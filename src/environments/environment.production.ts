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
      ? ''
      : (window.__SPLITROOM_CONFIG__?.apiUrl ?? '').replace(/\/+$/, ''),
};
