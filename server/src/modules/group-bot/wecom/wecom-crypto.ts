/**
 * 企业微信消息加解密工具
 * 官方文档：https://developer.work.weixin.qq.com/document/path/90930
 */
import * as crypto from 'crypto';
import { parseStringPromise, Builder } from 'xml2js';

/**
 * SHA1 签名验证
 * 企业微信要求将 token, timestamp, nonce, encrypt 按字典序排列后做 SHA1
 */
export function sha1Sign(token: string, timestamp: string, nonce: string, encrypt: string): string {
  const arr = [token, timestamp, nonce, encrypt].sort();
  const sha1 = crypto.createHash('sha1');
  sha1.update(arr.join(''));
  return sha1.digest('hex');
}

/**
 * AES-256-CBC 解密
 * EncodingAESKey 是 Base64 编码的 43 位字符串，解码后得到 32 字节 AES Key
 * IV 取 Key 的前 16 字节
 */
export function decrypt(encryptedMsg: string, encodingAESKey: string): {
  message: string;
  corpId: string;
  random: Buffer;
} {
  const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
  const iv = aesKey.subarray(0, 16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);

  const decryptedBuf = Buffer.concat([
    decipher.update(Buffer.from(encryptedMsg, 'base64')),
    decipher.final(),
  ]);

  // 解密后内容: random(16字节) + msgLen(4字节) + msg + corpId
  const random = decryptedBuf.subarray(0, 16);
  const msgLen = decryptedBuf.readUInt32BE(16);
  const message = decryptedBuf.subarray(20, 20 + msgLen).toString('utf8');
  const corpId = decryptedBuf.subarray(20 + msgLen).toString('utf8');

  return { message, corpId, random };
}

/**
 * AES-256-CBC 加密
 */
export function encrypt(message: string, corpId: string, encodingAESKey: string): string {
  const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
  const iv = aesKey.subarray(0, 16);

  const random = crypto.randomBytes(16);
  const msgBuf = Buffer.from(message, 'utf8');
  const msgLenBuf = Buffer.alloc(4);
  msgLenBuf.writeUInt32BE(msgBuf.length, 0);
  const corpIdBuf = Buffer.from(corpId, 'utf8');

  let dataBuf = Buffer.concat([random, msgLenBuf, msgBuf, corpIdBuf]);

  // PKCS#7 填充
  const blockSize = 32;
  const padLen = blockSize - (dataBuf.length % blockSize);
  const padBuf = Buffer.alloc(padLen, padLen);
  dataBuf = Buffer.concat([dataBuf, padBuf]);

  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  cipher.setAutoPadding(false);

  const encryptedBuf = Buffer.concat([cipher.update(dataBuf), cipher.final()]);
  return encryptedBuf.toString('base64');
}

/**
 * 解析企业微信回调 XML
 */
export async function parseWecomXml(xml: string): Promise<Record<string, string>> {
  const result = await parseStringPromise(xml, { explicitArray: false });
  return result.xml as Record<string, string>;
}

/**
 * 生成企业微信回调响应 XML
 */
export function buildWecomResponse(encrypt: string, signature: string, timestamp: string, nonce: string): string {
  const builder = new Builder({ rootName: 'xml', headless: true });
  const obj = {
    Encrypt: encrypt,
    MsgSignature: signature,
    TimeStamp: timestamp,
    Nonce: nonce,
  };
  return builder.buildObject(obj);
}

/**
 * 验证回调URL（GET请求）
 * 企业微信会发 GET 请求，包含 msg_signature, timestamp, nonce, echostr
 * 需验证签名后解密 echostr，返回明文
 */
export function verifyCallback(
  token: string,
  encodingAESKey: string,
  corpId: string,
  msgSignature: string,
  timestamp: string,
  nonce: string,
  echostr: string,
): string {
  // 1. 验证签名
  const signature = sha1Sign(token, timestamp, nonce, echostr);
  if (signature !== msgSignature) {
    throw new Error(`签名验证失败: 计算=${signature}, 期望=${msgSignature}`);
  }

  // 2. 解密 echostr
  const { message, corpId: decryptedCorpId } = decrypt(echostr, encodingAESKey);
  if (decryptedCorpId !== corpId) {
    throw new Error(`CorpID不匹配: 解密=${decryptedCorpId}, 期望=${corpId}`);
  }

  // 3. 返回明文 echostr
  return message;
}
