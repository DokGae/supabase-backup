const blessed = require('blessed');
const config = require('../../services/config');
const CommandRunner = require('../../utils/commands');

class SettingsTab {
  constructor(parent) {
    this.parent = parent;
    this.currentFocus = 0;
    this.inputs = [];
    this.create();
    this.loadSettings();
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

    // 클라우드 DB 설정
    this.createCloudSection();
    
    // 로컬 DB 설정
    this.createLocalSection();
    
    // 백업 설정
    this.createBackupSection();
    
    // 버튼들
    this.createButtons();
    
    // 상태 표시
    this.createStatusSection();
  }

  createCloudSection() {
    const cloudBox = blessed.box({
      parent: this.container,
      label: ' 클라우드 DB 설정 (Supabase) ',
      top: 0,
      left: 0,
      right: 0,
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

    // URL 입력
    blessed.text({
      parent: cloudBox,
      content: 'DB URL:',
      top: 1,
      left: 2,
      width: 10
    });

    this.cloudUrlInput = blessed.textbox({
      parent: cloudBox,
      top: 1,
      left: 12,
      right: 2,
      height: 1,
      inputOnFocus: true,
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          bg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    });

    // 패스워드 입력
    blessed.text({
      parent: cloudBox,
      content: 'Password:',
      top: 4,
      left: 2,
      width: 10
    });

    this.cloudPasswordInput = blessed.textbox({
      parent: cloudBox,
      top: 4,
      left: 12,
      right: 2,
      height: 1,
      inputOnFocus: true,
      secret: true,
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          bg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    });

    this.inputs.push(this.cloudUrlInput, this.cloudPasswordInput);
  }

  createLocalSection() {
    const localBox = blessed.box({
      parent: this.container,
      label: ' 로컬 DB 설정 ',
      top: 9,
      left: 0,
      right: 0,
      height: 14,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'green'
        }
      }
    });

    const fields = [
      { label: 'Host:', key: 'host', default: 'localhost' },
      { label: 'Port:', key: 'port', default: '5432' },
      { label: 'User:', key: 'user', default: 'postgres' },
      { label: 'Database:', key: 'database', default: 'postgres' },
      { label: 'Password:', key: 'password', secret: true }
    ];

    this.localInputs = {};

    fields.forEach((field, index) => {
      blessed.text({
        parent: localBox,
        content: field.label,
        top: 1 + index * 2,
        left: 2,
        width: 12
      });

      const input = blessed.textbox({
        parent: localBox,
        top: 1 + index * 2,
        left: 14,
        right: 2,
        height: 1,
        inputOnFocus: true,
        secret: field.secret || false,
        style: {
          fg: 'white',
          bg: 'black',
          focus: {
            bg: 'blue'
          }
        },
        border: {
          type: 'line'
        }
      });

      this.localInputs[field.key] = input;
      this.inputs.push(input);
    });
  }

