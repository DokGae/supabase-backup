const blessed = require('blessed');
const restoreService = require('../../services/restore');
const backupService = require('../../services/backup');
const config = require('../../services/config');
const ProgressBar = require('../components/progressBar');
const LogViewer = require('../components/logViewer');

class RestoreTab {
  constructor(parent) {
    this.parent = parent;
    this.currentFocus = 0;
    this.focusableElements = [];
    this.isRestoreRunning = false;
    this.backups = [];
    this.selectedBackup = null;
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

    this.createBackupSelection();
    this.createRestoreOptions();
    this.createTargetSelection();
    this.createRestoreButtons();
    this.createProgressSection();
    this.createLogSection();
  }

  createBackupSelection() {
    const selectionBox = blessed.box({
      parent: this.container,
      label: ' 백업 선택 ',
      top: 0,
      left: 0,
      right: '50%',
      height: 12,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    this.backupList = blessed.list({
      parent: selectionBox,
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

  createRestoreOptions() {
    const optionsBox = blessed.box({
      parent: this.container,
      label: ' 복원 옵션 ',
      top: 0,
      left: '50%',
      right: 0,
      height: 12,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'green'
        }
      }
    });

    // 체크박스들
    this.rolesCheck = blessed.checkbox({
      parent: optionsBox,
      content: '역할(Roles) 복원',
      top: 1,
      left: 2,
      checked: true,
      style: {
        focus: {
          bg: 'blue'
        }
      }
    });

    this.schemaCheck = blessed.checkbox({
      parent: optionsBox,
      content: '스키마(Schema) 복원',
      top: 2,
      left: 2,
      checked: true,
      style: {
        focus: {
          bg: 'blue'
        }
      }
    });

    this.dataCheck = blessed.checkbox({
      parent: optionsBox,
      content: '데이터(Data) 복원',
      top: 3,
      left: 2,
      checked: true,
      style: {
        focus: {
          bg: 'blue'
        }
      }
    });

    this.storageCheck = blessed.checkbox({
      parent: optionsBox,
      content: 'Storage 정책 복원',
      top: 4,
      left: 2,
      checked: true,
      style: {
        focus: {
          bg: 'blue'
        }
      }
    });

    this.autoBackupCheck = blessed.checkbox({
      parent: optionsBox,
      content: '복원 전 자동 백업',
      top: 5,
      left: 2,
      checked: true,
      style: {
        focus: {
          bg: 'blue'
        }
      }
    });

    this.skipConflictsCheck = blessed.checkbox({
      parent: optionsBox,
      content: '충돌 시 건너뛰기',
      top: 6,
      left: 2,
      checked: true,
      style: {
        focus: {
          bg: 'blue'
        }
      }
    });

    this.focusableElements.push(
      this.rolesCheck,
      this.schemaCheck,
      this.dataCheck,
      this.storageCheck,
      this.autoBackupCheck,
      this.skipConflictsCheck
    );
  }

  createTargetSelection() {
    const targetBox = blessed.box({
      parent: this.container,
      label: ' 복원 대상 ',
      top: 13,
      left: 0,
      right: '50%',
      height: 6,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'yellow'
        }
      }
    });

    this.targetRadio = blessed.radioset({
      parent: targetBox,
      top: 1,
      left: 2,
      right: 2,
      height: 4,
      style: {
        selected: {
          bg: 'blue'
        }
      }
    });

    this.cloudTargetButton = blessed.radiobutton({
      parent: this.targetRadio,
      content: '클라우드 DB로 복원 (Supabase)',
      top: 0,
      left: 0,
      checked: true
    });

    this.localTargetButton = blessed.radiobutton({
      parent: this.targetRadio,
      content: '로컬 DB로 복원 (PostgreSQL)',
      top: 2,
      left: 0
    });

    this.focusableElements.push(this.cloudTargetButton, this.localTargetButton);
  }

  createRestoreButtons() {
    const buttonBox = blessed.box({
      parent: this.container,
      label: ' 복원 작업 ',
      top: 13,
      left: '50%',
      right: 0,
      height: 6,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'magenta'
        }
      }
    });

