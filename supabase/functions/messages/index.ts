// Envío de mensajes desde el CRM y tareas de WhatsApp.
// { action: 'status' }                                   → qué está configurado (equipo o admin)
// { action: 'send', conversationId, text }               → responde por WhatsApp o Instagram (dentro de las 24 h)
// { action: 'template', conversationId? | clientId?, name, language, params } → plantilla de WhatsApp (en cualquier momento)
// { action: 'sync_templates' }                           → trae las plantillas desde Meta (solo admin)
// { action: 'reminders' }                                → cron: recordatorios de la agenda por WhatsApp
import { adminClient, corsHeaders, getCaller, json, serve } from "../_shared/http.ts";
import { IG_GRAPH, IgError, notifyStaff } from "../_shared/instagram.ts";
import {
  fillTemplate,
  igSendText,
  waAccountId,
  waConfigured,
  waListTemplates,
  waNumber,
  waSendTemplate,
  waSendText,
  windowOpen,
} from "../_shared/messaging.ts";

type Admin = ReturnType<typeof adminClient>;
const NOT_CONFIGURED = "WhatsApp todavía no está configurado (faltan las claves de la Fase 7).";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const admin = adminClient();
  const caller = await getCaller(req, admin);
  if (!caller || (caller.kind === "user" && caller.role === "cliente"))
    return json({ error: "No tenés permiso." }, 403);
  const body = await req.json().catch(() => ({}));

  if (body.action === "reminders") {
    if (caller.kind !== "cron") return json({ error: "Solo el cron." }, 403);
    return json(await sendReminders(admin));
  }
  if (caller.kind !== "user") return json({ error: "Acción no permitida." }, 403);

  try {
    if (body.action === "status") {
      let phone: { display_phone_number?: string; verified_name?: string } = {};
      if (waConfigured()) {
        phone = await fetch(
          `${IG_GRAPH}/${Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")}?fields=display_phone_number,verified_name`,
          {
            headers: { Authorization: `Bearer ${Deno.env.get("WHATSAPP_TOKEN")}` },
          },
        )
          .then((r) => r.json())
          .catch(() => ({}));
      }
      return json({
        whatsapp: waConfigured(),
        phone: phone.display_phone_number ?? null,
        name: phone.verified_name ?? null,
        webhook: !!Deno.env.get("META_WEBHOOK_VERIFY_TOKEN"),
      });
    }

    if (body.action === "send") {
      const text = String(body.text ?? "").trim();
      if (!text) return json({ error: "Escribí un mensaje." }, 400);
      if (text.length > 4096)
        return json({ error: "El mensaje es demasiado largo (máximo 4.096 caracteres)." }, 400);
      const { data: conv } = await admin
        .from("conversations")
        .select("*, account:social_accounts(id, external_id)")
        .eq("id", body.conversationId)
        .maybeSingle();
      if (!conv) return json({ error: "No encontramos la conversación." }, 404);
      if (!windowOpen(conv.last_inbound_at)) {
        return json(
          {
            error:
              conv.channel === "whatsapp"
                ? "Pasaron más de 24 horas desde su último mensaje: solo podés mandar una plantilla aprobada."
                : "Instagram solo deja responder dentro de las 24 horas desde su último mensaje.",
          },
          400,
        );
      }
      let externalId: string;
      if (conv.channel === "whatsapp") {
        if (!waConfigured()) return json({ error: NOT_CONFIGURED }, 503);
        externalId = await waSendText(conv.external_contact_id, text);
      } else {
        if (!conv.account)
          return json(
            { error: "La cuenta de Instagram de esta conversación ya no está conectada." },
            400,
          );
        externalId = await igSendText(
          admin,
          conv.account.id,
          conv.account.external_id,
          conv.external_contact_id,
          text,
        );
      }
      await ingestOut(admin, conv, externalId, "texto", text, null, caller.userId);
      return json({ ok: true });
    }

    if (body.action === "template") {
      if (!waConfigured()) return json({ error: NOT_CONFIGURED }, 503);
      const params: string[] = Array.isArray(body.params)
        ? body.params.map((p: unknown) => String(p ?? "").trim())
        : [];
      const { data: tpl } = await admin
        .from("whatsapp_templates")
        .select("*")
        .eq("name", body.name)
        .eq("language", body.language ?? "es")
        .maybeSingle();
      if (!tpl)
        return json(
          {
            error: "No encontramos esa plantilla. Tocá “Sincronizar plantillas” en Configuración.",
          },
          400,
        );
      if (tpl.status !== "aprobada")
        return json({ error: "Esa plantilla todavía no está aprobada por Meta." }, 400);
      if (params.length < tpl.variables.length || params.some((p) => !p))
        return json({ error: "Completá todas las variables de la plantilla." }, 400);

      let conv: Conv | null = null;
      let to: string | null = null;
      if (body.conversationId) {
        const { data } = await admin
          .from("conversations")
          .select("*, account:social_accounts(id, external_id)")
          .eq("id", body.conversationId)
          .maybeSingle();
        if (!data || data.channel !== "whatsapp")
          return json({ error: "Las plantillas son solo para WhatsApp." }, 400);
        conv = data;
        to = data.external_contact_id;
      } else if (body.clientId) {
        const { data: client } = await admin
          .from("clients")
          .select("id, whatsapp, name, brand_name")
          .eq("id", body.clientId)
          .maybeSingle();
        to = waNumber(client?.whatsapp);
        if (!to)
          return json(
            { error: "El cliente no tiene un número de WhatsApp válido en su ficha." },
            400,
          );
      }
      if (!to) return json({ error: "Falta a quién mandarle." }, 400);
      const externalId = await waSendTemplate(
        to,
        tpl.name,
        tpl.language,
        params.slice(0, tpl.variables.length),
      );
      const text = fillTemplate(tpl.body, params);
      if (conv)
        await ingestOut(admin, conv, externalId, "plantilla", text, tpl.name, caller.userId);
      else {
        const { data: convId } = await admin.rpc("ingest_message", {
          p_channel: "whatsapp",
          p_account_id: null,
          p_contact: to,
          p_contact_name: null,
          p_username: null,
          p_direction: "saliente",
          p_external_id: externalId,
          p_type: "plantilla",
          p_body: text,
          p_media_path: null,
          p_media_mime: null,
          p_file_name: null,
          p_template: tpl.name,
          p_sent_at: new Date().toISOString(),
          p_sent_by: caller.userId,
        });
        if (body.clientId && convId)
          await admin
            .from("conversations")
            .update({ client_id: body.clientId })
            .eq("id", convId)
            .is("client_id", null);
        return json({ ok: true, conversationId: convId });
      }
      return json({ ok: true, conversationId: conv!.id });
    }

    if (body.action === "sync_templates") {
      if (caller.role !== "admin") return json({ error: "Solo un admin." }, 403);
      if (!waConfigured() || !waAccountId()) return json({ error: NOT_CONFIGURED }, 503);
      const list = await waListTemplates();
      const statusMap: Record<string, string> = {
        APPROVED: "aprobada",
        REJECTED: "rechazada",
        PAUSED: "rechazada",
        DISABLED: "rechazada",
      };
      const rows = list.map((t) => {
        const text = t.components.find((c) => c.type === "BODY")?.text ?? "";
        const vars = [...new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]))].sort(
          (a, b) => Number(a) - Number(b),
        );
        return {
          name: t.name,
          language: t.language,
          category: t.category,
          body: text,
          variables: vars,
          status: statusMap[t.status] ?? "pendiente",
          meta_id: t.id,
        };
      });
      if (rows.length) {
        const { error } = await admin
          .from("whatsapp_templates")
          .upsert(rows, { onConflict: "name,language" });
        if (error) throw new Error(error.message);
      }
      // Las que ya no existen en Meta se borran
      const { data: all } = await admin.from("whatsapp_templates").select("id, name, language");
      const keep = new Set(rows.map((r) => `${r.name}|${r.language}`));
      const gone = (all ?? []).filter((t) => !keep.has(`${t.name}|${t.language}`)).map((t) => t.id);
      if (gone.length) await admin.from("whatsapp_templates").delete().in("id", gone);
      return json({ ok: true, count: rows.length });
    }
  } catch (e) {
    const msg =
      e instanceof IgError ? e.message : e instanceof Error ? e.message : "Error desconocido";
    return json({ error: msg }, 502);
  }
  return json({ error: "Acción desconocida" }, 400);
});

