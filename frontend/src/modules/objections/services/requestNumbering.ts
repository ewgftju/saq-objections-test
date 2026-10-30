import type { CaseRequest, ObjectionCase } from '../../../types';

/** Системные реквизиты доступны после подписания или фиксации внешнего направления. */
export function requestNumber(c: ObjectionCase, request: CaseRequest): string {
  if (!request.sent) return '';
  if (request.requestNumber) return request.requestNumber;
  const index = c.requests.findIndex(item => item.id === request.id);
  return index < 0 ? '' : `${c.id}/${index + 1}`;
}

export function nextRequestNumber(c: ObjectionCase): string {
  const highest = c.requests.reduce((max, item) => {
    const number = requestNumber(c, item);
    const suffix = number.startsWith(`${c.id}/`) ? Number(number.slice(c.id.length + 1)) : 0;
    return Number.isInteger(suffix) && suffix > max ? suffix : max;
  }, 0);
  return `${c.id}/${highest + 1}`;
}

export function responseDate(request: CaseRequest): string | undefined {
  return request.template === 'other' ? request.responded : request.responseSigned;
}

export function responseNumber(c: ObjectionCase, request: CaseRequest): string {
  if (!responseDate(request)) return '';
  if (request.responseNumber) return request.responseNumber;
  const number = requestNumber(c, request);
  return number ? `${number}-О` : '';
}
