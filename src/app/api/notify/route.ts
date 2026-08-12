import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { correo, titulo, contenido, link } = body;

    if (!correo || !titulo || !contenido || !link) {
      return NextResponse.json(
        { success: false, message: 'Faltan parámetros obligatorios para la notificación' },
        { status: 400 }
      );
    }

    const flowUrl = 'https://8c18912a4169ec67aa9b39bdfb7cc3.10.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/05/workflows/fb27e082be7e4a6486938b6c7b81f2c6/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=alJWDIinaFwxmT_PTghi-bwfBaSMoOdBlX0x5MS2V5E';

    console.log(`Server-side: Triggering Power Automate flow for ${correo}...`);
    
    const resFlow = await fetch(flowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, titulo, contenido, link }),
    });

    if (!resFlow.ok) {
      const errText = await resFlow.text();
      console.error(`Power Automate error status ${resFlow.status}:`, errText);
      return NextResponse.json(
        { success: false, message: `Error del webhook de Power Automate: ${resFlow.status}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Notificación enviada exitosamente a Power Automate.' });
  } catch (err: any) {
    console.error('Server-side notify route error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Error interno del servidor en notificación' },
      { status: 500 }
    );
  }
}
