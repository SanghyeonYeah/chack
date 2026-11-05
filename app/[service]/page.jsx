import { SERVICE_LABEL } from '@/lib/service';

/** 임시 첫 화면. 실제 홈(T-U-01 / P-U-01)은 2·4단계에서 교체 */
export default async function Home({ params }) {
  const { service } = await params;
  const label = SERVICE_LABEL[service];
  return (
    <main className="mx-auto max-w-[480px] px-5 py-12">
      <p className="text-muted">CHAK · 1단계 확인용</p>
      <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight">{label.name}</h1>
      <p className="mt-4">
        이 화면이 보이면 접속 주소로 <b>{label.short} 웹</b>이 정상 판별된 것입니다.
      </p>
      <div className="card mt-8">
        <p className="font-semibold">확인할 것</p>
        <ul className="mt-2 list-disc pl-5 text-muted">
          <li>현장 리더: /reader</li>
          <li>디자인 시안: /design</li>
          <li>서버·DB 연결: /api/health</li>
        </ul>
      </div>
      <a href="/reader" className="btn btn-primary mt-8 w-full">현장 리더 열기</a>
      <a href="/design" className="btn btn-secondary mt-3 w-full">디자인 시안 보기</a>
    </main>
  );
}
