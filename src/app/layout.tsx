import type { Metadata } from 'next';
import { Noto_Serif_SC, Inter } from 'next/font/google';
import './globals.css';

const notoSerif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif-cn',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YouTube 字幕翻译助手',
  description:
    '将 YouTube 英文字幕流式翻译为中文对话文章，支持暂停与恢复、本地草稿、历史记录与 TXT/SRT 导出。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${notoSerif.variable} ${inter.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
