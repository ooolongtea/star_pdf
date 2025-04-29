/**
 * 图片处理工具
 * 用于处理图片上传和转换
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 将Base64图片数据保存为文件
 * @param {string} base64Data - Base64编码的图片数据
 * @param {string} module - 模块名称（如chat, pdf等）
 * @param {string} subDir - 子目录名称（默认为images）
 * @returns {string} 保存的文件路径
 */
function saveBase64Image(base64Data, module = 'chat', subDir = 'images') {
  // 构建上传目录路径
  const uploadDir = path.join('uploads', module, subDir);

  // 确保上传目录存在
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // 从Base64字符串中提取MIME类型和数据
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error('无效的Base64图片数据');
  }

  const mimeType = matches[1];
  const base64 = matches[2];
  const buffer = Buffer.from(base64, 'base64');

  // 根据MIME类型确定文件扩展名
  let extension;
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      extension = 'jpg';
      break;
    case 'image/png':
      extension = 'png';
      break;
    case 'image/gif':
      extension = 'gif';
      break;
    case 'image/webp':
      extension = 'webp';
      break;
    default:
      extension = 'jpg'; // 默认扩展名
  }

  // 生成唯一文件名
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  const filePath = path.join(uploadDir, filename);

  // 写入文件
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

/**
 * 获取图片的公共URL
 * @param {string} filePath - 图片文件路径
 * @returns {string} 图片的公共URL
 */
function getImageUrl(filePath) {
  // 将文件路径转换为URL路径（替换反斜杠为正斜杠）
  const relativePath = filePath.replace(/\\/g, '/');

  // 检查路径格式
  if (relativePath.startsWith('uploads/')) {
    // 提取模块名称和剩余路径
    // 例如: uploads/chat/images/file.jpg => chat/images/file.jpg
    const pathParts = relativePath.split('/');
    if (pathParts.length >= 3) {
      const module = pathParts[1];
      const remainingPath = pathParts.slice(2).join('/');
      return `/api/images/${module}/${remainingPath}`;
    }
  }

  // 兼容旧格式路径
  return `/api/images/${relativePath}`;
}

module.exports = {
  saveBase64Image,
  getImageUrl
};
