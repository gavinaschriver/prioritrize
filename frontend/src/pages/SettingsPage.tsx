import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  useDisconnectGoogle,
  useGoogleCalendar,
  useStartGoogleConnect,
  useSyncGoogleNow,
  useUpdateGoogleSettings,
} from '../hooks/useGoogleCalendar';
import type { GoogleCalendarConnection, GoogleSyncResult } from '../types';

const CARD = 'bg-white rounded-lg border border-gray-200 p-4 space-y-3';
const INPUT =
  'px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const PRIMARY =
  'px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50';
const SECONDARY =
  'px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50';

function formatWhen(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return then.toLocaleString();
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's non-standard flag; the only way to detect this on iOS.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Mounted with a key tied to the connection, so every field can be seeded
 * straight from props rather than synchronised in an effect.
 */
function ConnectedCalendar({ data }: { data: GoogleCalendarConnection }) {
  const connect = useStartGoogleConnect();
  const disconnect = useDisconnectGoogle();
  const syncNow = useSyncGoogleNow();
  const updateSettings = useUpdateGoogleSettings();

  const [hour, setHour] = useState(data.default_hour ?? 9);
  const [duration, setDuration] = useState(data.default_duration_minutes ?? 30);
  const [reminders, setReminders] = useState((data.reminder_minutes ?? [0, 30]).join(', '));
  const [rollForward, setRollForward] = useState(data.roll_forward ?? true);
  const [lastSync, setLastSync] = useState<GoogleSyncResult | null>(null);
  const [error, setError] = useState('');

  const handleSaveSettings = async () => {
    setError('');
    const parsed = reminders
      .split(',')
      .map((r) => parseInt(r.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0);
    try {
      await updateSettings.mutateAsync({
        default_hour: hour,
        default_duration_minutes: duration,
        reminder_minutes: parsed.length ? parsed : [0],
        roll_forward: rollForward,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Google Calendar</h2>
          <p className="text-xs text-gray-500">{data.google_account_email ?? 'connected'}</p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            data.status === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {data.status}
        </span>
      </div>

      {data.status === 'needs_reauth' && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          Google revoked access, so nothing is being synced. Reconnect to start the reminders
          again.
        </div>
      )}
      {data.status === 'error' && data.last_error && (
        <p className="text-xs text-red-600 break-words">{data.last_error}</p>
      )}

      <p className="text-xs text-gray-500">
        {data.synced_event_count} event{data.synced_event_count === 1 ? '' : 's'} synced · last
        synced {formatWhen(data.last_synced_at)}
      </p>

      {/* Almost every "it isn't working" report is this, and it can only be
          fixed on the phone itself. */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <strong>One thing to do on your phone:</strong> open the Google Calendar app →
        Settings → PRIORI-TRIZE, and turn on both <em>Sync</em> and <em>Notifications</em>.
        Enabling the calendar on the web does not enable it there, and without this you will
        never see a reminder.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-500">
          Default hour
          <input
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => setHour(parseInt(e.target.value, 10))}
            className={`${INPUT} w-full mt-1`}
          />
        </label>
        <label className="text-xs text-gray-500">
          Duration (min)
          <input
            type="number"
            min={5}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10))}
            className={`${INPUT} w-full mt-1`}
          />
        </label>
      </div>

      <label className="text-xs text-gray-500 block">
        Remind me (minutes before, comma separated)
        <input
          type="text"
          value={reminders}
          onChange={(e) => setReminders(e.target.value)}
          className={`${INPUT} w-full mt-1`}
        />
      </label>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={rollForward}
          onChange={(e) => setRollForward(e.target.checked)}
          className="mt-1"
        />
        <span>
          Roll overdue items forward
          <span className="block text-xs text-gray-400">
            Keeps re-arming the reminder every day until you check the item off. Turn this off
            and an overdue item reminds you exactly once.
          </span>
        </span>
      </label>

      <p className="text-xs text-gray-400">Timezone: {data.timezone}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {lastSync && (
        <p className="text-xs text-gray-500">
          {lastSync.created} created · {lastSync.updated} updated · {lastSync.deleted} removed ·{' '}
          {lastSync.unchanged} unchanged ({lastSync.api_calls} API calls)
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className={PRIMARY} disabled={updateSettings.isPending} onClick={handleSaveSettings}>
          Save settings
        </button>
        <button
          className={SECONDARY}
          disabled={syncNow.isPending}
          onClick={() =>
            syncNow.mutate(undefined, {
              onSuccess: (r) => setLastSync(r),
              onError: (e: Error) => setError(e.message),
            })
          }
        >
          {syncNow.isPending ? 'Syncing…' : 'Sync now'}
        </button>
        {data.status !== 'connected' && (
          <button className={PRIMARY} onClick={() => connect.mutate('/settings')}>
            Reconnect
          </button>
        )}
        <button
          className="px-3 py-2 text-sm text-red-600 hover:underline disabled:opacity-50"
          disabled={disconnect.isPending}
          onClick={() => {
            if (
              confirm(
                'Disconnect Google Calendar? The PRIORI-TRIZE calendar and its events stay in Google.',
              )
            ) {
              disconnect.mutate();
            }
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

function GoogleCalendarSection() {
  const { data, isLoading } = useGoogleCalendar();
  const connect = useStartGoogleConnect();
  const [error, setError] = useState('');

  if (isLoading) return <div className={CARD}>Loading…</div>;

  if (data?.connected) {
    return <ConnectedCalendar key={data.calendar_id ?? 'pending'} data={data} />;
  }

  return (
    <div className={CARD}>
      <h2 className="text-sm font-semibold text-gray-700">Google Calendar</h2>
      <p className="text-sm text-gray-600">
        Push every dated todo, project and task into a calendar of its own, so Google handles
        the reminding on your phone. Overdue items move forward a day at a time until you check
        them off — the same way an unchecked deadline keeps costing you points.
      </p>
      <p className="text-xs text-gray-400">
        Creates a new calendar called PRIORI-TRIZE. It cannot see or change your existing
        calendars.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        className={PRIMARY}
        disabled={connect.isPending}
        onClick={() => connect.mutate('/settings', { onError: (e: Error) => setError(e.message) })}
      >
        Connect Google Calendar
      </button>
    </div>
  );
}

function InstallSection() {
  if (isInstalled()) {
    return (
      <div className={CARD}>
        <h2 className="text-sm font-semibold text-gray-700">Install app</h2>
        <p className="text-sm text-gray-600">Running as an installed app. Nothing to do.</p>
      </div>
    );
  }
  return (
    <div className={CARD}>
      <h2 className="text-sm font-semibold text-gray-700">Install app</h2>
      {isIos() ? (
        <p className="text-sm text-gray-600">
          Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>. You will be asked
          to sign in once more inside the installed app — it gets its own storage, separate from
          Safari.
        </p>
      ) : (
        <p className="text-sm text-gray-600">
          Use your browser menu and choose <strong>Install app</strong> (or{' '}
          <strong>Add to Home screen</strong>).
        </p>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Read once at mount: the OAuth callback always lands here on a fresh
  // navigation, and holding the value lets us strip the query string without
  // the banner disappearing with it.
  const [banner] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    return google ? { kind: google, reason: params.get('reason') ?? '' } : null;
  });

  useEffect(() => {
    // Strip the params so a refresh does not replay the banner.
    if (banner) navigate(location.pathname, { replace: true });
    // Mount only — `banner` is frozen and re-running would fight the user's
    // own navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">Settings</h1>

      {banner?.kind === 'connected' && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          Google Calendar connected and your dated items have been synced.
        </div>
      )}
      {banner?.kind === 'connected_with_errors' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          Connected, but the first sync failed: {banner.reason}
        </div>
      )}
      {banner?.kind === 'error' && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          Could not connect to Google: {banner.reason || 'unknown error'}
        </div>
      )}

      <GoogleCalendarSection />
      <InstallSection />

      <div className={CARD}>
        <h2 className="text-sm font-semibold text-gray-700">Account</h2>
        <p className="text-sm text-gray-600">{user?.email}</p>
        <button onClick={signOut} className={SECONDARY}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
