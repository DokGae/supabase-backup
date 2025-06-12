const blessed = require('blessed');
const backupService = require('../../services/backup');
const config = require('../../services/config');
const ProgressBar = require('../components/progressBar');
const LogViewer = require('../components/logViewer');

class BackupTab {
  constructor(parent) {
    this.parent = parent;
    this.currentFocus = 0;
    this.focusableElements = [];
    this.isBackupRunning = false;
    this.create();
  }

  create() {
    this.container = blessed.box({
      parent: this.parent,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      scrollable: true,
      alwaysScroll: true
    });

    this.createBackupOptions();
    this.createBackupButtons();
    this.createProgressSection();
    this.createLogSection();
    this.createBackupList();
  }

  createBackupOptions() {
    const optionsBox = blessed.box({
      parent: this.container,
      label: ' 백업 옵션 ',
      top: 0,
      left: 0,
      right: '50%',
      height: 8,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    // 백업 대상 선택
    this.cloudRadio = blessed.radioset({
      parent: optionsBox,
      top: 1,
      left: 2,
      right: 2,
      height: 5,
      style: {
        selected: {
          bg: 'blue'
        }
      }
    });

    this.cloudButton = blessed.radiobutton({
      parent: this.cloudRadio,
      content: '클라우드 DB 백업 (Supabase)',
      top: 0,
      left: 0,
      checked: true
    });

    this.localButton = blessed.radiobutton({
      parent: this.cloudRadio,
      content: '로컬 DB 백업 (PostgreSQL)',
      top: 2,
      left: 0
    });

    this.focusableElements.push(this.cloudButton, this.localButton);
  }

  createBackupButtons() {
    const buttonBox = blessed.box({
      parent: this.container,
      top: 0,
      left: '50%',
      right: 0,
      height: 8,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'green'
        }
      }
    });

    this.startButton = blessed.button({
      parent: buttonBox,
      content: ' 백업 시작 ',
      top: 1,
      left: 2,
      width: 15,
      height: 3,
      style: {
        fg: 'white',
        bg: 'green',
        focus: {
          bg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    });

    this.stopButton = blessed.button({
      parent: buttonBox,
      content: ' 백업 중지 ',
      top: 1,
      left: 18,
      width: 15,
      height: 3,
      style: {
        fg: 'white',
        bg: 'red',
        focus: {
          bg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    });

    this.refreshButton = blessed.button({
      parent: buttonBox,
      content: ' 목록 새로고침 ',
      top: 1,
      left: 34,
      width: 18,
      height: 3,
      style: {
        fg: 'white',
        bg: 'cyan',
        focus: {
          bg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    });

    this.focusableElements.push(this.startButton, this.stopButton, this.refreshButton);
  }

  createProgressSection() {
    const progressBox = blessed.box({
      parent: this.container,
      label: ' 진행률 ',
      top: 9,
      left: 0,
      right: 0,
      height: 5,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'yellow'
        }
      }
    });

    this.progressBar = new ProgressBar(progressBox, {
      top: 1,
      left: 1,
      right: 1,
      height: 1,
      label: '백업 진행률'
    });

    this.statusText = blessed.text({
      parent: progressBox,
      content: '백업 대기 중...',
      top: 2,
      left: 2,
      right: 2,
      style: {
        fg: 'white'
      }
    });
  }

  createLogSection() {
    this.logViewer = new LogViewer(this.container, {
      label: '백업 로그',
      top: 15,
      left: 0,
      right: '50%',
      bottom: 0
    });
  }

  createBackupList() {
    const listBox = blessed.box({
      parent: this.container,
      label: ' 백업 목록 ',
      top: 15,
      left: '50%',
      right: 0,
      bottom: 0,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'magenta'
        }
      }
    });

    this.backupList = blessed.list({
      parent: listBox,
      top: 1,
      left: 1,
      right: 1,
      bottom: 1,
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      style: {
        selected: {
          bg: 'blue'
        },
        item: {
          hover: {
            bg: 'grey'
          }
        }
      },
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'cyan'
        },
        style: {
          inverse: true
        }
      }
    });

    this.focusableElements.push(this.backupList);
    this.loadBackupList();
  }

