const { spawn } = require('child_process');

function getCurrentTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

async function getGitHash() {
  try {
    return await new Promise((resolve, reject) => {
      const process = spawn('git', ['rev-parse', '--short', 'HEAD'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve('_' + stdout.trim());
        } else {
          // Git이 설치되지 않았거나 Git 저장소가 아닌 경우
          resolve('');
        }
      });

      process.on('error', (error) => {
        // Git 명령어를 찾을 수 없는 경우
        resolve('');
      });
    });
  } catch (error) {
    return '';
  }
}

async function isGitRepo() {
  try {
    return await new Promise((resolve) => {
      const process = spawn('git', ['rev-parse', '--git-dir'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  } catch (error) {
    return false;
  }
}

async function getGitBranch() {
  try {
    return await new Promise((resolve, reject) => {
      const process = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          resolve('main');
        }
      });

      process.on('error', () => {
        resolve('main');
      });
    });
  } catch (error) {
    return 'main';
  }
}

function formatBackupName(timestamp, gitHash, suffix = '') {
  if (gitHash && gitHash.startsWith('_')) {
    return `${timestamp}${gitHash}${suffix}`;
  } else if (gitHash) {
    return `${timestamp}_${gitHash}${suffix}`;
  } else {
    return `${timestamp}${suffix}`;
  }
}

module.exports = {
  getCurrentTimestamp,
  getGitHash,
  isGitRepo,
  getGitBranch,
  formatBackupName
};