# Supabase Backup CLI

글로벌 Supabase 백업 및 복원 CLI 도구

## 설치

```bash
npm install -g git+https://github.com/username/supabase-backup-cli.git
```

## 사용법

어떤 프로젝트 폴더에서든 사용 가능합니다:

```bash
# 메인 명령어
supabase-backup

# 짧은 명령어
sb-backup
```

현재 디렉토리에 `supabase/dumps/` 폴더가 생성되어 백업 파일과 설정 파일(`backup-config.json`)이 함께 저장됩니다.

## 기능

- ✅ **클라우드 백업**: Supabase → 로컬 파일 (Supabase CLI 사용)
- ✅ **로컬 백업**: 로컬 Supabase → 파일 (자동 감지)
- ✅ **복원**: 백업 파일 → 로컬/클라우드 DB
- ✅ **자동 폴더 생성**: `현재디렉토리/supabase/dumps/`
- ✅ **Git 해시 기반 폴더명**: `20250612-193331_abc123`

## 요구사항

- Node.js 14+
- Supabase CLI (`npx supabase`)
- PostgreSQL 클라이언트 도구 (로컬 백업용)

## 프로젝트 설정

각 프로젝트에서 첫 사용 시 `.gitignore`에 다음을 추가하세요:

```
# Supabase 백업 설정 (비밀번호 포함)
supabase/dumps/backup-config.json
```

## 사용법

### 키보드 단축키
- `Tab` / `Shift+Tab`: 탭 전환
- `↑` / `↓`: 항목 이동
- `Enter`: 선택/실행
- `Space`: 체크박스/라디오 버튼 토글
- `q`: 애플리케이션 종료
- `r`: 백업 목록 새로고침 (백업/복원 탭)
- `s`: 빠른 백업 시작 (백업 탭)

### 1. 설정 탭
1. 클라우드 DB URL과 패스워드 입력
2. 로컬 DB 연결 정보 입력  
3. 백업 저장 경로 설정
4. 연결 테스트 실행
5. 설정 저장

### 2. 백업 탭
1. 백업 대상 선택 (클라우드/로컬)
2. "백업 시작" 버튼 클릭
3. 진행률과 로그 모니터링
4. 완료 후 백업 목록에서 확인

### 3. 복원 탭
1. 백업 목록에서 복원할 백업 선택
2. 복원 옵션 선택 (역할, 스키마, 데이터, Storage)
3. 복원 대상 선택 (클라우드/로컬)
4. 복원 방식 선택:
   - **전체 복원**: 선택한 모든 옵션 복원
   - **개별 복원**: 역할만, 스키마만, 데이터만, Storage만
5. 진행률과 로그 모니터링

## 백업 파일 구조

```
./supabase/dumps/
├── 20241206_143022_a1b2c3d/          # 클라우드 백업
│   ├── roles.sql
│   ├── schema.sql  
│   ├── data.sql
│   └── storage-policies.sql
└── 20241206_143022_a1b2c3d_local/    # 로컬 백업
    ├── roles.sql
    ├── schema.sql
    ├── data.sql
    └── storage-policies.sql
```

## 설정 파일

설정은 `~/.supabase-backup-tui/config.json`에 자동 저장됩니다.

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

### 명령어를 찾을 수 없음
- PostgreSQL 클라이언트 도구 설치: `sudo apt install postgresql-client`
- Supabase CLI는 npx로 자동 설치됩니다

### 연결 실패
- 클라우드 DB: URL과 패스워드 형식 확인
- 로컬 DB: PostgreSQL 서버 실행 상태 및 인증 설정 확인

### 권한 오류
- 백업 디렉토리 생성 권한 확인
- PostgreSQL 사용자 권한 확인

## 라이선스

MIT License