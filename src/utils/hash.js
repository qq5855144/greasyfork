/**
 * 简单的哈希函数，用于生成内容的签名
 * @param {ArrayBuffer} buffer - 输入的 ArrayBuffer
 * @returns {Promise<string>} 哈希字符串
 */
export async function simpleHash(buffer) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hexHash;
}
