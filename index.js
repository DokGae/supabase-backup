#!/usr/bin/env node
const readline = require('readline');
const chalk = require('chalk');
const config = require('./src/services/config');
const CommandRunner = require('./src/utils/commands');

class SupabaseBackupCLI {
  constructor() {
    this.config = config;
    this.commandRunner = new CommandRunner();
    
    // stdin 설정
    process.stdin.setEncoding('utf8');
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  question(text) {
    process.stdout.write(text);
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  async start() {
    console.clear();
    console.log(chalk.blue.bold('=== Supabase 백업 관리자 ===\n'));
    console.log('1. 설정');
    console.log('2. 백업');
    console.log('3. 복원');
    console.log('4. 종료\n');

    const action = await this.question('선택하세요 (1-4): ');

    switch (action.trim()) {
      case '1':
        await this.configureSettings();
        break;
      case '2':
        await this.performBackup();
        break;
      case '3':
        await this.performRestore();
        break;
      case '4':
        console.log(chalk.green('종료합니다.'));
        process.exit(0);
        break;
      default:
        console.log(chalk.red('잘못된 선택입니다.'));
    }

    // 작업 후 다시 메뉴 표시
    await this.start();
  }

  async configureSettings() {
    console.log(chalk.yellow('\n=== 설정 ==='));
    
    const currentConfig = this.config.getAllConfig();
    
    const cloudUrl = await this.question(`Supabase URL (현재: ${currentConfig.cloud?.url || '없음'}): `);
    const cloudPassword = await this.question(`Supabase 비밀번호 (현재: ${currentConfig.cloud?.password ? '설정됨' : '없음'}): `);

    // 설정 저장 (빈 값이면 기존 값 유지)
    this.config.setCloudConfig(
      cloudUrl.trim() || currentConfig.cloud?.url || '',
      cloudPassword.trim() || currentConfig.cloud?.password || ''
    );

    console.log(chalk.green('✓ 클라우드 설정이 저장되었습니다.'));
    console.log(chalk.cyan('📝 로컬 DB 설정은 자동으로 감지됩니다.'));
    
    // 연결 테스트
    await this.testConnections();
  }

  async testConnections() {
    console.log(chalk.yellow('\n연결 테스트 중...'));
    
    try {
      // 로컬 Supabase 자동 감지
      const localSupabase = await CommandRunner.getLocalSupabaseConfig();
      
      if (localSupabase.isRunning) {
        console.log(chalk.green('✓ 로컬 Supabase 감지됨'));
        console.log(chalk.cyan(`  호스트: ${localSupabase.host}:${localSupabase.port}`));
        console.log(chalk.cyan(`  데이터베이스: ${localSupabase.database}`));
      } else {
        console.log(chalk.yellow('⚠ 로컬 Supabase가 실행되지 않음'));
        console.log(chalk.cyan('실행 명령어: npx supabase start'));
      }
    } catch (error) {
      console.log(chalk.red('✗ 로컬 Supabase 확인 실패:', error.message));
    }
  }

  async performBackup() {
    console.log(chalk.yellow('\n=== 백업 ==='));
    console.log('1. 클라우드 백업 (Supabase → 파일)');
    console.log('2. 로컬 백업 (로컬 DB → 파일)');
    
    const backupType = await this.question('백업 타입을 선택하세요 (1-2): ');

    try {
      if (backupType.trim() === '1') {
        await this.backupCloudToLocal();
      } else if (backupType.trim() === '2') {
        await this.backupLocalToCloud();
      } else {
        console.log(chalk.red('잘못된 선택입니다.'));
        return;
      }
    } catch (error) {
      console.log(chalk.red('✗ 백업 실패:', error.message));
    }
  }

  async createBackupFolder() {
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') + '-' +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    
    // Git 해시 가져오기 (없으면 'nogit' 사용)
    let gitHash = 'nogit';
    try {
      const result = await CommandRunner.run('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'pipe'] });
      gitHash = result.stdout.trim();
    } catch (error) {
      // Git이 없거나 git 리포지토리가 아닌 경우
    }
    
    const currentDir = process.cwd();
    return `${currentDir}/supabase/dumps/${timestamp}_${gitHash}`;
  }

  async backupCloudToLocal() {
    console.log(chalk.blue('=== 클라우드 백업 시작 ==='));
    
    // 설정 검증
    const cloudConfig = this.config.getCloudConfig();
    console.log(chalk.cyan('📋 설정 확인 중...'));
    console.log(`URL: ${cloudConfig.url}`);
    console.log(`비밀번호: ${cloudConfig.password ? '설정됨 (' + cloudConfig.password.length + '자)' : '없음'}`);
    
    if (!cloudConfig.url || !cloudConfig.password) {
      console.log(chalk.red('❌ 클라우드 DB 설정이 필요합니다'));
      console.log('1번(설정)에서 Supabase URL과 비밀번호를 입력하세요.');
      throw new Error('클라우드 DB 설정이 필요합니다');
    }
    
    // 필수 도구 확인
    console.log(chalk.cyan('\n🔧 필수 도구 확인 중...'));
    try {
      await CommandRunner.run('npx', ['supabase', '--version'], { showOutput: false });
      console.log(chalk.green('✓ Supabase CLI 사용 가능'));
    } catch (error) {
      console.log(chalk.red('❌ Supabase CLI가 설치되지 않았습니다'));
      console.log('설치 명령어: npm install -g @supabase/supabase-js');
      throw new Error('Supabase CLI가 필요합니다');
    }
    
    // 백업 폴더 생성
    const backupDir = await this.createBackupFolder();
    console.log(chalk.cyan(`\n📁 백업 폴더 생성: ${backupDir}`));
    await CommandRunner.run('mkdir', ['-p', backupDir]);
    
    // URL 처리
    let dbUrl = cloudConfig.url;
    console.log(chalk.cyan('\n🔗 연결 URL 처리 중...'));
    console.log(`원본 URL: ${cloudConfig.url}`);
    
    if (dbUrl.includes('[YOUR-PASSWORD]')) {
      // 비밀번호를 URL 인코딩
      const encodedPassword = encodeURIComponent(cloudConfig.password);
      dbUrl = dbUrl.replace('[YOUR-PASSWORD]', encodedPassword);
      console.log('✓ [YOUR-PASSWORD] 플레이스홀더를 실제 비밀번호로 교체 (URL 인코딩 적용)');
    } else if (!dbUrl.includes(':' + cloudConfig.password + '@') && !dbUrl.includes(':' + encodeURIComponent(cloudConfig.password) + '@')) {
      const encodedPassword = encodeURIComponent(cloudConfig.password);
      dbUrl = dbUrl.replace('postgres.', `postgres:${encodedPassword}@postgres.`);
      console.log('✓ URL에 비밀번호 추가 (URL 인코딩 적용)');
    } else {
      console.log('✓ URL에 이미 비밀번호가 포함됨');
    }
    
    console.log(`처리된 URL: ${dbUrl.replace(encodeURIComponent(cloudConfig.password), '*****').replace(cloudConfig.password, '*****')}`);
    
    try {
      // 환경변수 설정 (특수문자 처리를 위해)
      const env = {
        ...process.env,
        DB_URL: dbUrl,
        SUPABASE_DB_URL: dbUrl
      };
      
      // 1. 역할 백업 (로컬 pg_dumpall 사용)
      console.log(chalk.yellow('\n1/4: 역할 백업 중...'));
      const urlObj = new URL(dbUrl);
      const pgEnv = {
        ...process.env,
        PGPASSWORD: urlObj.password
      };
      
      await CommandRunner.run('pg_dumpall', [
        '-h', urlObj.hostname,
        '-p', urlObj.port || '5432',
        '-U', urlObj.username,
        '--roles-only',
        '-f', `${backupDir}/roles.sql`
      ], { env: pgEnv });
      console.log(chalk.green('✓ 역할 백업 완료'));
      
      // 2. 스키마 백업 (로컬 pg_dump 사용)
      console.log(chalk.yellow('\n2/4: 스키마 백업 중...'));
      await CommandRunner.run('pg_dump', [
        '-h', urlObj.hostname,
        '-p', urlObj.port || '5432',
        '-U', urlObj.username,
        '-d', urlObj.pathname.slice(1), // '/' 제거
        '--schema-only',
        '-f', `${backupDir}/schema.sql`
      ], { env: pgEnv });
      console.log(chalk.green('✓ 스키마 백업 완료'));
      
      // 3. 데이터 백업 (로컬 pg_dump 사용)
      console.log(chalk.yellow('\n3/4: 데이터 백업 중...'));
      console.log(chalk.cyan('  ⏳ 대용량 데이터의 경우 시간이 오래 걸릴 수 있습니다...'));
      await CommandRunner.run('pg_dump', [
        '-h', urlObj.hostname,
        '-p', urlObj.port || '5432',
        '-U', urlObj.username,
        '-d', urlObj.pathname.slice(1), // '/' 제거
        '--data-only',
        '-f', `${backupDir}/data.sql`
      ], { env: pgEnv });
      console.log(chalk.green('✓ 데이터 백업 완료'));
      
      // 4. Storage 정책 백업 (로컬 pg_dump 사용)
      console.log(chalk.yellow('\n4/4: Storage 정책 백업 중...'));
      await CommandRunner.run('pg_dump', [
        '-h', urlObj.hostname,
        '-p', urlObj.port || '5432',
        '-U', urlObj.username,
        '-d', urlObj.pathname.slice(1), // '/' 제거
        '--schema=storage',
        '-f', `${backupDir}/storage-policies.sql`
      ], { env: pgEnv });
      console.log(chalk.green('✓ Storage 정책 백업 완료'));
      
      console.log(chalk.green(`\n🎉 클라우드 백업 완료: ${backupDir}`));
    } catch (error) {
      console.log(chalk.red(`\n❌ 백업 중 오류: ${error.message}`));
      throw error;
    }
  }

  async backupLocalToCloud() {
    console.log(chalk.blue('=== 로컬 백업 시작 ==='));
    
    // 로컬 Supabase 자동 감지
    const localSupabase = await CommandRunner.getLocalSupabaseConfig();
    
    if (!localSupabase.isRunning) {
      console.log(chalk.red('❌ 로컬 Supabase가 실행되지 않음'));
      console.log(chalk.cyan('실행 명령어: npx supabase start'));
      throw new Error('로컬 Supabase가 실행되지 않음');
    }
    
    console.log(chalk.cyan('📋 로컬 Supabase 확인됨'));
    console.log(`호스트: ${localSupabase.host}:${localSupabase.port}`);
    console.log(`사용자: ${localSupabase.user}`);
    console.log(`데이터베이스: ${localSupabase.database}`);
    
    // 필수 도구 확인
    console.log(chalk.cyan('\n🔧 필수 도구 확인 중...'));
    try {
      const pgDumpCheck = await CommandRunner.run('pg_dump', ['--version'], { showOutput: false });
      console.log(chalk.green('✓ pg_dump 사용 가능'));
    } catch (error) {
      console.log(chalk.red('❌ PostgreSQL 클라이언트 도구가 설치되지 않았습니다'));
      console.log('설치 명령어: sudo apt-get install postgresql-client');
      throw new Error('PostgreSQL 클라이언트 도구가 필요합니다');
    }
    
    // 연결은 이미 확인됨 (로컬 Supabase가 실행 중)
    
    // 백업 폴더 생성 (로컬 백업은 _local 접미사)
    const backupDir = (await this.createBackupFolder()) + '_local';
    console.log(chalk.cyan(`\n📁 백업 폴더 생성: ${backupDir}`));
    await CommandRunner.run('mkdir', ['-p', backupDir]);
    
    try {
      // 환경변수 설정
      const env = {
        ...process.env,
        PGPASSWORD: localSupabase.password
      };
      
      // 1. 역할 백업
      console.log(chalk.yellow('\n1/4: 역할 백업 중...'));
      await CommandRunner.run('pg_dump', [
        '-h', localSupabase.host,
        '-p', localSupabase.port.toString(),
        '-U', localSupabase.user,
        '-d', localSupabase.database,
        '--roles-only',
        '-f', `${backupDir}/roles.sql`
      ], { env });
      console.log(chalk.green('✓ 역할 백업 완료'));
      
      // 2. 스키마 백업
      console.log(chalk.yellow('\n2/4: 스키마 백업 중...'));
      await CommandRunner.run('pg_dump', [
        '-h', localSupabase.host,
        '-p', localSupabase.port.toString(),
        '-U', localSupabase.user,
        '-d', localSupabase.database,
        '--schema-only',
        '-f', `${backupDir}/schema.sql`
      ], { env });
      console.log(chalk.green('✓ 스키마 백업 완료'));
      
      // 3. 데이터 백업
      console.log(chalk.yellow('\n3/4: 데이터 백업 중...'));
      await CommandRunner.run('pg_dump', [
        '-h', localSupabase.host,
        '-p', localSupabase.port.toString(),
        '-U', localSupabase.user,
        '-d', localSupabase.database,
        '--data-only',
        '-f', `${backupDir}/data.sql`
      ], { env });
      console.log(chalk.green('✓ 데이터 백업 완료'));
      
      // 4. Storage 스키마 백업
      console.log(chalk.yellow('\n4/4: Storage 정책 백업 중...'));
      await CommandRunner.run('pg_dump', [
        '-h', localSupabase.host,
        '-p', localSupabase.port.toString(),
        '-U', localSupabase.user,
        '-d', localSupabase.database,
        '--schema', 'storage',
        '-f', `${backupDir}/storage-policies.sql`
      ], { env });
      console.log(chalk.green('✓ Storage 정책 백업 완료'));
      
      console.log(chalk.green(`\n🎉 로컬 백업 완료: ${backupDir}`));
    } catch (error) {
      console.log(chalk.red(`\n❌ 백업 중 오류: ${error.message}`));
      throw error;
    }
  }

  async performRestore() {
    console.log(chalk.yellow('\n=== 복원 ==='));
    console.log('1. 로컬 DB로 복원 (백업 파일 → 로컬 DB)');
    console.log('2. 클라우드 DB로 복원 (백업 파일 → 클라우드 DB)');
    
    const target = await this.question('복원 대상을 선택하세요 (1-2): ');
    
    if (!['1', '2'].includes(target.trim())) {
      console.log(chalk.red('잘못된 선택입니다.'));
      return;
    }
    
    // 백업 폴더 목록 표시
    const folders = await this.listBackupFolders();
    
    if (folders.length === 0) {
      console.log(chalk.red('복원할 백업이 없습니다.'));
      return;
    }
    
    const selection = await this.question('복원할 백업을 선택하세요 (번호 입력): ');
    const selectedIndex = parseInt(selection.trim()) - 1;
    
    if (selectedIndex < 0 || selectedIndex >= folders.length) {
      console.log(chalk.red('잘못된 선택입니다.'));
      return;
    }
    
    const backupPath = folders[selectedIndex];
    
    console.log('\n복원 옵션:');
    console.log('1. 역할만 복원');
    console.log('2. 스키마만 복원 (IF NOT EXISTS 사용)');
    console.log('3. 데이터만 복원 (충돌 시 건너뛰기)');
    console.log('4. Storage 정책만 복원');
    console.log('5. 모든 항목 복원 (충돌 방지 포함)');
    
    const option = await this.question('복원 옵션을 선택하세요 (1-5): ');
    
    try {
      if (target.trim() === '1') {
        await this.restoreToLocal(backupPath.trim(), option.trim());
      } else if (target.trim() === '2') {
        await this.restoreToCloud(backupPath.trim(), option.trim());
      } else {
        console.log(chalk.red('잘못된 선택입니다.'));
        return;
      }
    } catch (error) {
      console.log(chalk.red('✗ 복원 실패:', error.message));
    }
  }

  async listBackupFolders() {
    try {
      const currentDir = process.cwd();
      const dumpsPath = `${currentDir}/supabase/dumps`;
      const result = await CommandRunner.run('find', [dumpsPath, '-type', 'd', '-name', '*_*'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const folders = result.stdout.split('\n').filter(f => f.trim());
      
      if (folders.length === 0) {
        console.log('백업 폴더가 없습니다.');
        return [];
      }
      
      console.log(chalk.cyan('\n사용 가능한 백업 폴더:'));
      folders.forEach((folder, index) => {
        const isLocal = folder.includes('_local');
        const type = isLocal ? '[로컬]' : '[클라우드]';
        console.log(`${index + 1}. ${type} ${folder}`);
      });
      console.log();
      return folders;
    } catch (error) {
      console.log('백업 폴더 목록을 가져올 수 없습니다.');
      return [];
    }
  }

  async restoreToLocal(backupPath, option) {
    // 로컬 Supabase 자동 감지
    const localSupabase = await CommandRunner.getLocalSupabaseConfig();
    
    if (!localSupabase.isRunning) {
      console.log(chalk.red('❌ 로컬 Supabase가 실행되지 않음'));
      console.log(chalk.cyan('실행 명령어: npx supabase start'));
      throw new Error('로컬 Supabase가 실행되지 않음');
    }
    
    const env = {
      ...process.env,
      PGPASSWORD: localSupabase.password
    };
    
    console.log(chalk.cyan(`로컬 Supabase (${localSupabase.host}:${localSupabase.port})에 복원 중...`));
    
    switch (option) {
      case '1': // 역할만
        console.log('역할 복원 중...');
        await CommandRunner.run('psql', [
          '-h', localSupabase.host,
          '-p', localSupabase.port.toString(),
          '-U', localSupabase.user,
          '-d', localSupabase.database,
          '-f', `${backupPath}/roles.sql`
        ], { env });
        break;
        
      case '2': // 스키마만
        console.log('스키마 복원 중...');
        await CommandRunner.run('psql', [
          '-h', localSupabase.host,
          '-p', localSupabase.port.toString(),
          '-U', localSupabase.user,
          '-d', localSupabase.database,
          '-f', `${backupPath}/schema.sql`
        ], { env });
        break;
        
      case '3': // 데이터만
        console.log('데이터 복원 중...');
        await CommandRunner.run('psql', [
          '-h', localSupabase.host,
          '-p', localSupabase.port.toString(),
          '-U', localSupabase.user,
          '-d', localSupabase.database,
          '-f', `${backupPath}/data.sql`
        ], { env });
        break;
        
      case '4': // Storage 정책만
        console.log('Storage 정책 복원 중...');
        await CommandRunner.run('psql', [
          '-h', localSupabase.host,
          '-p', localSupabase.port.toString(),
          '-U', localSupabase.user,
          '-d', localSupabase.database,
          '-f', `${backupPath}/storage-policies.sql`
        ], { env });
        break;
        
      case '5': // 모든 항목
        console.log('모든 항목 복원 중...');
        const files = ['roles.sql', 'schema.sql', 'data.sql', 'storage-policies.sql'];
        for (const file of files) {
          console.log(`${file} 복원 중...`);
          try {
            await CommandRunner.run('psql', [
              '-h', localSupabase.host,
              '-p', localSupabase.port.toString(),
              '-U', localSupabase.user,
              '-d', localSupabase.database,
              '-f', `${backupPath}/${file}`
            ], { env });
          } catch (error) {
            console.log(chalk.yellow(`${file} 복원 중 오류 (계속 진행): ${error.message}`));
          }
        }
        break;
        
      default:
        throw new Error('잘못된 복원 옵션입니다.');
    }
    
    console.log(chalk.green(`\n🎉 로컬 DB 복원 완료: ${backupPath}`));
  }

  async restoreToCloud(backupPath, option) {
    const cloudConfig = this.config.getCloudConfig();
    
    if (!cloudConfig.url || !cloudConfig.password) {
      throw new Error('클라우드 DB 설정이 필요합니다');
    }
    
    // URL에서 [YOUR-PASSWORD] 부분을 실제 비밀번호로 교체
    let dbUrl = cloudConfig.url;
    if (dbUrl.includes('[YOUR-PASSWORD]')) {
      dbUrl = dbUrl.replace('[YOUR-PASSWORD]', cloudConfig.password);
    } else if (!dbUrl.includes(':' + cloudConfig.password + '@')) {
      // 비밀번호가 URL에 없으면 추가
      dbUrl = dbUrl.replace('postgres.', `postgres:${cloudConfig.password}@postgres.`);
    }
    
    console.log('클라우드 DB에 복원 중...');
    
    switch (option) {
      case '1': // 역할만
        console.log('역할 복원 중...');
        await CommandRunner.run('psql', [dbUrl, '-f', `${backupPath}/roles.sql`]);
        break;
        
      case '2': // 스키마만
        console.log('스키마 복원 중...');
        await CommandRunner.run('psql', [dbUrl, '-f', `${backupPath}/schema.sql`]);
        break;
        
      case '3': // 데이터만
        console.log('데이터 복원 중...');
        await CommandRunner.run('psql', [dbUrl, '-f', `${backupPath}/data.sql`]);
        break;
        
      case '4': // Storage 정책만
        console.log('Storage 정책 복원 중...');
        await CommandRunner.run('psql', [dbUrl, '-f', `${backupPath}/storage-policies.sql`]);
        break;
        
      case '5': // 모든 항목
        console.log('모든 항목 복원 중...');
        const files = ['roles.sql', 'schema.sql', 'data.sql', 'storage-policies.sql'];
        for (const file of files) {
          console.log(`${file} 복원 중...`);
          try {
            await CommandRunner.run('psql', [dbUrl, '-f', `${backupPath}/${file}`]);
          } catch (error) {
            console.log(chalk.yellow(`${file} 복원 중 오류 (계속 진행): ${error.message}`));
          }
        }
        break;
        
      default:
        throw new Error('잘못된 복원 옵션입니다.');
    }
    
    console.log(chalk.green(`\n🎉 클라우드 DB 복원 완료: ${backupPath}`));
  }
}

// 애플리케이션 시작
const app = new SupabaseBackupCLI();
app.start().catch(console.error);