import ReaderApp from './ReaderApp';
import './reader.css';

export const metadata = { title: '착 리더', robots: { index: false, follow: false } };

/** 현장 리더 (R-01 태그 대기 · R-02 결과 · R-03 설정). 안드로이드 + 크롬 + https 전용 */
export default function ReaderPage() {
  return <ReaderApp />;
}
