// Mensajería: WhatsApp Business Cloud API y mensajes directos de Instagram.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { IG_GRAPH, IgError, getToken, ig } from "./instagram.ts";

export const waConfigured = () =>
  !!(Deno.env.get("WHATSAPP_TOKEN") && Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"));
const waToken = () => Deno.env.get("WHATSAPP_TOKEN") ?? "";
const waPhoneId = () => Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
export const waAccountId = () => Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID") ?? "";

/** Número en formato internacional para WhatsApp. Los uruguayos sin prefijo (099 123 456) se completan con 598. */
export function waNumber(raw: string | null | undefined) {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^09\d{7}$/.test(d)) d = `598${d.slice(1)}`;
  else if (/^9\d{7}$/.test(d)) d = `598${d}`;
  return d.length >= 10 ? d : null;
}

/** Texto final de una plantilla con sus variables, para mostrarlo en la conversación. */
export const fillTemplate = (body: string, params: string[]) =>
  body.replace(/\{\{(\d+)\}\}/g, (_m, n) => params[Number(n) - 1] ?? `{{${n}}}`);

/** Ventana de atención: 24 h desde el último mensaje del contacto. */
export const windowOpen = (lastInbound: string | null) =>
  !!lastInbound && Date.now() - new Date(lastInbound).getTime() < 24 * 3600_000;

async function waPost(body: Record<string, unknown>) {
  const res = await fetch(`${IG_GRAPH}/${waPhoneId()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${waToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error ?? {};
    throw new IgError(
      waErrorMessage(e.code, e.error_data?.details || e.message),
      e.code,
      e.error_subcode,
      res.status,
    );
  }
  return data.messages?.[0]?.id as string;
}

/** Mensajes de error de WhatsApp en castellano para los casos más comunes. */
function waErrorMessage(code: number | undefined, fallback: string) {
  switch (code) {
    case 131047:
      return "Pasaron más de 24 horas desde el último mensaje del contacto: solo se puede mandar una plantilla aprobada.";
    case 131026:
      return "No se pudo entregar: el número no tiene WhatsApp o no aceptó mensajes de empresas.";
    case 132001:
      return "La plantilla no existe o todavía no está aprobada en ese idioma.";
    case 131030:
      return "Ese número no está en la lista de destinatarios permitidos del número de prueba de Meta.";
    case 190:
      return "El token de WhatsApp venció o es inválido. Revisá WHATSAPP_TOKEN.";
    default:
      return fallback || "WhatsApp rechazó el mensaje.";
  }
}

export const waSendText = (to: string, body: string) =>
  waPost({ to, type: "text", text: { body, preview_url: true } });

export const waSendTemplate = (to: string, name: string, language: string, params: string[]) =>
  waPost({
    to,
    type: "template",
    template: {
      name,
      language: { code: language },
      components: params.length
        ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
        : [],
    },
  });

/** Plantillas aprobadas, pendientes y rechazadas de la cuenta de WhatsApp Business. */
export async function waListTemplates() {
  const out: {
    id: string;
    name: string;
    language: string;
    status: string;
    category: string;
    components: { type: string; text?: string }[];
  }[] = [];
  let url: string | null =
    `${IG_GRAPH}/${waAccountId()}/message_templates?fields=id,name,language,status,category,components&limit=100`;
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${waToken()}` } });
    const data = await res.json();
    if (!res.ok || data.error)
      throw new IgError(
        data.error?.message ?? "No se pudieron leer las plantillas.",
        data.error?.code,
      );
    out.push(...data.data);
    url = data.paging?.next ?? null;
  }
  return out;
}

/** Descarga un archivo que llegó por WhatsApp y lo guarda en Storage. */
export async function waStoreMedia(admin: SupabaseClient, mediaId: string) {
  const meta = await fetch(`${IG_GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${waToken()}` },
  }).then((r) => r.json());
  if (!meta.url) return null;
  const file = await fetch(meta.url, { headers: { Authorization: `Bearer ${waToken()}` } });
  if (!file.ok) return null;
  const mime = (meta.mime_type as string | undefined)?.split(";")[0] ?? "application/octet-stream";
  const path = `wa/${mediaId}.${extFor(mime)}`;
  const { error } = await admin.storage
    .from("messages")
    .upload(path, await file.arrayBuffer(), { contentType: mime, upsert: true });
  return error ? null : { path, mime };
}

/** Guarda un adjunto de Instagram (viene con una URL temporal). */
export async function igStoreMedia(admin: SupabaseClient, url: string, name: string) {
  const file = await fetch(url);
  if (!file.ok) return null;
  const mime = file.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  const path = `ig/${name}.${extFor(mime)}`;
  const { error } = await admin.storage
    .from("messages")
    .upload(path, await file.arrayBuffer(), { contentType: mime, upsert: true });
  return error ? null : { path, mime };
}

function extFor(mime: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "application/pdf": "pdf",
  };
  return (
    map[mime] ??
    mime
      .split("/")[1]
      ?.replace(/[^a-z0-9]/gi, "")
      .slice(0, 5) ??
    "bin"
  );
}

export function typeFromMime(
  mime: string | null | undefined,
): "imagen" | "video" | "audio" | "documento" {
  if (!mime) return "documento";
  if (mime.startsWith("image/")) return "imagen";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "documento";
}

// ================================================================ Instagram
export async function igSendText(
  admin: SupabaseClient,
  accountId: string,
  igId: string,
  recipient: string,
  text: string,
) {
  const token = await getToken(admin, accountId);
  const r = await ig<{ message_id: string }>(
    `${igId}/messages`,
    token,
    { recipient: JSON.stringify({ id: recipient }), message: JSON.stringify({ text }) },
    "POST",
  );
  return r.message_id;
}

/** Nombre, usuario y foto de quien escribe por Instagram. */
export async function igProfile(token: string, igsid: string) {
  try {
    return await ig<{ name?: string; username?: string; profile_pic?: string }>(igsid, token, {
      fields: "name,username,profile_pic",
    });
  } catch {
    return {};
  }
}

/** Activa los webhooks de mensajes para una cuenta de Instagram conectada. */
export async function igSubscribe(token: string, igId: string) {
  try {
    await ig(`${igId}/subscribed_apps`, token, { subscribed_fields: "messages" }, "POST");
    return true;
  } catch (e) {
    console.error("No se pudo suscribir a los mensajes de Instagram", e);
    return false;
  }
}

// ================================================================ Firma de los webhooks de Meta
export async function validSignature(raw: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
