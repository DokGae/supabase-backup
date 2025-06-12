const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const { getGitHash, getCurrentTimestamp } = require('../utils/git');

class BackupService {
  constructor() {
    this.isRunning = false;
  }

  async createBackupDir(isLocal = false) {
    const timestamp = getCurrentTimestamp();
    const gitHash = await getGitHash();
    const suffix = isLocal ? '_local' : '';
    const dirName = `${timestamp}${gitHash}${suffix}`;
    
    const backupConfig = config.getBackupConfig();
    const dumpDir = path.join(backupConfig.dumpDir, dirName);
    
    await fs.mkdir(dumpDir, { recursive: true });
    return dumpDir;
  }

  async backupCloud(progressCallback, logCallback) {
    if (this.isRunning) {
      throw new Error('백업이 이미 실행 중입니다');
    }

    const cloudConfig = config.getCloudConfig();
    if (!config.validateCloudConfig()) {
      throw new Error('클라우드 DB 설정이 올바르지 않습니다');
    }

    this.isRunning = true;
    try {
      const dumpDir = await this.createBackupDir(false);
      logCallback(`백업 디렉토리 생성: ${dumpDir}`);

      const dbUrl = `postgresql://postgres:${cloudConfig.password}@${cloudConfig.url.split('@')[1]}`;
      
      const backupTasks = [
        { name: 'roles.sql', args: ['db', 'dump', '--db-url', dbUrl, '--role-only', '-f'], step: 1 },
        { name: 'schema.sql', args: ['db', 'dump', '--db-url', dbUrl, '-f'], step: 2 },
        { name: 'data.sql', args: ['db', 'dump', '--db-url', dbUrl, '--data-only', '-f'], step: 3 },
        { name: 'storage-policies.sql', args: ['db', 'dump', '--db-url', dbUrl, '-f', '--schema', 'storage'], step: 4 }
      ];

      for (const task of backupTasks) {
        const fileName = path.join(dumpDir, task.name);
        const args = [...task.args];
        args[args.length - 1] = fileName; // -f 다음의 파일명 설정

        logCallback(`${task.name} 백업 시작...`);
        await this.runSupabaseCommand('npx', ['supabase', ...args], logCallback);
        
        progressCallback((task.step / backupTasks.length) * 100, `${task.name} 완료`);
        logCallback(`${task.name} 백업 완료`);
      }

      logCallback(`클라우드 백업 완료: ${dumpDir}`);
      return dumpDir;
    } finally {
      this.isRunning = false;
    }
  }

  async backupLocal(progressCallback, logCallback) {
    if (this.isRunning) {
      throw new Error('백업이 이미 실행 중입니다');
    }

    const localConfig = config.getLocalConfig();
    if (!config.validateLocalConfig()) {
      throw new Error('로컬 DB 설정이 올바르지 않습니다');
    }

    this.isRunning = true;
    try {
      const dumpDir = await this.createBackupDir(true);
      logCallback(`백업 디렉토리 생성: ${dumpDir}`);

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

      const backupTasks = [
        { name: 'roles.sql', args: [...baseArgs, '--roles-only', '-f'], step: 1 },
        { name: 'schema.sql', args: [...baseArgs, '--schema-only', '-f'], step: 2 },
        { name: 'data.sql', args: [...baseArgs, '--data-only', '-f'], step: 3 },
        { name: 'storage-policies.sql', args: [...baseArgs, '--schema', 'storage', '-f'], step: 4 }
      ];

      for (const task of backupTasks) {
        const fileName = path.join(dumpDir, task.name);
        const args = [...task.args, fileName];

        logCallback(`${task.name} 백업 시작...`);
        await this.runCommand('pg_dump', args, env, logCallback);
        
        progressCallback((task.step / backupTasks.length) * 100, `${task.name} 완료`);
        logCallback(`${task.name} 백업 완료`);
      }

      logCallback(`로컬 백업 완료: ${dumpDir}`);
      return dumpDir;
    } finally {
      this.isRunning = false;
    }
  }

  async runSupabaseCommand(command, args, logCallback) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
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
        logCallback(data.toString().trim(), 'warning');
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
        logCallback(data.toString().trim(), 'warning');
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

  async getBackupList() {
    const backupConfig = config.getBackupConfig();
    const dumpDir = backupConfig.dumpDir;

    try {
      const items = await fs.readdir(dumpDir);
      const backups = [];

      for (const item of items) {
        const itemPath = path.join(dumpDir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          backups.push({
            name: item,
            path: itemPath,
            date: stat.mtime,
            isLocal: item.includes('_local')
          });
        }
      }

      return backups.sort((a, b) => b.date - a.date);
    } catch (error) {
      return [];
    }
  }

  stop() {
    this.isRunning = false;
  }
}

module.exports = new BackupService();