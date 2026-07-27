import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registers the service worker and, because registerType is 'prompt', asks
 * before activating a new one. Swapping the worker mid-session can leave the
 * page pointing at chunks the new precache manifest no longer has.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
      <p className="text-sm text-gray-700">A new version of PRIORI-TRIZE is available.</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Reload
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Later
        </button>
      </div>
    </div>
  );
}
