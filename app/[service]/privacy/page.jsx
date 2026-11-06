// 개인정보 안내 (14장, 문구 [확인 필요] → 기획서 예시 기준 초안)
import Shell from '@/components/user/Shell';

export default function PrivacyPage() {
  return (
    <Shell back={{ href: '/', label: '처음으로' }}>
      <h1 className="title">개인정보 안내</h1>
      <div className="mt-6 space-y-5">
        <section className="card">
          <p className="font-semibold">받지 않는 정보</p>
          <p className="mt-2">착은 이름 · 전화번호 · 이메일 같은 개인정보를 받지 않아요. 키링 코드가 곧 내 기록의 열쇠예요.</p>
        </section>
        <section className="card">
          <p className="font-semibold">저장하는 정보</p>
          <p className="mt-2">키링 코드에 방문 기록(지점 · 시각), 직접 올린 사진, 메모, 포인트, 뱃지가 저장돼요. 사진과 메모는 키링을 가진 사람만 보고 지울 수 있어요. 순례 사진과 메모는 관리자도 볼 수 없어요.</p>
        </section>
        <section className="card">
          <p className="font-semibold">위치 정보</p>
          <p className="mt-2">위치 권한을 허용하면 거리와 내 위치를 화면에 보여 주는 데만 써요. 위치는 서버로 보내거나 저장하지 않아요.</p>
        </section>
        <section className="card">
          <p className="font-semibold">이 폰에 저장되는 정보</p>
          <p className="mt-2">이 폰에서 쓴 키링 코드(최대 5개)와 고른 지역이 브라우저에 저장돼요. 내 정보 화면에서 키링 연결을 해제할 수 있어요.</p>
        </section>
      </div>
    </Shell>
  );
}