    // 첫 번째 줄
    this.restoreAllButton = blessed.button({
      parent: buttonBox,
      content: ' 전체 복원 ',
      top: 1,
      left: 2,
      width: 12,
      height: 1,
      style: {
        fg: 'white',
        bg: 'green',
        focus: { bg: 'blue' }
      }
    });

    this.rolesOnlyButton = blessed.button({
      parent: buttonBox,
      content: ' 역할만 ',
      top: 1,
      left: 15,
      width: 10,
      height: 1,
      style: {
        fg: 'white',
        bg: 'cyan',
        focus: { bg: 'blue' }
      }
    });

    this.schemaOnlyButton = blessed.button({
      parent: buttonBox,
      content: ' 스키마만 ',
      top: 1,
      left: 26,
      width: 11,
      height: 1,
      style: {
        fg: 'white',
        bg: 'cyan',
        focus: { bg: 'blue' }
      }
    });

    // 두 번째 줄
    this.dataOnlyButton = blessed.button({
      parent: buttonBox,
      content: ' 데이터만 ',
      top: 3,
      left: 2,
      width: 11,
      height: 1,
      style: {
        fg: 'white',
        bg: 'cyan',
        focus: { bg: 'blue' }
      }
    });

    this.storageOnlyButton = blessed.button({
      parent: buttonBox,
      content: ' Storage만 ',
      top: 3,
      left: 14,
      width: 12,
      height: 1,
      style: {
        fg: 'white',
        bg: 'cyan',
        focus: { bg: 'blue' }
      }
    });

    this.stopButton = blessed.button({
      parent: buttonBox,
      content: ' 중지 ',
      top: 3,
      left: 27,
      width: 8,
      height: 1,
      style: {
        fg: 'white',
        bg: 'red',
        focus: { bg: 'blue' }
      }
    });

