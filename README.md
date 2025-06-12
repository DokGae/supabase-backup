# Supabase Backup Manager

GUI 기반 Supabase 데이터베이스 백업 및 복원 도구

## 특징

- ✨ **직관적인 GUI**: 터미널 기반 사용자 인터페이스
- 🔄 **양방향 백업**: 클라우드 ↔ 로컬 Supabase 백업/복원
- 📁 **자동 폴더 관리**: Git 해시 기반 백업 폴더 생성
- 🔧 **선택적 복원**: 역할, 스키마, 데이터, Storage 개별 선택
- 💾 **설정 저장**: 데이터베이스 연결 정보 자동 저장
- 📊 **실시간 모니터링**: 진행률 표시 및 로그 확인

## 요구사항

- Node.js 14+
- PostgreSQL 클라이언트 도구 (`pg_dump`, `pg_restore`)
- Docker (클라우드 백업용)

## 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/username/supabase-backup-manager.git
cd supabase-backup-manager

# 의존성 설치
npm install

# 앱 실행
npm start
```

## 사용법

### 1. 앱 실행 후 설정

앱을 실행하면 GUI 화면이 나타납니다:

1. **Settings 탭**에서 데이터베이스 연결 정보 설정
   - Cloud Database: Supabase 클라우드 DB URL 및 패스워드
   - Local Database: 로컬 PostgreSQL 연결 정보
   - Backup Directory: 백업 파일 저장 경로

2. **Test Connection**으로 연결 테스트

3. **Save Settings**로 설정 저장

### 2. 백업 생성

1. **Backup 탭** 선택
2. 백업 대상 선택:
   - **Cloud to Local**: Supabase 클라우드 → 로컬 파일
   - **Local to Local**: 로컬 PostgreSQL → 로컬 파일
3. **Start Backup** 버튼 클릭
4. 진행률과 로그 모니터링

### 3. 백업 복원

1. **Restore 탭** 선택
2. 백업 목록에서 복원할 백업 선택
3. 복원 옵션 선택:
   - **Roles**: 사용자 역할 및 권한
   - **Schema**: 테이블 구조 및 스키마
   - **Data**: 실제 데이터
   - **Storage**: Storage 정책
4. 복원 대상 선택:
   - **To Local**: 로컬 PostgreSQL로 복원
   - **To Cloud**: Supabase 클라우드로 복원
5. **Start Restore** 버튼 클릭

## 키보드 단축키

- `Tab` / `Shift+Tab`: 탭 전환
- `↑` / `↓`: 항목 이동
- `Enter`: 선택/실행
- `Space`: 체크박스 토글
- `r`: 백업 목록 새로고침
- `s`: 빠른 백업 시작 (백업 탭에서)
- `q`: 앱 종료

## 백업 파일 구조

백업은 `supabase/dumps/` 폴더에 타임스탬프와 Git 해시로 구성된 폴더명으로 저장됩니다:

```
./supabase/dumps/
├── 20241212-143022_abc123d/     # 클라우드 백업
│   ├── roles.sql                # 사용자 역할 및 권한
│   ├── schema.sql               # 테이블 구조
│   ├── data.sql                 # 데이터
│   └── storage-policies.sql     # Storage 정책
└── 20241212-143022_abc123d_local/  # 로컬 백업
    ├── roles.sql
    ├── schema.sql
    ├── data.sql
    └── storage-policies.sql
```

## 설정 파일

설정은 현재 프로젝트의 `supabase/dumps/backup-config.json`에 저장됩니다:

```json
{
  "cloud": {
    "url": "postgresql://postgres.xxx:password@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres",
    "password": "your-password"
  },
  "local": {
    "host": "localhost",
    "port": 5432,
    "user": "postgres", 
    "database": "postgres",
    "password": "your-password"
  },
  "backup": {
    "dumpDir": "./supabase/dumps"
  }
}
```

## 문제 해결

### PostgreSQL 클라이언트 도구 설치

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-client
```

**macOS:**
```bash
brew install postgresql
```

**Windows:**
PostgreSQL 공식 사이트에서 설치

### Docker 설치 확인

클라우드 백업을 위해서는 Docker가 필요합니다:
```bash
docker --version
```

### 연결 오류 해결

1. **클라우드 DB 연결 실패**:
   - Supabase 대시보드에서 URL 형식 확인
   - 패스워드 정확성 확인
   - 네트워크 연결 상태 확인

2. **로컬 DB 연결 실패**:
   - PostgreSQL 서버 실행 상태 확인
   - `pg_hba.conf` 인증 설정 확인
   - 포트 및 사용자명 확인

### 권한 오류

- 백업 디렉토리 생성 권한 확인
- PostgreSQL 사용자 권한 확인

## 개발

```bash
# 개발 모드 실행
npm run dev

# 코드 포맷팅
npm run format  # (사용 가능한 경우)
```

## 라이선스

MIT License