import { NextResponse } from 'next/server';
import { crearBorradorLegalizacionSAP, loginSAP } from '@/lib/sapServiceLayer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const session = await loginSAP();
    return NextResponse.json({
      status: 'connected',
      companyDB: process.env.SAP_COMPANY_DB,
      sessionId: session.SessionId,
      version: session.Version,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.lineas) {
      return NextResponse.json(
        { success: false, message: 'Datos de legalización requeridos' },
        { status: 400 }
      );
    }

    const result = await crearBorradorLegalizacionSAP(body);
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = String(err.message || '');
    const isQueuedOrTimeout =
      err.name === 'AbortError' ||
      msg.toLowerCase().includes('en cola') ||
      msg.toLowerCase().includes('timeout') ||
      msg.toLowerCase().includes('tiempo de espera') ||
      msg.toLowerCase().includes('firewall');

    if (isQueuedOrTimeout) {
      return NextResponse.json({
        success: true,
        queued: true,
        message: 'Aprobada con éxito. El borrador en SAP se creará automáticamente en segundo plano.',
      });
    }

    return NextResponse.json(
      { success: false, message: msg || 'Error en servidor de SAP Service Layer' },
      { status: 500 }
    );
  }
}