  createBackupSection() {
    const backupBox = blessed.box({
      parent: this.container,
      label: ' 백업 설정 ',
      top: 24,
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

    blessed.text({
      parent: backupBox,
      content: '백업 경로:',
      top: 1,
      left: 2,
      width: 12
    });

    this.backupDirInput = blessed.textbox({
      parent: backupBox,
      top: 1,
      left: 14,
      right: 2,
      height: 1,
      inputOnFocus: true,
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          bg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    });

    this.inputs.push(this.backupDirInput);
  }

  createButtons() {
    const buttonBox = blessed.box({
      parent: this.container,
      top: 30,
      left: 0,
      right: 0,
      height: 5
    });

    this.saveButton = blessed.button({
      parent: buttonBox,
      content: ' 저장 ',
      top: 0,
      left: 2,
      width: 10,
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

    this.testCloudButton = blessed.button({
      parent: buttonBox,
      content: ' 클라우드 연결 테스트 ',
      top: 0,
      left: 14,
      width: 20,
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

    this.testLocalButton = blessed.button({
      parent: buttonBox,
      content: ' 로컬 연결 테스트 ',
      top: 0,
      left: 36,
      width: 18,
      height: 3,
      style: {
        fg: 'white',
        bg: 'magenta',
        focus: {
          bg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    });

    this.inputs.push(this.saveButton, this.testCloudButton, this.testLocalButton);
  }

  createStatusSection() {
    this.statusBox = blessed.box({
      parent: this.container,
      label: ' 상태 ',
      top: 36,
      left: 0,
      right: 0,
      height: 8,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'white'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      tags: true
    });

    this.updateStatus('설정을 입력하고 저장하세요.');
  }

  loadSettings() {
    const settings = config.getAllConfig();

    // 클라우드 설정
    this.cloudUrlInput.setValue(settings.cloud.url);
    this.cloudPasswordInput.setValue(settings.cloud.password);

    // 로컬 설정
    this.localInputs.host.setValue(settings.local.host);
    this.localInputs.port.setValue(settings.local.port.toString());
    this.localInputs.user.setValue(settings.local.user);
    this.localInputs.database.setValue(settings.local.database);
    this.localInputs.password.setValue(settings.local.password);

    // 백업 설정
    this.backupDirInput.setValue(settings.backup.dumpDir);
  }

  saveSettings() {
    try {
      // 클라우드 설정 저장
      config.setCloudConfig(
        this.cloudUrlInput.getValue(),
        this.cloudPasswordInput.getValue()
      );

      // 로컬 설정 저장
      config.setLocalConfig(
        this.localInputs.host.getValue(),
        parseInt(this.localInputs.port.getValue()) || 5432,
        this.localInputs.user.getValue(),
        this.localInputs.database.getValue(),
        this.localInputs.password.getValue()
      );

      // 백업 설정 저장
      config.setBackupConfig(this.backupDirInput.getValue());

      this.updateStatus('{green-fg}설정이 성공적으로 저장되었습니다.{/green-fg}');
    } catch (error) {
      this.updateStatus(`{red-fg}설정 저장 실패: ${error.message}{/red-fg}`);
    }
  }

  async testCloudConnection() {
    this.updateStatus('클라우드 DB 연결 테스트 중...');
    
    try {
      const cloudConfig = {
        url: this.cloudUrlInput.getValue(),
        password: this.cloudPasswordInput.getValue()
      };

      if (!cloudConfig.url || !cloudConfig.password) {
        this.updateStatus('{red-fg}클라우드 DB URL과 패스워드를 입력하세요.{/red-fg}');
        return;
      }

      const success = await CommandRunner.testConnection(cloudConfig, false);
      
      if (success) {
        this.updateStatus('{green-fg}클라우드 DB 연결 성공!{/green-fg}');
      } else {
        this.updateStatus('{red-fg}클라우드 DB 연결 실패. 설정을 확인하세요.{/red-fg}');
      }
    } catch (error) {
      this.updateStatus(`{red-fg}클라우드 DB 연결 오류: ${error.message}{/red-fg}`);
    }
  }

  async testLocalConnection() {
    this.updateStatus('로컬 DB 연결 테스트 중...');
    
    try {
      const localConfig = {
        host: this.localInputs.host.getValue(),
        port: parseInt(this.localInputs.port.getValue()) || 5432,
        user: this.localInputs.user.getValue(),
        database: this.localInputs.database.getValue(),
        password: this.localInputs.password.getValue()
      };

      const success = await CommandRunner.testConnection(localConfig, true);
      
      if (success) {
        this.updateStatus('{green-fg}로컬 DB 연결 성공!{/green-fg}');
      } else {
        this.updateStatus('{red-fg}로컬 DB 연결 실패. 설정을 확인하세요.{/red-fg}');
      }
    } catch (error) {
      this.updateStatus(`{red-fg}로컬 DB 연결 오류: ${error.message}{/red-fg}`);
    }
  }

  updateStatus(message) {
    this.statusBox.setContent(message);
    this.parent.screen.render();
  }

  handleKey(ch, key) {
    if (key.name === 'up') {
      this.focusPrevious();
    } else if (key.name === 'down') {
      this.focusNext();
    } else if (key.name === 'enter') {
      const focused = this.inputs[this.currentFocus];
      
      if (focused === this.saveButton) {
        this.saveSettings();
      } else if (focused === this.testCloudButton) {
        this.testCloudConnection();
      } else if (focused === this.testLocalButton) {
        this.testLocalConnection();
      } else if (focused.inputOnFocus) {
        focused.focus();
        focused.readInput();
      }
    }
  }

  focusNext() {
    this.currentFocus = (this.currentFocus + 1) % this.inputs.length;
    this.updateFocus();
  }

  focusPrevious() {
    this.currentFocus = (this.currentFocus - 1 + this.inputs.length) % this.inputs.length;
    this.updateFocus();
  }

  updateFocus() {
    this.inputs.forEach((input, index) => {
      if (index === this.currentFocus) {
        input.focus();
      } else {
        if (input.blur && typeof input.blur === 'function') {
          input.blur();
        }
      }
    });
    this.parent.render();
  }

  show() {
    this.container.show();
    this.updateFocus();
  }

  hide() {
    this.container.hide();
  }
}

module.exports = SettingsTab;