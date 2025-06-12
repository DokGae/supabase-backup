const { spawn } = require('child_process');
const chalk = require('chalk');

class CommandRunner {
  static async run(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`\n실행 중: ${command} ${args.join(' ')}`);
      
      const childProcess = spawn(command, args, {
        stdio: options.stdio || ['inherit', 'pipe', 'pipe'],
        env: options.env || process.env,
        cwd: options.cwd || process.cwd()
      });

      let stdout = '';
      let stderr = '';

      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          
          // 실시간 출력 표시 (기본적으로 활성화)
          if (options.showOutput !== false) {
            process.stdout.write(output);
          }
          
          if (options.onStdout) {
            options.onStdout(output);
          }
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          
          // 에러도 실시간으로 표시
          if (options.showOutput !== false) {
            process.stderr.write(output);
          }
          
          if (options.onStderr) {
            options.onStderr(output);
          }
        });
      }

      childProcess.on('close', (code) => {
        if (options.showOutput !== false) {
          if (code === 0) {
            console.log(chalk.green(`\n명령어 완료 (종료 코드: ${code})`));
          } else {
            console.log(chalk.red(`\n명령어 실패 (종료 코드: ${code})`));
          }
        }
        
        if (code === 0) {
          resolve({
            code,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        } else {
          const errorMsg = `명령어 실행 실패: ${command} ${args.join(' ')}\n종료 코드: ${code}\n에러: ${stderr}`;
          if (options.showOutput !== false) {
            console.error(chalk.red(errorMsg));
          }
          reject(new Error(errorMsg));
        }
      });

      childProcess.on('error', (error) => {
        console.error(`명령어 실행 오류: ${error.message}`);
        reject(new Error(`Failed to start command "${command}": ${error.message}`));
      });

      // 프로세스 킬 기능을 위해 프로세스 객체 반환
      if (options.returnProcess) {
        resolve(childProcess);
      }
    });
  }

  // Supabase CLI 명령어 실행
  static async runSupabase(args, options = {}) {
    return this.run('npx', ['supabase', ...args], options);
  }

  // PostgreSQL 명령어 실행 (pg_dump, psql)
  static async runPg(command, args, options = {}) {
    return this.run(command, args, options);
  }

  // 명령어 존재 여부 확인
  static async commandExists(command) {
    try {
      await this.run('which', [command], { stdio: ['ignore', 'pipe', 'pipe'] });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Supabase CLI 설치 여부 확인
  static async isSupabaseInstalled() {
    try {
      await this.run('npx', ['supabase', '--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      return true;
    } catch (error) {
      return false;
    }
  }

  // PostgreSQL 클라이언트 도구 설치 여부 확인
  static async isPostgreSQLInstalled() {
    const commands = ['pg_dump', 'psql'];
    for (const command of commands) {
      if (!(await this.commandExists(command))) {
        return false;
      }
    }
    return true;
  }

  // 시스템 요구사항 확인
  static async checkRequirements() {
    const requirements = {
      node: false,
      supabase: false,
      postgresql: false
    };

    try {
      // Node.js 확인
      await this.run('node', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      requirements.node = true;
    } catch (error) {
      // Node.js는 이미 실행 중이므로 항상 true
      requirements.node = true;
    }

    // Supabase CLI 확인
    requirements.supabase = await this.isSupabaseInstalled();

    // PostgreSQL 클라이언트 도구 확인
    requirements.postgresql = await this.isPostgreSQLInstalled();

    return requirements;
  }

  // 로컬 Supabase 상태 확인 및 설정 자동 감지
  static async getLocalSupabaseConfig() {
    try {
      const result = await this.run('npx', ['supabase', 'status'], { 
        stdio: ['ignore', 'pipe', 'pipe'],
        showOutput: false 
      });
      
      const output = result.stdout;
      
      // DB URL 파싱: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      const dbUrlMatch = output.match(/DB URL:\s*(postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(\w+))/);
      
      if (dbUrlMatch) {
        return {
          url: dbUrlMatch[1],
          host: dbUrlMatch[4],
          port: parseInt(dbUrlMatch[5]),
          user: dbUrlMatch[2],
          password: dbUrlMatch[3],
          database: dbUrlMatch[6],
          isRunning: true
        };
      }
      
      return { isRunning: false };
    } catch (error) {
      return { isRunning: false };
    }
  }

  // 데이터베이스 연결 테스트
  static async testConnection(config, isLocal = true) {
    try {
      if (isLocal) {
        const env = {
          ...process.env,
          PGPASSWORD: config.password
        };

        await this.run('psql', [
          '-h', config.host,
          '-p', config.port.toString(),
          '-U', config.user,
          '-d', config.database,
          '-c', 'SELECT 1;'
        ], { 
          env,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      } else {
        // 클라우드 연결 테스트는 간단한 쿼리로
        const dbUrl = config.url.replace(/postgresql:\/\/postgres:.*@/, `postgresql://postgres:${config.password}@`);
        await this.run('psql', [dbUrl, '-c', 'SELECT 1;'], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // 프로세스 강제 종료
  static killProcess(process) {
    if (process && process.pid) {
      try {
        process.kill('SIGTERM');
        
        // 3초 후에도 살아있으면 강제 종료
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 3000);
        
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }
}

module.exports = CommandRunner;