    this.focusableElements.push(
      this.restoreAllButton,
      this.rolesOnlyButton,
      this.schemaOnlyButton,
      this.dataOnlyButton,
      this.storageOnlyButton,
      this.stopButton
    );
  }

  createProgressSection() {
    const progressBox = blessed.box({
      parent: this.container,
      label: ' 진행률 ',
      top: 20,
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
      label: '복원 진행률'
    });

    this.statusText = blessed.text({
      parent: progressBox,
      content: '복원 대기 중...',
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
      label: '복원 로그',
      top: 26,
      left: 0,
      right: 0,
      bottom: 0
    });
  }

  async loadBackupList() {
    try {
      this.backups = await backupService.getBackupList();
      const items = this.backups.map(backup => {
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

  getSelectedBackup() {
    const index = this.backupList.selected;
    if (index >= 0 && index < this.backups.length) {
      return this.backups[index];
    }
    return null;
  }

  getRestoreOptions() {
    return {
      roles: this.rolesCheck.checked,
      schema: this.schemaCheck.checked,
      data: this.dataCheck.checked,
      storage: this.storageCheck.checked,
      autoBackup: this.autoBackupCheck.checked,
      skipConflicts: this.skipConflictsCheck.checked
    };
  }

  async restoreAll() {
    const backup = this.getSelectedBackup();
    if (!backup) {
      this.logViewer.addLog('백업을 선택하세요', 'warning');
      return;
    }

    const isLocal = this.localTargetButton.checked;
    await this.executeRestore('전체', () => 
      restoreService.restoreAll(backup.path, isLocal, 
        (percent, message) => this.updateProgress(percent, message),
        (message, type) => this.logViewer.addLog(message, type)
      )
    );
  }

  async restoreRolesOnly() {
    const backup = this.getSelectedBackup();
    if (!backup) {
      this.logViewer.addLog('백업을 선택하세요', 'warning');
      return;
    }

    const isLocal = this.localTargetButton.checked;
    await this.executeRestore('역할만', () => 
      restoreService.restoreRolesOnly(backup.path, isLocal,
        (percent, message) => this.updateProgress(percent, message),
        (message, type) => this.logViewer.addLog(message, type)
      )
    );
  }

  async restoreSchemaOnly() {
    const backup = this.getSelectedBackup();
    if (!backup) {
      this.logViewer.addLog('백업을 선택하세요', 'warning');
      return;
    }

    const isLocal = this.localTargetButton.checked;
    await this.executeRestore('스키마만', () => 
      restoreService.restoreSchemaOnly(backup.path, isLocal,
        (percent, message) => this.updateProgress(percent, message),
        (message, type) => this.logViewer.addLog(message, type)
      )
    );
  }

  async restoreDataOnly() {
    const backup = this.getSelectedBackup();
    if (!backup) {
      this.logViewer.addLog('백업을 선택하세요', 'warning');
      return;
    }

    const isLocal = this.localTargetButton.checked;
    await this.executeRestore('데이터만', () => 
      restoreService.restoreDataOnly(backup.path, isLocal,
        (percent, message) => this.updateProgress(percent, message),
        (message, type) => this.logViewer.addLog(message, type)
      )
    );
  }

  async restoreStorageOnly() {
    const backup = this.getSelectedBackup();
    if (!backup) {
      this.logViewer.addLog('백업을 선택하세요', 'warning');
      return;
    }

    const isLocal = this.localTargetButton.checked;
    await this.executeRestore('Storage만', () => 
      restoreService.restoreStorageOnly(backup.path, isLocal,
        (percent, message) => this.updateProgress(percent, message),
        (message, type) => this.logViewer.addLog(message, type)
      )
    );
  }

  async executeRestore(type, restoreFunction) {
    if (this.isRestoreRunning) {
      this.logViewer.addLog('복원이 이미 실행 중입니다', 'warning');
      return;
    }

    const targetType = this.localTargetButton.checked ? '로컬' : '클라우드';
    this.logViewer.addLog(`${type} 복원을 시작합니다 (대상: ${targetType})...`, 'info');
    this.isRestoreRunning = true;
    this.updateStatus(`${type} 복원 시작 중...`);

    try {
      // 설정 검증
      if (this.localTargetButton.checked) {
        if (!config.validateLocalConfig()) {
          throw new Error('로컬 DB 설정이 올바르지 않습니다. 설정 탭에서 확인하세요.');
        }
      } else {
        if (!config.validateCloudConfig()) {
          throw new Error('클라우드 DB 설정이 올바르지 않습니다. 설정 탭에서 확인하세요.');
        }
      }

      await restoreFunction();
      
      this.logViewer.addLog(`${type} 복원 완료`, 'success');
      this.updateStatus(`${type} 복원 완료`);
      this.progressBar.update(100, '완료');
      
    } catch (error) {
      this.logViewer.addLog(`${type} 복원 실패: ${error.message}`, 'error');
      this.updateStatus(`${type} 복원 실패: ${error.message}`);
      this.progressBar.update(0, '실패');
    } finally {
      this.isRestoreRunning = false;
    }
  }

  stopRestore() {
    if (!this.isRestoreRunning) {
      this.logViewer.addLog('실행 중인 복원이 없습니다', 'warning');
      return;
    }

    restoreService.stop();
    this.isRestoreRunning = false;
    this.logViewer.addLog('복원이 중지되었습니다', 'warning');
    this.updateStatus('복원 중지됨');
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
      
      if (focused === this.restoreAllButton) {
        this.restoreAll();
      } else if (focused === this.rolesOnlyButton) {
        this.restoreRolesOnly();
      } else if (focused === this.schemaOnlyButton) {
        this.restoreSchemaOnly();
      } else if (focused === this.dataOnlyButton) {
        this.restoreDataOnly();
      } else if (focused === this.storageOnlyButton) {
        this.restoreStorageOnly();
      } else if (focused === this.stopButton) {
        this.stopRestore();
      } else if (focused === this.cloudTargetButton || focused === this.localTargetButton) {
        focused.check();
        this.parent.render();
      }
    } else if (key.name === 'space') {
      const focused = this.focusableElements[this.currentFocus];
      
      if (focused === this.cloudTargetButton || focused === this.localTargetButton) {
        focused.check();
        this.parent.render();
      } else if (focused.check) {
        focused.check();
        this.parent.render();
      }
    } else if (key.name === 'r') {
      // 'r' 키로 빠른 새로고침
      this.loadBackupList();
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

module.exports = RestoreTab;