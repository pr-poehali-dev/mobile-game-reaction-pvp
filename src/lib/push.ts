import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const PUSH_API = "https://functions.poehali.dev/7000f2b2-907e-4557-90a3-c4e459c83279";
const SCHEDULER_API = "https://functions.poehali.dev/0ec5c321-2b94-4415-a36e-a08a61a57b6a";

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FCM_API_KEY || "",
  projectId: "ne-slomaisa",
  messagingSenderId: import.meta.env.VITE_FCM_SENDER_ID || "",
  appId: "1:placeholder:web:placeholder",
};

function getApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(FIREBASE_CONFIG);
}

export async function requestPushPermission(playerId: string): Promise<boolean> {
  const supported = await isSupported().catch(() => false);
  if (!supported) return false;
  if (!("Notification" in window)) return false;

  const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY || "";
  const senderId = import.meta.env.VITE_FCM_SENDER_ID || "";
  if (!vapidKey || !senderId) return false;

  const permission = await Notification.requestPermission().catch(() => "denied" as NotificationPermission);
  if (permission !== "granted") return false;

  try {
    const app = getApp();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey });
    if (!token) return false;

    await fetch(`${PUSH_API}/?action=push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Player-Id": playerId,
      },
      body: JSON.stringify({ push_token: token }),
    });

    localStorage.setItem("push_token_saved", "1");
    return true;
  } catch (_e) {
    return false;
  }
}

export async function schedulePushAfterMatch(playerId: string): Promise<void> {
  const saved = localStorage.getItem("push_token_saved");
  if (!saved) return;

  setTimeout(async () => {
    try {
      await fetch(`${SCHEDULER_API}/?action=send_one`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      });
    } catch (_e) { /* silent */ }
  }, 25 * 60 * 1000);
}