import path from 'node:path';

/** 附件与头像等上传根目录（与 attachments 路由一致） */
export function uploadRoot(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), 'uploads');
}
