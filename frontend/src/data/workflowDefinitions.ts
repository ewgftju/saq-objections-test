export const STEPS = [
  ["received", "Приём"],
  ["accepted", "Формирование запроса в ДВГА/КВГА и др"],
  ["materials", "Анализ обращения"],
  ["commission_voting", "Заседание"],
  ["meeting", "Решение"],
  ["delivered", "Исполнение"],
] as const;
export const CONTROL_STEPS = STEPS;
