import { SERVICE_LABEL } from "@/lib/service";

const TOKENS = ["bg", "surface", "ink", "muted", "primary", "accent", "line", "success", "error", "stamp"];

/** DESIGN.md 시안 미리보기. 피드백용이며 실제 화면이 아님 */
export default async function DesignPreview({ params }) {
  const { service } = await params;
  return (
    <main className="mx-auto max-w-[480px] px-5 py-10 pb-28">
      <p className="text-muted">디자인 시안 v0.1 · {SERVICE_LABEL[service].name}</p>
      <h1 className="mt-1 font-serif text-[28px] font-bold">색 · 글꼴 · 부품</h1>

      <section className="mt-8 grid grid-cols-2 gap-3">
        {TOKENS.map((t) => (
          <div key={t} className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-lg border border-line" style={{ background: `var(--c-${t})` }} />
            <span className="text-[16px]">{t}</span>
          </div>
        ))}
      </section>

      <section className="mt-10 space-y-2">
        <p className="font-serif text-[32px] font-bold leading-tight">현충사 · 제목 32</p>
        <p className="font-serif text-[24px] font-semibold">본전 · 소제목 24</p>
        <p className="text-[17px]">본문 17px. 키링을 대면 그날의 기록이 다시 열립니다.</p>
        <p className="text-[16px] text-muted">보조 16px (최소 크기)</p>
      </section>

      <section className="mt-10 flex flex-col gap-3">
        <button className="btn btn-primary">가볼게요</button>
        <button className="btn btn-secondary">나중에 갈게요</button>
      </section>

      <section className="card mt-10">
        <div className="flex items-center justify-between">
          <p className="font-serif text-[22px] font-semibold">현충사</p>
          <p className="text-muted">3 / 5</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-line">
          <div className="h-full w-3/5 rounded-full bg-primary" />
        </div>
        <p className="mt-4 text-[16px] text-muted">10/31</p>
        <ul className="mt-1 space-y-1">
          <li>① 홍살문 · 10:12</li>
          <li>② 본전 · 10:40</li>
        </ul>
      </section>

      <section className="mt-10 flex justify-center">
        <div className="flex h-36 w-36 rotate-[-8deg] flex-col items-center justify-center rounded-full border-[5px] border-stamp text-stamp">
          <span className="font-serif text-[26px] font-bold">착</span>
          <span className="text-[16px] font-semibold">본전</span>
        </div>
      </section>

      {/* 사진 업로드 진행 오버레이 예시 (D1) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface px-5 py-4">
        <div className="mx-auto max-w-[480px]">
          <p className="text-[16px]">사진 올리는 중 · 2 / 3</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full w-2/3 bg-accent" />
          </div>
        </div>
      </div>
    </main>
  );
}
