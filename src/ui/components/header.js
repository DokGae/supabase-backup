const blessed = require('blessed');

class Header {
  constructor(parent) {
    this.parent = parent;
    this.create();
  }

  create() {
    this.box = blessed.box({
      parent: this.parent,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      content: ' {center}{bold}{blue-fg}Supabase Backup Manager{/blue-fg}{/bold}{/center}',
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue'
        }
      },
      border: {
        type: 'line'
      }
    });
  }

  updateStatus(status) {
    this.box.setContent(
      ` {center}{bold}{blue-fg}Supabase Backup Manager{/blue-fg}{/bold}{/center}\n` +
      ` {center}${status}{/center}`
    );
    this.parent.render();
  }
}

module.exports = Header;