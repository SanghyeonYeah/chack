/** R-02 결과 문구 (기획서 13장 + 결정 B3·D5). 순례 문구는 [추정] */
const WORDS = {
  tour: {
    stamped: '도장 쾅!',
    already: '오늘은 이미 도장을 받았어요',
    completedTitle: '도장 쾅!',
    completedLine: (site) => `${site} 완주!`,
    doneMark: (site) => `${site} 완주 ✔`,
    regionDone: (region) => `${region} 전부 완주!`,
  },
  pilgrim: {
    stamped: '순례 인장을 받았어요',
    already: '오늘은 이미 인장을 받았어요',
    completedTitle: '순례 완료',
    completedLine: (site) => `${site} 순례를 마쳤어요`,
    doneMark: (site) => `${site} 순례 완료 ✔`,
    regionDone: (region) => `${region} 성지 순례 완료!`,
  },
};

/**
 * @param {object} r record_stamp 결과
 * @param {'tour'|'pilgrim'} [service] 결과에 service가 없을 때(오류) 쓸 리더의 웹
 * @returns {{ tone: 'ok'|'done'|'info'|'warn'|'error', title: string, lines: string[], ms: number }}
 */
export function messageFor(r, service = 'tour') {
  const w = WORDS[r.service ?? service] ?? WORDS.tour;
  const progress = r.completed ? w.doneMark(r.site_name) : `${r.site_name} ${r.done ?? 0}/${r.total ?? 0}`;

  switch (r.result) {
    case 'STAMPED':
      return { tone: 'ok', title: w.stamped, lines: [r.checkpoint_name, progress], ms: 2000 };
    case 'COMPLETED': {
      const lines = [r.checkpoint_name, w.completedLine(r.site_name)];
      if (r.points) lines.push(`+${r.points}P`); // 순례 웹은 스위치가 꺼져 있으면 points가 null
      for (const b of r.bonuses ?? []) lines.push(`${w.regionDone(b.region_name)}${b.points ? ` +${b.points}P` : ''}`);
      return { tone: 'done', title: w.completedTitle, lines, ms: 3000 };
    }
    case 'REVISIT':
      return { tone: 'ok', title: '다시 오셨네요!', lines: [`${r.checkpoint_name} 방문을 기록했어요`, progress], ms: 2500 };
    case 'ALREADY_TODAY':
      return { tone: 'info', title: w.already, lines: [r.checkpoint_name], ms: 2000 };
    case 'UNKNOWN_TOKEN':
      return { tone: 'error', title: '등록되지 않은 키링이에요', lines: ['안내소에 문의해 주세요'], ms: 3000 };
    case 'LOST_TOKEN':
      return { tone: 'error', title: '사용이 중지된 키링이에요', lines: ['안내소에 문의해 주세요'], ms: 3000 };
    case 'WRONG_SERVICE':
      return { tone: 'error', title: '이 키링은 여기서 쓸 수 없어요', lines: [], ms: 3000 };
    case 'UNREADABLE':
      return { tone: 'warn', title: '키링을 읽지 못했어요', lines: ['다시 대 주세요'], ms: 2000 };
    default:
      return { tone: 'error', title: '잠시 문제가 생겼어요', lines: ['조금 뒤 다시 시도해 주세요'], ms: 3000 };
  }
}
