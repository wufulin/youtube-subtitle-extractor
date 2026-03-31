'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HistoryEntry } from '@/lib/storage';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onLoad: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
}

function formatDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function HistoryPanel({ entries, onLoad, onRemove }: HistoryPanelProps) {
  return (
    <Card id="history" className="card-elevated border-border/60 scroll-mt-24">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold sm:text-xl">翻译历史</CardTitle>
        <p className="text-muted-foreground text-sm">
          记录保存在本机浏览器，清除站点数据会一并删除。
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">暂无历史记录</p>
        ) : (
          <ul className="max-h-[min(420px,55vh)] space-y-2 overflow-y-auto pr-1">
            {entries.map((h) => (
              <li
                key={h.id}
                className="border-border/60 bg-muted/30 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">{h.title}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">{h.url}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{formatDate(h.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="default" onClick={() => onLoad(h)}>
                    打开
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => onRemove(h.id)}
                    aria-label="删除"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
