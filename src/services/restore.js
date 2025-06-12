const { spawn } = require('child_process');
const path = require('path');
const config = require('./config');
const backupService = require('./backup');

class RestoreService {
  constructor() {
    this.isRunning = false;
  }

  async restoreToLocal(backupPath, options, progressCallback, logCallback) {
    if (this.isRunning) {
      throw new Error('복원이 이미 실행 중입니다');
    }

    const localConfig = config.getLocalConfig();
    if (!config.validateLocalConfig()) {
      throw new Error('로컬 DB 설정이 올바르지 않습니다');
    }

    this.isRunning = true;
    try {
      logCallback(`로컬 DB 복원 시작: ${backupPath}`);

      const env = {
        ...process.env,
        PGPASSWORD: localConfig.password
      };

      const baseArgs = [
        '-h', localConfig.host,
        '-p', localConfig.port.toString(),
        '-U', localConfig.user,
        '-d', localConfig.database
      ];

      const restoreTasks = [];
      let step = 0;

      if (options.roles) {
        restoreTasks.push({
          name: 'roles.sql',
          args: [...baseArgs, '-f', path.join(backupPath, 'roles.sql')],
          step: ++step
        });
      }

      if (options.schema) {
        restoreTasks.push({
          name: 'schema.sql',
          args: [...baseArgs, '-f', path.join(backupPath, 'schema.sql')],
          step: ++step
        });
      }

      if (options.data) {
        restoreTasks.push({
          name: 'data.sql',
          args: [...baseArgs, '-f', path.join(backupPath, 'data.sql')],
          step: ++step
        });
      }

      if (options.storage) {
        restoreTasks.push({
          name: 'storage-policies.sql',
          args: [...baseArgs, '-f', path.join(backupPath, 'storage-policies.sql')],
          step: ++step
        });
      }

      for (const task of restoreTasks) {
        logCallback(`${task.name} 복원 시작...`);
        await this.runCommand('psql', task.args, env, logCallback);
        
        progressCallback((task.step / restoreTasks.length) * 100, `${task.name} 완료`);
        logCallback(`${task.name} 복원 완료`);
      }

      logCallback('로컬 DB 복원 완료');
      return true;
    } finally {
      this.isRunning = false;
    }
  }

  async restoreToCloud(backupPath, options, progressCallback, logCallback) {
    if (this.isRunning) {
      throw new Error('복원이 이미 실행 중입니다');
    }

    const cloudConfig = config.getCloudConfig();
    if (!config.validateCloudConfig()) {
      throw new Error('클라우드 DB 설정이 올바르지 않습니다');
    }

    this.isRunning = true;
    try {
      // 복원 전 자동 백업 생성
      if (options.autoBackup) {
        logCallback('복원 전 자동 백업 생성 중...');
        await backupService.backupCloud(
          (percent) => progressCallback(percent * 0.3, '자동 백업 중...'), 
          logCallback
        );
      }

      logCallback(`클라우드 DB 복원 시작: ${backupPath}`);

      const dbUrl = `postgresql://postgres:${cloudConfig.password}@${cloudConfig.url.split('@')[1]}`;
      
      const restoreTasks = [];
      let step = 0;
      const startPercent = options.autoBackup ? 30 : 0;
      const totalPercent = 100 - startPercent;

      if (options.roles) {
        restoreTasks.push({
          name: 'roles.sql',
          file: path.join(backupPath, 'roles.sql'),
          step: ++step
        });
      }

      if (options.schema) {
        restoreTasks.push({
          name: 'schema.sql',
          file: path.join(backupPath, 'schema.sql'),
          step: ++step
        });
      }

      if (options.data) {
        restoreTasks.push({
          name: 'data.sql',
          file: path.join(backupPath, 'data.sql'),
          step: ++step
        });
      }

      if (options.storage) {
        restoreTasks.push({
          name: 'storage-policies.sql',
          file: path.join(backupPath, 'storage-policies.sql'),
          step: ++step
        });
      }

      for (const task of restoreTasks) {
        logCallback(`${task.name} 복원 시작...`);
        
        // 클라우드 복원은 psql을 사용하여 직접 실행
        const env = {
          ...process.env,
          PGPASSWORD: cloudConfig.password
        };

        const urlParts = config.parseCloudUrl(cloudConfig.url);
        const args = [
          '-h', urlParts.host,
          '-p', urlParts.port.toString(),
          '-U', urlParts.user,
          '-d', urlParts.database,
          '-f', task.file
        ];

        // 데이터 복원 시 충돌 방지 옵션 추가
        if (task.name === 'data.sql' && options.skipConflicts) {
          args.push('--on-error-stop');
        }

        await this.runCommand('psql', args, env, logCallback);
        
        const currentPercent = startPercent + (task.step / restoreTasks.length) * totalPercent;
        progressCallback(currentPercent, `${task.name} 완료`);
        logCallback(`${task.name} 복원 완료`);
      }

      logCallback('클라우드 DB 복원 완료');
      return true;
    } finally {
      this.isRunning = false;
    }
  }

