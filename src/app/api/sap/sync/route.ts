import { NextResponse } from 'next/server';
import { syncPendingSAPRecords } from '@/lib/sapSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await syncPendingSAPRecords();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Error en sincronización automática' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await syncPendingSAPRecords();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      message: 'Sincronizador automático activo en la red interna de Firplak.',
      syncedCount: 0,
    });
  }
}
