'use client';

import { ArrowRight, Cloud, Download, Play, Save, Zap } from 'lucide-react';
import { useHomeTab } from '@/components/home-tab-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-inner sm:size-12"
      style={{ background: 'var(--gradient-primary)' }}
    >
      {children}
    </div>
  );
}

export function LandingSection() {
  const { goToTranslator } = useHomeTab();

  return (
    <section id="top" className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pb-20">
      <div
        className="pointer-events-none absolute top-20 -left-32 h-72 w-72 rounded-full blur-3xl sm:-left-40 sm:h-96 sm:w-96"
        style={{ background: 'var(--gradient-hero-blob)' }}
      />
      <div
        className="pointer-events-none absolute top-0 -right-32 h-72 w-72 rounded-full blur-3xl sm:-right-40 sm:h-96 sm:w-96"
        style={{ background: 'var(--gradient-hero-blob-2)' }}
      />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Badge
          variant="secondary"
          className="border-border/60 bg-secondary/80 mb-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium sm:mb-8 sm:gap-2 sm:px-4 sm:py-1.5 sm:text-sm"
        >
          <Play className="text-primary size-3.5 sm:size-4" aria-hidden />
          智能字幕翻译工具
        </Badge>

        <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          YouTube 字幕翻译助手
        </h1>

        <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-sm leading-relaxed sm:mt-5 sm:text-base lg:text-lg">
          基于 AI
          大模型，将英文字幕流式翻译为中文对话文章；支持实时预览、暂停与恢复、本地草稿与历史记录，并可一键导出
          TXT / SRT。
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
          <Button
            type="button"
            size="lg"
            className="btn-gradient h-11 gap-2 rounded-xl border-0 px-6 text-base shadow-md sm:h-12 sm:px-8"
            onClick={() => goToTranslator('translator')}
          >
            开始翻译
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 rounded-xl border-2 px-6 text-base sm:h-12 sm:px-8"
            onClick={() => goToTranslator('history')}
          >
            查看历史
          </Button>
        </div>
      </div>

      <div className="container-yt mx-auto mt-14 grid max-w-5xl gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-6">
        <Card className="card-elevated border-border/60 shadow-sm">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:gap-4 sm:pt-8">
            <IconTile>
              <Play className="size-5 sm:size-6" aria-hidden />
            </IconTile>
            <div className="min-w-0 text-left">
              <h2 className="text-foreground text-base font-semibold sm:text-lg">流式翻译</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                译文逐句生成，页面实时更新，无需等待整篇完成。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/60 shadow-sm">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:gap-4 sm:pt-8">
            <IconTile>
              <Zap className="size-5 sm:size-6" aria-hidden />
            </IconTile>
            <div className="min-w-0 text-left">
              <h2 className="text-foreground text-base font-semibold sm:text-lg">智能控制</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                翻译进行中可随时暂停与恢复，或停止当前任务。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/60 shadow-sm sm:col-span-1">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:gap-4 sm:pt-8">
            <IconTile>
              <Save className="size-5 sm:size-6" aria-hidden />
            </IconTile>
            <div className="min-w-0 text-left">
              <h2 className="text-foreground text-base font-semibold sm:text-lg">保存管理</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                自动保存本地草稿，历史记录可回看与再次打开。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="container-yt mx-auto mt-10 max-w-5xl sm:mt-14">
        <div
          className="rounded-2xl border border-transparent px-4 py-8 sm:px-8 sm:py-10"
          style={{
            background:
              'linear-gradient(180deg, oklch(0.97 0.02 280 / 0.5) 0%, oklch(0.96 0.03 220 / 0.4) 100%)',
            boxShadow: '0 1px 0 0 oklch(0.92 0.02 280 / 0.5) inset',
          }}
        >
          <h2 className="text-foreground text-center text-lg font-bold sm:text-xl">更多功能特性</h2>
          <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8">
            <div className="flex gap-4">
              <IconTile>
                <Download className="size-5" aria-hidden />
              </IconTile>
              <div>
                <h3 className="text-foreground font-semibold">多格式导出</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  支持 TXT 纯文本与 SRT 字幕文件一键下载。
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <IconTile>
                <Zap className="size-5" aria-hidden />
              </IconTile>
              <div>
                <h3 className="text-foreground font-semibold">AI 驱动</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  由 Gemini 等大语言模型生成流畅中文表述。
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <IconTile>
                <Play className="size-5" aria-hidden />
              </IconTile>
              <div>
                <h3 className="text-foreground font-semibold">实时预览</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  生成过程即时展示，便于浏览与复制。
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <IconTile>
                <Cloud className="size-5" aria-hidden />
              </IconTile>
              <div>
                <h3 className="text-foreground font-semibold">本地存储</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  草稿与历史保存在本机浏览器，隐私由你掌控。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
