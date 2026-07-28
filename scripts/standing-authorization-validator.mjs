export function validateStandingAuthorization(content) {
  const errors = [];
  for (const marker of ['AUTH-2026-07-23-01', '狀態：有效', 'Windows Authenticode 未簽章', 'macOS 未經 Apple Developer ID 簽章／公證', '未完成實機測試', 'checksum 不一致', '不代表現在立即發布', '撤銷方式']) {
    if (!content.includes(marker)) errors.push(`常設授權缺少必要界線「${marker}」`);
  }
  if (!/核准範圍：同意未來版本/.test(content)) errors.push('常設授權未明確限制為未來版本的簽章／公證風險接受');
  if (!/明確排除：.*未完成實機測試/.test(content)) errors.push('常設授權未排除未完成實機測試');
  if (!/發布操作：.*不代表現在立即發布/.test(content)) errors.push('常設風險接受未與實際發布操作區分');
  if (!/狀態：有效，直到需求提出者／產品負責人明確撤銷或限縮/.test(content)) errors.push('常設授權狀態未明示可由需求方撤銷或限縮');
  if (!/撤銷方式：需求提出者／產品負責人以新指示明確撤銷或限縮/.test(content)) errors.push('撤銷方式未明示需求方可撤銷或限縮');
  if (!/以新條目附加記錄，不刪除本歷史授權/.test(content)) errors.push('撤銷或限縮未要求以新條目保留歷史');
  if (/永久有效|不得撤銷|不可撤銷|不得限縮/.test(content)) errors.push('常設授權不得宣告為永久或不可撤銷／限縮');
  return errors;
}
