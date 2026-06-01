export function formatAIResponse(text: string): string {
  if (!text) return text;

  text = text.replace(/(\d+\.\d{3,})%/g, (match) => {
    return parseFloat(match).toFixed(2) + '%';
  });

  text = text.replace(/(\d+\.\d{3,})(\s*%)/g, (match, num, pct) => {
    return parseFloat(num).toFixed(2) + pct;
  });

  text = text.replace(/\b(\d{4,})\b/g, (num) => {
    if (num.startsWith('19') || num.startsWith('20')) return num;
    if (num.includes(',')) return num;
    return Number(num).toLocaleString('en-US');
  });

  const technicalTerms = [
    { from: 'group_by', to: 'grouped by' },
    { from: 'dataset rows', to: 'items' },
    { from: 'records', to: 'items' },
    { from: 'aggregation', to: 'analysis' },
    { from: 'SQL', to: '' },
    { from: 'select', to: '' },
  ];

  for (const term of technicalTerms) {
    text = text.replace(new RegExp(term.from, 'gi'), term.to);
  }

  return text;
}
