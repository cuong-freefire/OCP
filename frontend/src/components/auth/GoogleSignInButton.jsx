import { useEffect, useRef, useState } from 'react';
import { authApi } from '../../api/authApi.js';
import { SecondaryButton } from './AuthFormControls.jsx';

const googleScriptSrc = 'https://accounts.google.com/gsi/client';
let googleScriptPromise;

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${googleScriptSrc}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = googleScriptSrc;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export default function GoogleSignInButton({ loginWithCredential, onSuccess, onError }) {
  const buttonRef = useRef(null);
  const [clientId, setClientId] = useState('');
  const [checking, setChecking] = useState(true);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    authApi
      .googleConfig()
      .then((response) => {
        if (mounted && response.data?.configured && response.data?.clientId) {
          setClientId(response.data.clientId);
        }
      })
      .catch(() => {
        if (mounted) setClientId('');
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let mounted = true;

    loadGoogleIdentityScript()
      .then(() => {
        if (mounted) setScriptReady(true);
      })
      .catch(() => {
        if (mounted) onError?.('Chưa thể tải đăng nhập Google.');
      });

    return () => {
      mounted = false;
    };
  }, [clientId, onError]);

  useEffect(() => {
    if (!scriptReady || !buttonRef.current || !window.google?.accounts?.id) return;

    buttonRef.current.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!response.credential) {
          onError?.('Đăng nhập Google chưa hoàn tất.');
          return;
        }

        try {
          if (!loginWithCredential) {
            onError?.('Đăng nhập Google chưa khả dụng.');
            return;
          }
          const user = await loginWithCredential(response.credential);
          onSuccess?.(user);
        } catch (error) {
          onError?.(error);
        }
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'continue_with',
      width: Math.min(buttonRef.current.clientWidth || 400, 400),
    });
  }, [clientId, onError, onSuccess, scriptReady]);

  if (!checking && !clientId) return null;

  return (
    <div className="google-button-slot" ref={buttonRef}>
      {(!scriptReady || checking) && <SecondaryButton disabled>Continue with Google</SecondaryButton>}
    </div>
  );
}
