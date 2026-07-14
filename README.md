# PNU Event Master

부산대학교 행정직원을 위한 **실시간 능동형 행사 관리 플랫폼**.
행사 현황을 실시간으로 확인하고, 초대장을 발송하고, QR 현장 체크인과 통계 리포트를 한 곳에서 처리합니다.
데이터는 **구글 시트**에 저장되고, 화면은 **GitHub Pages**로 무료 배포됩니다. (별도 서버 불필요)

부산대 공식 색상 적용: 교색 `#005BAA` · 보조색 `#00A651`

---

## 1. 로컬에서 실행 (미리보기)

```bash
npm install
npm run dev
```

`API_URL`을 비워두면 데모 데이터로 바로 동작합니다. 먼저 화면을 확인한 뒤 구글 시트를 연결하세요.

---

## 2. 구글 시트 연결

1. 구글 시트를 새로 만들고 탭 두 개를 만듭니다.
   - **Events** 탭 (1행 헤더, 순서 그대로):
     `id | title | category | date | time | place | host | capacity | invited | opened | yes | no | stage | checkedIn`
     - `date`는 `YYYY-MM-DD`, `stage`는 `0~5` (기획0·초대발송1·회신수집2·준비완료3·진행중4·종료5)
   - **Attendees** 탭 (헤더만): `eventId | name | role | status | timestamp`
2. 시트에서 **확장 프로그램 → Apps Script**를 열고 `google-apps-script/Code.gs` 내용을 전부 붙여넣습니다.
3. **배포 → 새 배포 → 유형: 웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자**
4. 배포 후 나오는 URL(`.../exec`)을 복사해 `src/sheets.js`의 `API_URL`에 붙여넣습니다.

```js
export const SHEETS = {
  API_URL: "https://script.google.com/macros/s/XXXX/exec",
  POLL_MS: 5000,
};
```

이제 앱은 시트에서 행사 데이터를 읽고, 초대·체크인·회신을 시트에 기록하며, `POLL_MS`마다 자동으로 갱신됩니다.

---

## 3. 내 깃허브에 업로드

> 이 저장소를 여러분 계정으로 올리는 과정입니다. 인증은 여러분 컴퓨터에서 이뤄집니다.

1. 깃허브에서 새 저장소를 만듭니다 (예: `pnu-event-master`). README 등은 체크하지 마세요.
2. 이 폴더에서 아래를 실행합니다. `본인아이디`만 바꾸면 됩니다.

```bash
git init
git add .
git commit -m "PNU Event Master 최초 업로드"
git branch -M main
git remote add origin https://github.com/본인아이디/pnu-event-master.git
git push -u origin main
```

> push할 때 사용자명과 **Personal Access Token**(비밀번호 대신)을 물어봅니다.
> 토큰은 깃허브 → Settings → Developer settings → Personal access tokens 에서 발급합니다.

---

## 4. GitHub Pages 자동 배포

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
2. 이후 `main`에 push할 때마다 `.github/workflows/deploy.yml`이 자동으로 빌드·배포합니다.
3. 배포가 끝나면 `https://본인아이디.github.io/pnu-event-master/` 에서 열립니다.

---

## 폴더 구조

```
pnu-event-master/
├─ index.html
├─ package.json
├─ vite.config.js
├─ src/
│  ├─ App.jsx        # 전체 UI (대시보드·행사·QR체크인·리포트·초대장)
│  ├─ sheets.js      # 구글 시트 연동 레이어 (읽기 폴링 + 쓰기)
│  ├─ main.jsx
│  └─ index.css
├─ google-apps-script/
│  └─ Code.gs        # 구글 시트를 API로 바꾸는 백엔드
└─ .github/workflows/
   └─ deploy.yml     # Pages 자동 배포
```

## 참고

- 로고 자리에는 텍스트 워드마크를 넣었습니다. 부산대 독수리·책 엠블럼은 교직원 교육·행정용으로만 배포되는 자산이라 포함하지 않았으니, 필요 시 공식 이미지 파일만 교체하세요.
- 초대장의 실제 이메일/문자 발송은 이 버전에는 포함되어 있지 않습니다(발송 기록만 시트에 남습니다). 실제 발송이 필요하면 Apps Script의 `MailApp.sendEmail` 또는 문자 발송 API(예: 알리고)를 `Code.gs`에 추가하면 됩니다.