type Conv = {
  id: string;
  channel: "whatsapp" | "instagram";
  external_contact_id: string;
  social_account_id: string | null;
};

async function ingestOut(
  admin: Admin,
  conv: Conv,
  externalId: string,
  type: "texto" | "plantilla",
  text: string,
  template: string | null,
  userId: string,
) {
  const { error } = await admin.rpc("ingest_message", {
    p_channel: conv.channel,
    p_account_id: conv.social_account_id,
    p_contact: conv.external_contact_id,
    p_contact_name: null,
    p_username: null,
    p_direction: "saliente",
    p_external_id: externalId,
    p_type: type,
    p_body: text,
    p_media_path: null,
    p_media_mime: null,
    p_file_name: null,
    p_template: template,
    p_sent_at: new Date().toISOString(),
    p_sent_by: userId,
  });
  if (error) console.error("ingest saliente", error);
}

// ================================================================ Recordatorios de la agenda
const REMINDER_TEMPLATE = "recordatorio_reunion";
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function whenText(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000); // Montevideo
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1} a las ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

async function sendReminders(admin: Admin) {
  if (!waConfigured()) return { sent: 0, skipped: "sin configurar" };
  const { data: tpl } = await admin
    .from("whatsapp_templates")
    .select("*")
    .eq("name", REMINDER_TEMPLATE)
    .eq("status", "aprobada")
    .limit(1)
    .maybeSingle();
  const { data: due, error } = await admin.rpc("claim_whatsapp_reminders");
  if (error) return { error: error.message };
  let sent = 0;
  for (const ev of (due ?? []) as {
    event_id: string;
    title: string;
    starts_at: string;
    location: string | null;
    meet_url: string | null;
    client_name: string;
    whatsapp: string;
    client_id: string;
  }[]) {
    const to = waNumber(ev.whatsapp);
    if (!tpl || !to) {
      await notifyStaff(
        admin,
        "No se mandó un recordatorio por WhatsApp",
        !tpl
          ? `Falta la plantilla aprobada "${REMINDER_TEMPLATE}" (evento: ${ev.title}).`
          : `El número de ${ev.client_name} no es válido (evento: ${ev.title}).`,
        "/agenda",
        "agenda",
      );
      continue;
    }
    const params = [
      ev.client_name.split(" ")[0],
      ev.title,
      whenText(ev.starts_at),
      ev.meet_url || ev.location || "te pasamos los detalles por acá",
    ].slice(0, tpl.variables.length);
    try {
      const externalId = await waSendTemplate(to, tpl.name, tpl.language, params);
      const { data: convId } = await admin.rpc("ingest_message", {
        p_channel: "whatsapp",
        p_account_id: null,
        p_contact: to,
        p_contact_name: null,
        p_username: null,
        p_direction: "saliente",
        p_external_id: externalId,
        p_type: "plantilla",
        p_body: fillTemplate(tpl.body, params),
        p_media_path: null,
        p_media_mime: null,
        p_file_name: null,
        p_template: tpl.name,
        p_sent_at: new Date().toISOString(),
        p_sent_by: null,
      });
      if (convId)
        await admin
          .from("conversations")
          .update({ client_id: ev.client_id })
          .eq("id", convId)
          .is("client_id", null);
      sent++;
    } catch (e) {
      await notifyStaff(
        admin,
        "Falló un recordatorio por WhatsApp",
        `${ev.title}: ${e instanceof Error ? e.message : e}`,
        "/agenda",
        "agenda",
      );
    }
  }
  return { sent };
}
