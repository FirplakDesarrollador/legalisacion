import { NextResponse } from 'next/server';
import { loginSAP } from '@/lib/sapServiceLayer';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await loginSAP(3000);
    const baseUrl = (process.env.SAP_API_URL || 'https://200.7.96.194:50000/b1s/v1/Login').replace(/\/Login\/?$/, '');

    // Query highest Code from U_HBT_LEGENC in SAP with 3s timeout
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 3000);
    let resMaxEnc: Response;
    try {
      resMaxEnc = await fetch(`${baseUrl}/U_HBT_LEGENC?$top=1&$orderby=Code desc`, {
        headers: { Cookie: session.cookieHeader },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(tId);
    }

    let nextCode = '0000000001';
    let codeInt = 1;

    if (resMaxEnc.ok) {
      const dataMax = await resMaxEnc.json();
      if (dataMax.value && dataMax.value.length > 0) {
        codeInt = parseInt(dataMax.value[0].Code, 10) + 1;
        nextCode = codeInt.toString().padStart(10, '0');
      }
    }

    return NextResponse.json({
      success: true,
      nextCode: nextCode,
      codeInt: codeInt,
      codigo: `LEG-${codeInt}`,
    });
  } catch (err: any) {
    console.warn('SAP no disponible rápidamente, obteniendo número secuencial desde Supabase:', err.message);

    try {
      const { data } = await supabase
        .from('legalizaciones_gastos')
        .select('codigo')
        .like('codigo', 'LEG-%')
        .order('created_at', { ascending: false })
        .limit(15);

      let maxNum = 12900;
      if (data && data.length > 0) {
        for (const row of data) {
          const match = (row.codigo || '').match(/LEG-(\d+)/);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val > maxNum) maxNum = val;
          }
        }
      }
      const nextNum = maxNum + 1;
      return NextResponse.json({
        success: false,
        nextCode: nextNum.toString(),
        codeInt: nextNum,
        codigo: `LEG-${nextNum}`,
      });
    } catch {
      const fallbackNum = Math.floor(1000 + Math.random() * 9000);
      return NextResponse.json({
        success: false,
        nextCode: fallbackNum.toString(),
        codeInt: fallbackNum,
        codigo: `LEG-${fallbackNum}`,
      });
    }
  }
}
