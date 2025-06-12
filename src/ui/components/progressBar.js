const blessed = require('blessed');

class ProgressBar {
  constructor(parent, options = {}) {
    this.parent = parent;
    this.options = {
      top: options.top || 0,
      left: options.left || 0,
      right: options.right || 0,
      height: options.height || 3,
      label: options.label || '진행률',
      ...options
    };
    this.create();
  }

  create() {
    this.container = blessed.box({
      parent: this.parent,
      top: this.options.top,
      left: this.options.left,
      right: this.options.right,
      height: this.options.height,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    this.progressbar = blessed.progressbar({
      parent: this.container,
      top: 0,
      left: 1,
      right: 1,
      height: 1,
      orientation: 'horizontal',
      style: {
        bar: {
          bg: 'green'
        }
      },
      ch: '█'
    });

    this.label = blessed.text({
      parent: this.container,
      top: 0,
      left: 1,
      content: this.options.label,
      style: {
        fg: 'white',
        bg: 'transparent'
      }
    });
  }

  update(percent, text) {
    this.progressbar.setProgress(percent);
    if (text) {
      this.label.setContent(`${this.options.label}: ${text} (${Math.round(percent)}%)`);
    } else {
      this.label.setContent(`${this.options.label}: ${Math.round(percent)}%`);
    }
    this.parent.render();
  }

  hide() {
    this.container.hide();
  }

  show() {
    this.container.show();
  }

  destroy() {
    this.container.destroy();
  }
}

module.exports = ProgressBar;