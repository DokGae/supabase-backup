const blessed = require('blessed');

class LogViewer {
  constructor(parent, options = {}) {
    this.parent = parent;
    this.options = {
      top: options.top || 0,
      left: options.left || 0,
      right: options.right || 0,
      bottom: options.bottom || 0,
      label: options.label || '로그',
      ...options
    };
    this.logs = [];
    this.create();
  }

  create() {
    this.box = blessed.box({
      parent: this.parent,
      label: ` ${this.options.label} `,
      top: this.options.top,
      left: this.options.left,
      right: this.options.right,
      bottom: this.options.bottom,
      height: this.options.height,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'cyan'
        },
        style: {
          inverse: true
        }
      },
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      },
      tags: true,
      mouse: true
    });
  }

  addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let coloredMessage;

    switch (type) {
      case 'error':
        coloredMessage = `{red-fg}[${timestamp}] ERROR: ${message}{/red-fg}`;
        break;
      case 'success':
        coloredMessage = `{green-fg}[${timestamp}] SUCCESS: ${message}{/green-fg}`;
        break;
      case 'warning':
        coloredMessage = `{yellow-fg}[${timestamp}] WARNING: ${message}{/yellow-fg}`;
        break;
      case 'info':
      default:
        coloredMessage = `{white-fg}[${timestamp}] INFO: ${message}{/white-fg}`;
        break;
    }

    this.logs.push(coloredMessage);
    
    // 최대 1000개 로그만 유지
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    this.updateContent();
  }

  updateContent() {
    this.box.setContent(this.logs.join('\n'));
    this.box.setScrollPerc(100); // 자동으로 맨 아래로 스크롤
    this.parent.render();
  }

  clear() {
    this.logs = [];
    this.box.setContent('');
    this.parent.render();
  }

  hide() {
    this.box.hide();
  }

  show() {
    this.box.show();
  }

  destroy() {
    this.box.destroy();
  }

  // 스트림 데이터를 실시간으로 추가
  appendStream(data, type = 'info') {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      this.addLog(line, type);
    });
  }
}

module.exports = LogViewer;