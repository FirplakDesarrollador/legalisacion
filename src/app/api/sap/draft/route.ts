import { NextResponse } from 'next/server';
import { crearBorradorLegalizacionSAP, loginSAP } from '@/lib/sapServiceLayer';

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
    return NextResponse.json(
      { success: false, message: err.message || 'Error en servidor de SAP Service Layer' },
      { status: 500 }
    );
  }
}