  async runCommand(command, args, env, logCallback) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        env,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data;
        logCallback(data.toString().trim(), 'info');
      });

      process.stderr.on('data', (data) => {
        stderr += data;
        // PostgreSQL 경고는 warning으로, 에러는 error로 분류
        const message = data.toString().trim();
        const type = message.includes('ERROR') ? 'error' : 'warning';
        logCallback(message, type);
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  // 복원 옵션 템플릿
  getRestoreOptions() {
    return {
      roles: true,
      schema: true,
      data: true,
      storage: true,
      autoBackup: true,
      skipConflicts: true
    };
  }

  // 개별 복원 옵션들
  async restoreRolesOnly(backupPath, isLocal, progressCallback, logCallback) {
    const options = {
      roles: true,
      schema: false,
      data: false,
      storage: false,
      autoBackup: false,
      skipConflicts: false
    };

    if (isLocal) {
      return await this.restoreToLocal(backupPath, options, progressCallback, logCallback);
    } else {
      return await this.restoreToCloud(backupPath, options, progressCallback, logCallback);
    }
  }

  async restoreSchemaOnly(backupPath, isLocal, progressCallback, logCallback) {
    const options = {
      roles: false,
      schema: true,
      data: false,
      storage: false,
      autoBackup: false,
      skipConflicts: true
    };

    if (isLocal) {
      return await this.restoreToLocal(backupPath, options, progressCallback, logCallback);
    } else {
      return await this.restoreToCloud(backupPath, options, progressCallback, logCallback);
    }
  }

  async restoreDataOnly(backupPath, isLocal, progressCallback, logCallback) {
    const options = {
      roles: false,
      schema: false,
      data: true,
      storage: false,
      autoBackup: false,
      skipConflicts: true
    };

    if (isLocal) {
      return await this.restoreToLocal(backupPath, options, progressCallback, logCallback);
    } else {
      return await this.restoreToCloud(backupPath, options, progressCallback, logCallback);
    }
  }

  async restoreStorageOnly(backupPath, isLocal, progressCallback, logCallback) {
    const options = {
      roles: false,
      schema: false,
      data: false,
      storage: true,
      autoBackup: false,
      skipConflicts: false
    };

    if (isLocal) {
      return await this.restoreToLocal(backupPath, options, progressCallback, logCallback);
    } else {
      return await this.restoreToCloud(backupPath, options, progressCallback, logCallback);
    }
  }

  async restoreAll(backupPath, isLocal, progressCallback, logCallback) {
    const options = this.getRestoreOptions();

    if (isLocal) {
      return await this.restoreToLocal(backupPath, options, progressCallback, logCallback);
    } else {
      return await this.restoreToCloud(backupPath, options, progressCallback, logCallback);
    }
  }

  stop() {
    this.isRunning = false;
  }
}

module.exports = new RestoreService();