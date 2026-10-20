import { Platform, Share } from 'react-native';

export async function downloadText(filename: string, text: string, mime = 'text/csv'): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ message: text, title: filename });
}