  async loadBackupList() {
    try {
      const backups = await backupService.getBackupList();
      const items = backups.map(backup => {
        const type = backup.isLocal ? '[로컬]' : '[클라우드]';
        const date = backup.date.toLocaleString();
        return `${type} ${backup.name} (${date})`;
      });

      this.backupList.setItems(items);
      this.parent.render();
    } catch (error) {
      this.logViewer.addLog(`백업 목록 로드 실패: ${error.message}`, 'error');
    }
  }

  async startBackup() {
    if (this.isBackupRunning) {
      this.logViewer.addLog('백업이 이미 실행 중입니다', 'warning');
      return;
    }

    const isCloud = this.cloudButton.checked;
    const backupType = isCloud ? '클라우드' : '로컬';
    
    this.logViewer.addLog(`${backupType} 백업을 시작합니다...`, 'info');
    this.isBackupRunning = true;
    this.updateStatus('백업 시작 중...');

    try {
      let result;
      
      if (isCloud) {
        if (!config.validateCloudConfig()) {
          throw new Error('클라우드 DB 설정이 올바르지 않습니다. 설정 탭에서 확인하세요.');
        }
        
        result = await backupService.backupCloud(
          (percent, message) => this.updateProgress(percent, message),
          (message, type) => this.logViewer.addLog(message, type)
        );
      } else {
        if (!config.validateLocalConfig()) {
          throw new Error('로컬 DB 설정이 올바르지 않습니다. 설정 탭에서 확인하세요.');
        }
        
        result = await backupService.backupLocal(
          (percent, message) => this.updateProgress(percent, message),
          (message, type) => this.logViewer.addLog(message, type)
        );
      }

      this.logViewer.addLog(`백업 완료: ${result}`, 'success');
      this.updateStatus('백업 완료');
      this.progressBar.update(100, '완료');
      
      // 백업 목록 새로고침
      await this.loadBackupList();
      
    } catch (error) {
      this.logViewer.addLog(`백업 실패: ${error.message}`, 'error');
      this.updateStatus(`백업 실패: ${error.message}`);
      this.progressBar.update(0, '실패');
    } finally {
      this.isBackupRunning = false;
    }
  }

  stopBackup() {
    if (!this.isBackupRunning) {
      this.logViewer.addLog('실행 중인 백업이 없습니다', 'warning');
      return;
    }

    backupService.stop();
    this.isBackupRunning = false;
    this.logViewer.addLog('백업이 중지되었습니다', 'warning');
    this.updateStatus('백업 중지됨');
    this.progressBar.update(0, '중지됨');
  }

  updateProgress(percent, message) {
    this.progressBar.update(percent, message);
    this.updateStatus(message || `진행률: ${Math.round(percent)}%`);
  }

  updateStatus(message) {
    this.statusText.setContent(message);
    this.parent.render();
  }

  handleKey(ch, key) {
    if (key.name === 'up') {
      this.focusPrevious();
    } else if (key.name === 'down') {
      this.focusNext();
    } else if (key.name === 'enter') {
      const focused = this.focusableElements[this.currentFocus];
      
      if (focused === this.startButton) {
        this.startBackup();
      } else if (focused === this.stopButton) {
        this.stopBackup();
      } else if (focused === this.refreshButton) {
        this.loadBackupList();
      } else if (focused === this.cloudButton || focused === this.localButton) {
        focused.check();
        this.parent.render();
      }
    } else if (key.name === 'space') {
      const focused = this.focusableElements[this.currentFocus];
      
      if (focused === this.cloudButton || focused === this.localButton) {
        focused.check();
        this.parent.render();
      }
    } else if (key.name === 'r') {
      // 'r' 키로 빠른 새로고침
      this.loadBackupList();
    } else if (key.name === 's') {
      // 's' 키로 빠른 백업 시작
      this.startBackup();
    }
  }

  focusNext() {
    this.currentFocus = (this.currentFocus + 1) % this.focusableElements.length;
    this.updateFocus();
  }

  focusPrevious() {
    this.currentFocus = (this.currentFocus - 1 + this.focusableElements.length) % this.focusableElements.length;
    this.updateFocus();
  }

  updateFocus() {
    this.focusableElements.forEach((element, index) => {
      if (index === this.currentFocus) {
        element.focus();
      } else {
        if (element.blur && typeof element.blur === 'function') {
          element.blur();
        }
      }
    });
    this.parent.render();
  }

  show() {
    this.container.show();
    this.updateFocus();
    this.loadBackupList(); // 탭이 표시될 때마다 목록 새로고침
  }

  hide() {
    this.container.hide();
  }
}

module.exports = BackupTab;