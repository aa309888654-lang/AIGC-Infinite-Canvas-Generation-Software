/**
 * QR 码生成工具
 * 将 YunGouOS 返回的 code_url 转换为可直接在 <img src> 中使用的 data URI
 */
import QRCode from 'qrcode';

/**
 * 从文本内容生成 QR 码 data URI
 * @param text - 要编码的内容 (如 weixin://wxpay/bizpayurl?pr=xxx)
 * @param size - 二维码尺寸 (像素)，默认 300
 * @returns data:image/png;base64,... 格式的 data URI
 */
export async function generateQrCodeDataUri(text: string, size: number = 300): Promise<string> {
  try {
    const dataUri = await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUri;
  } catch (err) {
    console.error('[QR Code] 生成失败:', err);
    throw new Error('二维码生成失败');
  }
}

/**
 * 从 YunGouOS 支付响应中提取 code_url
 * YunGouOS nativePay 响应格式: { code: "SUCCESS", data: "weixin://..." }
 * 或嵌套在网关响应中: { code: 0, data: { code: "SUCCESS", data: "weixin://..." } }
 */
export function extractCodeUrl(gatewayResponse: any): string | null {
  if (!gatewayResponse) return null;

  // 网关响应格式: { code: 0, data: <yungouos_response> }
  const yungouosData = gatewayResponse.data;

  if (!yungouosData) return null;

  // YunGouOS 响应可能包含 code_url 或 data 字段
  if (typeof yungouosData === 'string') {
    return yungouosData; // 直接是 code_url
  }

  // 尝试多种可能的字段名
  return (
    yungouosData.code_url ||
    yungouosData.codeUrl ||
    yungouosData.data ||
    yungouosData.qr_code ||
    yungouosData.qrCode ||
    null
  );
}
