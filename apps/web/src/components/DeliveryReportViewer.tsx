import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Download, ExternalLink, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface DeliveryReportViewerProps {
  reportMarkdown: string;
  pullRequestUrl?: string | null;
  cardId: string;
}

export const DeliveryReportViewer: React.FC<DeliveryReportViewerProps> = ({
  reportMarkdown,
  pullRequestUrl,
  cardId,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Extrai resumo do relatório
  const extractSummary = () => {
    const match = reportMarkdown.match(/## 📌 Resumo do que foi Implementado\n([\s\S]*?)(##|$)/);
    return match ? match[1].trim() : reportMarkdown;
  };

  // Extrai lista de tasks para o Kanbanize
  const extractKanbanizeTasks = () => {
    const match = reportMarkdown.match(/## 📋 Tasks para o Kanbanize \/ Businessmap\n([\s\S]*?)(##|$)/);
    return match ? match[1].trim() : '';
  };

  // Baixar arquivo .md
  const downloadMarkdown = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_entrega_card_${cardId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 shadow-lg">
      <CardHeader className="border-b border-emerald-500/20 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg text-emerald-900 dark:text-emerald-200">
                Relatório de Entrega da Squad
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Demanda finalizada com sucesso. Copie as informações em 1 clique abaixo.
              </p>
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(reportMarkdown, 'all')}
              className="text-xs"
            >
              {copiedType === 'all' ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedType === 'all' ? 'Copiado!' : 'Copiar Tudo'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(extractSummary(), 'summary')}
              className="text-xs"
            >
              {copiedType === 'summary' ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedType === 'summary' ? 'Copiado!' : 'Copiar Resumo'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(extractKanbanizeTasks(), 'tasks')}
              className="text-xs text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"
            >
              {copiedType === 'tasks' ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedType === 'tasks' ? 'Copiado!' : 'Copiar Tasks Kanbanize'}
            </Button>

            <Button size="sm" variant="outline" onClick={downloadMarkdown} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1" /> .md
            </Button>

            {pullRequestUrl && (
              <a href={pullRequestUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="cyan" className="text-xs">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver PR
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="prose dark:prose-invert max-w-none text-sm space-y-4">
          <ReactMarkdown>{reportMarkdown}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
};
