import { stat } from 'fs/promises';
import { PathUtils } from '../core/path-utils.js';

const loggedPaths = new Set<string>();

/**
 * One "does not exist" rule shared by the registry and the durable list (design C6).
 */
export async function isPathMissing(hostPath: string): Promise<boolean> {
  let translatedPath: string;
  try {
    translatedPath = PathUtils.translatePath(hostPath);
  } catch {
    return false;
  }

  try {
    await stat(translatedPath);
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return true;
    }

    if (!loggedPaths.has(translatedPath)) {
      loggedPaths.add(translatedPath);
      console.error(`Could not determine whether path exists: ${translatedPath}`, error);
    }
    return false;
  }
}
