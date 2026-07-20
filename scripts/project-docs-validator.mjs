const fieldValue = (text, label) => text.match(new RegExp(`^- ${label}：(.*)$`, 'm'))?.[1].trim() ?? '';

const sectionValue = (text, label) => {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === `- ${label}：` || line.startsWith(`- ${label}：`));
  if (start < 0) return '';
  const collected = [];
  for (let index = start + 1; index < lines.length && !/^- /.test(lines[index]); index += 1) collected.push(lines[index]);
  return collected.join('\n').trim();
};

export function validateReviewReport(review, reviewPath) {
  const errors = [];
  if (!/^docs\/project-management\/reviews\/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*-round[1-9]\d*\.md$/.test(reviewPath)) {
    errors.push(`獨立審查檔案名稱不符合 YYYY-MM-DD-<slug>-round<N>.md：${reviewPath}`);
  }
  const headings = ['需求完整性', '邏輯正確性', '邊界情況', '程式碼品質', '測試覆蓋', '實際運行結果'];
  headings.forEach((heading, index) => {
    const block = review.match(new RegExp(`## ${index + 1}\\. ${heading}\\n([\\s\\S]*?)(?=\\n## )`))?.[1] ?? '';
    if (!/- 判定：(通過|不通過|部分通過)/.test(block)) errors.push(`${reviewPath}:「${heading}」缺少有效判定`);
    const evidence = block.match(/- 證據：([\s\S]*)/)?.[1].trim() ?? '';
    if (evidence.length < 12) errors.push(`${reviewPath}:「${heading}」缺少具體證據`);
  });
  const summary = review.match(/## 綜合判定\n([\s\S]*?)(?=\n## 審查代理聲明)/)?.[1] ?? '';
  if (!/- 結論：(通過|有條件通過|不通過)/.test(summary)) errors.push(`${reviewPath}: 缺少有效綜合結論`);
  const quote = summary.match(/- 可逐字引用的完整結論句：\*\*(.+)\*\*/)?.[1].trim() ?? '';
  if (quote.length < 20) errors.push(`${reviewPath}: 缺少可逐字引用的完整結論句`);
  if (!/- 阻擋問題（若有）：/.test(summary)) errors.push(`${reviewPath}: 缺少阻擋問題欄位`);
  const declaration = '本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。';
  if (!review.includes(declaration) || !review.includes('若上述聲明不實，本報告無效。')) errors.push(`${reviewPath}: 審查代理聲明不完整`);
  return { errors, quote };
}

export function latestReviewReference(latest) {
  const paths = [...latest.matchAll(/審查檔案：`([^`]+-round(\d+)\.md)`/g)];
  const references = paths.map((match, index) => {
    const end = paths[index + 1]?.index ?? latest.length;
    const block = latest.slice(match.index, end);
    return {
      path: match[1],
      round: Number(match[2]),
      quote: block.match(/判定（逐字引用[^：]*）：\*\*(.+?)\*\*/)?.[1]?.trim() ?? '',
      conditionAccepted: /條件是否已被需求方接受：是/.test(block),
    };
  });
  return references.sort((a, b) => b.round - a.round)[0] ?? null;
}

export function validateLatestEntry(latest, reviewContent) {
  const errors = [];
  if (fieldValue(latest, '狀態') !== '完成') errors.push('08-CHANGE-LOG.md 的最新工作紀錄尚未標示為「完成」');
  const unresolvedLines = latest.split('\n').filter((line) => /^\s*- [^：]+：\s*待執行/.test(line));
  if (unresolvedLines.length) errors.push('08-CHANGE-LOG.md 的最新工作紀錄仍有欄位為「待執行」');
  const confirmationLines = latest.split('\n').filter((line) => /^\s*- [^：]+：\s*待確認(?:\s|[（(：]|$)/.test(line) && !line.startsWith('- 遺留風險與後續事項：'));
  const risk = fieldValue(latest, '遺留風險與後續事項');
  if (confirmationLines.length && !(/待確認/.test(risk) && /影響/.test(risk) && /追蹤/.test(risk))) {
    errors.push('最新工作紀錄有「待確認」欄位，但遺留風險未說明待確認事項、影響與追蹤方式');
  }
  const level = fieldValue(latest, '變更等級');
  const executed = fieldValue(latest, '獨立審查是否執行');
  if (executed.startsWith('是')) {
    const reference = latestReviewReference(latest);
    if (!reference) errors.push('最新工作紀錄已執行獨立審查，但缺少可解析的審查檔案與逐字引用');
    else if (reviewContent) {
      const validated = validateReviewReport(reviewContent, reference.path);
      errors.push(...validated.errors);
      if (reference.quote !== validated.quote) errors.push('工作紀錄的判定不是最新審查報告完整結論句的逐字引用');
      const conclusion = reviewContent.match(/## 綜合判定\n[\s\S]*?- 結論：(通過|有條件通過|不通過)/)?.[1];
      if (conclusion === '不通過') errors.push('最新一輪獨立審查結論為不通過');
      if (conclusion === '有條件通過' && !reference.conditionAccepted) errors.push('最新一輪為有條件通過，但該輪條件未記錄為需求方已接受');
    }
  } else if (executed.startsWith('否')) {
    if (!level.startsWith('低') || !/原因：\S+/.test(executed) || !/需求方同意記錄：\S+/.test(executed)) {
      errors.push('跳過獨立審查只限低風險，且須記錄原因與需求方同意');
    }
  } else errors.push('最新工作紀錄的「獨立審查是否執行」必須為是或否');

  if (level.startsWith('發布')) {
    const auth = sectionValue(latest, '發布授權');
    for (const [label, pattern] of [['是否需要', /^\s*- 是否需要：是/m], ['核准人／角色', /^\s*- 核准人／角色：\S+/m], ['核准時間', /^\s*- 核准時間：\S+/m], ['核准範圍', /^\s*- 核准範圍[^：]*：\S+/m]]) {
      if (!pattern.test(auth) || new RegExp(`${label}[^\\n]*(待確認|待執行)`).test(auth)) errors.push(`發布等級工作缺少有效的「${label}」記錄`);
    }
    const scope = auth.match(/^\s*- 核准範圍[^：]*：(.*)$/m)?.[1] ?? '';
    const normalizedScope = scope.replace(/[\s，。；、,.!！]/g, '');
    if (/(拒絕|不同意|未核准|不接受)/.test(normalizedScope) || !/(同意|核准|接受)/.test(normalizedScope) || !/(打包|發布)/.test(normalizedScope)) {
      errors.push('發布授權範圍必須明確記錄同意／核准／接受打包或發布，不能只記錄需求動作');
    }
    for (const risk of ['未簽章', '未公證', '未實機測試']) {
      if (latest.includes(risk) && (!scope.includes(risk) || /(拒絕|不同意|未核准|不接受)/.test(scope))) errors.push(`發布授權範圍未涵蓋條目揭露的風險「${risk}」`);
    }
  }
  return errors;
}
