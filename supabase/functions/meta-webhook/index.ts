// Webhook de Meta: recibe en tiempo real los mensajes de WhatsApp y de Instagram.
// GET  → verificación de la suscripción (hub.verify_token = META_WEBHOOK_VERIFY_TOKEN)
// POST → mensajes y estados; se valida la firma con META_APP_SECRET
import { adminClient, env, json, serve } from "../_shared/http.ts";
import { getToken } from "../_shared/instagram.ts";
import {
  igProfile,
  igStoreMedia,
  typeFromMime,
  validSignature,
  waStoreMedia,
} from "../_shared/messaging.ts";

type Admin = ReturnType<typeof adminClient>;

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const ok =
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    return ok
      ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 })
      : new Response("Token inválido", { status: 403 });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256"), env("META_APP_SECRET"))))
    return new Response("Firma inválida", { status: 401 });
  const payload = JSON.parse(raw);
  const admin = adminClient();

  try {
    if (payload.object === "whatsapp_business_account") await handleWhatsApp(admin, payload);
    else if (payload.object === "instagram") await handleInstagram(admin, payload);
  } catch (e) {
    // Respondemos 200 igual: si no, Meta reintenta durante horas. El error queda en los logs.
    console.error("Error procesando el webhook", e);
  }
  return new Response("ok", { status: 200 });
});

// ================================================================ WhatsApp
async function handleWhatsApp(admin: Admin, payload: WaPayload) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v) continue;
      const names = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
      for (const m of v.messages ?? []) {
        let type: "texto" | "imagen" | "video" | "audio" | "documento" = "texto";
        let body: string | null = null;
        let media: { path: string; mime: string } | null = null;
        let fileName: string | null = null;
        if (m.type === "text") body = m.text?.body ?? null;
        else if (m.type === "button") body = m.button?.text ?? null;
        else if (m.type === "interactive")
          body = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
        else if (m.type === "location")
          body =
            `Ubicación: ${m.location?.name ?? ""} https://maps.google.com/?q=${m.location?.latitude},${m.location?.longitude}`.trim();
        else if (m.type === "reaction") continue;
        else {
          const att = m.image ?? m.video ?? m.audio ?? m.voice ?? m.document ?? m.sticker;
          if (att?.id) media = await waStoreMedia(admin, att.id);
          type = media
            ? typeFromMime(media.mime)
            : m.type === "image" || m.type === "sticker"
              ? "imagen"
              : m.type === "video"
                ? "video"
                : m.type === "audio" || m.type === "voice"
                  ? "audio"
                  : "documento";
          body = att?.caption ?? (media ? null : "Archivo que no se pudo descargar");
          fileName = m.document?.filename ?? null;
        }
        const { error } = await admin.rpc("ingest_message", {
          p_channel: "whatsapp",
          p_account_id: null,
          p_contact: m.from,
          p_contact_name: names.get(m.from) ?? null,
          p_username: null,
          p_direction: "entrante",
          p_external_id: m.id,
          p_type: type,
          p_body: body,
          p_media_path: media?.path ?? null,
          p_media_mime: media?.mime ?? null,
          p_file_name: fileName,
          p_template: null,
          p_sent_at: new Date(Number(m.timestamp) * 1000).toISOString(),
        });
        if (error) console.error("ingest whatsapp", error);
      }
      for (const s of v.statuses ?? []) {
        const map: Record<string, string> = {
          sent: "enviado",
          delivered: "entregado",
          read: "leido",
          failed: "fallo",
        };
        if (!map[s.status]) continue;
        await admin.rpc("update_message_status", {
          p_external_id: s.id,
          p_status: map[s.status],
          p_error: s.errors?.[0]?.error_data?.details ?? s.errors?.[0]?.title ?? null,
        });
      }
    }
  }
}

// ================================================================ Instagram
async function handleInstagram(admin: Admin, payload: IgPayload) {
  for (const entry of payload.entry ?? []) {
    const { data: acc } = await admin
      .from("social_accounts")
      .select("id, external_id, status")
      .eq("platform", "instagram")
      .eq("external_id", String(entry.id))
      .maybeSingle();
    if (!acc) continue;
    for (const ev of entry.messaging ?? []) {
      const msg = ev.message;
      if (!msg || msg.is_deleted || msg.is_unsupported) continue;
      const echo = !!msg.is_echo || String(ev.sender?.id) === String(entry.id);
      const contact = String(echo ? ev.recipient?.id : ev.sender?.id);
      // Datos del contacto (solo la primera vez)
      let profile: { name?: string; username?: string; profile_pic?: string } = {};
      const { data: existing } = await admin
        .from("conversations")
        .select("id")
        .eq("channel", "instagram")
        .eq("social_account_id", acc.id)
        .eq("external_contact_id", contact)
        .maybeSingle();
      if (!existing) {
        try {
          profile = await igProfile(await getToken(admin, acc.id), contact);
        } catch {
          profile = {};
        }
      }
      const atts = msg.attachments ?? [];
      const parts = atts.length ? atts : [null];
      for (const [i, att] of parts.entries()) {
        let media: { path: string; mime: string } | null = null;
        if (att?.payload?.url)
          media = await igStoreMedia(
            admin,
            att.payload.url,
            `${msg.mid}-${i}`.replace(/[^a-zA-Z0-9_-]/g, ""),
          );
        const type = att
          ? media
            ? typeFromMime(media.mime)
            : att.type === "image"
              ? "imagen"
              : att.type === "video"
                ? "video"
                : att.type === "audio"
                  ? "audio"
                  : "documento"
          : "texto";
        const body =
          i === 0
            ? (msg.text ??
              (att?.type === "share" || att?.type === "story_mention"
                ? "Compartió una publicación o te mencionó en una historia"
                : null))
            : null;
        const { error } = await admin.rpc("ingest_message", {
          p_channel: "instagram",
          p_account_id: acc.id,
          p_contact: contact,
          p_contact_name: profile.name ?? null,
          p_username: profile.username ?? null,
          p_direction: echo ? "saliente" : "entrante",
          p_external_id: parts.length > 1 ? `${msg.mid}#${i}` : msg.mid,
          p_type: type,
          p_body: body,
          p_media_path: media?.path ?? null,
          p_media_mime: media?.mime ?? null,
          p_file_name: null,
          p_template: null,
          p_sent_at: new Date(Number(ev.timestamp)).toISOString(),
          p_avatar: profile.profile_pic ?? null,
        });
        if (error) console.error("ingest instagram", error);
      }
    }
  }
}

// ================================================================ Tipos del payload
interface WaMedia {
  id?: string;
  caption?: string;
  mime_type?: string;
  filename?: string;
}
interface WaPayload {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: {
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          button?: { text: string };
          interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
          location?: { latitude: number; longitude: number; name?: string };
          image?: WaMedia;
          video?: WaMedia;
          audio?: WaMedia;
          voice?: WaMedia;
          document?: WaMedia;
          sticker?: WaMedia;
        }[];
        statuses?: {
          id: string;
          status: string;
          errors?: { title?: string; error_data?: { details?: string } }[];
        }[];
      };
    }[];
  }[];
}
interface IgPayload {
  entry?: {
    id: string;
    messaging?: {
      sender?: { id: string };
      recipient?: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
        is_deleted?: boolean;
        is_unsupported?: boolean;
        attachments?: { type: string; payload?: { url?: string } }[];
      };
    }[];
  }[];
}
