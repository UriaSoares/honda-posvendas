import { NextResponse } from "next/server";
import { getWaSession, resolvePhone } from "@/lib/whatsapp-auth";
import { sendText, sendTemplate } from "@/lib/whatsapp";
import { getContact, janelaAberta, recordOutgoing, type WaMessage } from "@/lib/whatsapp-store";
import { findTemplate, buildVars, type TemplateVarKey } from "@/lib/whatsapp-templates";

interface SendBody {
  wa:            string;
  phoneNumberId?: string;
  // texto livre:
  body?:         string;
  // ou template:
  contactId?:    number;
  scriptId?:     number;
  vars?:         Partial<Record<TemplateVarKey, string>>;
}

export async function POST(req: Request) {
  const session = await getWaSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const b = await req.json() as SendBody;
  if (!b.wa) return NextResponse.json({ error: "Contato não informado." }, { status: 400 });

  const phoneNumberId = await resolvePhone(session, b.phoneNumberId ?? null);
  if (!phoneNumberId) return NextResponse.json({ error: "Sem número conectado." }, { status: 403 });

  const contact = await getContact(phoneNumberId, b.wa);
  const isTemplate = typeof b.contactId === "number" && typeof b.scriptId === "number";

  try {
    let outBody: string;
    let outType: "text" | "template";

    if (isTemplate) {
      const tpl = findTemplate(b.contactId!, b.scriptId!);
      if (!tpl) return NextResponse.json({ error: "Template não mapeado." }, { status: 400 });
      const vars = buildVars(tpl, b.vars ?? {});
      await sendTemplate(phoneNumberId, b.wa, tpl.name, vars, tpl.lang);
      outBody = `[template: ${tpl.name}] ${vars.join(" · ")}`.trim();
      outType = "template";
    } else {
      if (!b.body?.trim())
        return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
      // texto livre só dentro da janela de 24h
      if (!janelaAberta(contact))
        return NextResponse.json(
          { error: "Janela de 24h fechada. Use um script (template) aprovado." },
          { status: 409 },
        );
      await sendText(phoneNumberId, b.wa, b.body.trim());
      outBody = b.body.trim();
      outType = "text";
    }

    const msg: WaMessage = {
      id:        `local-${Date.now()}`,
      direction: "out",
      type:      outType,
      body:      outBody,
      timestamp: Date.now(),
      status:    "sent",
    };
    await recordOutgoing(phoneNumberId, b.wa, msg);

    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
