import { logger } from '@/lib/logger';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  type?: 'normal' | 'separator' | 'checkbox' | 'radio';
  action?: () => void;
}

export interface ContextMenuOptions {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect?: (id: string) => void;
  onClose?: () => void;
}

class ContextMenuManager {
  private currentMenu: HTMLElement | null = null;
  private listeners: Map<string, () => void> = new Map();

  show(options: ContextMenuOptions): void {
    this.hide();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${options.x}px;
      top: ${options.y}px;
      z-index: 10000;
      min-width: 180px;
      background: rgba(30, 30, 30, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 4px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    options.items.forEach((item) => {
      if (item.type === 'separator') {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        separator.style.cssText = `
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 4px 8px;
        `;
        menu.appendChild(separator);
        return;
      }

      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      menuItem.dataset.id = item.id;
      
      const isEnabled = item.enabled !== false && item.visible !== false;
      menuItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: ${isEnabled ? 'pointer' : 'default'};
        color: ${isEnabled ? 'white' : 'rgba(255, 255, 255, 0.4)'};
        font-size: 13px;
        transition: background 0.15s;
      `;

      if (isEnabled) {
        menuItem.onmouseenter = () => {
          menuItem.style.background = 'rgba(255, 255, 255, 0.1)';
        };
        menuItem.onmouseleave = () => {
          menuItem.style.background = 'transparent';
        };
      }

      if (item.type === 'checkbox' || item.type === 'radio') {
        const checkMark = document.createElement('span');
        checkMark.style.cssText = `
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #007AFF;
        `;
        if (item.checked) {
          checkMark.innerHTML = item.type === 'checkbox' 
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>';
        }
        menuItem.appendChild(checkMark);
      }

      const label = document.createElement('span');
      label.style.flex = '1';
      label.textContent = item.label;
      menuItem.appendChild(label);

      if (item.shortcut && isEnabled) {
        const shortcut = document.createElement('span');
        shortcut.style.cssText = `
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          margin-left: auto;
        `;
        shortcut.textContent = item.shortcut;
        menuItem.appendChild(shortcut);
      }

      if (isEnabled && item.action) {
        menuItem.onclick = (e) => {
          e.stopPropagation();
          options.onSelect?.(item.id);
          this.hide();
        };
      }

      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
    this.currentMenu = menu;

    // 调整位置以确保菜单不超出视口
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${options.x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${options.y - rect.height}px`;
    }

    // 点击其他地方关闭菜单
    const closeHandler = () => {
      this.hide();
      options.onClose?.();
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeHandler, { once: true });
      document.addEventListener('contextmenu', closeHandler, { once: true });
      this.listeners.set('close', closeHandler);
    }, 0);

    logger.info(`右键菜单已显示: ${options.items.length} 项`);
  }

  hide(): void {
    if (this.currentMenu) {
      this.currentMenu.remove();
      this.currentMenu = null;
    }

    const closeHandler = this.listeners.get('close');
    if (closeHandler) {
      document.removeEventListener('click', closeHandler);
      document.removeEventListener('contextmenu', closeHandler);
      this.listeners.delete('close');
    }
  }

  isVisible(): boolean {
    return this.currentMenu !== null;
  }

  updatePosition(x: number, y: number): void {
    if (this.currentMenu) {
      this.currentMenu.style.left = `${x}px`;
      this.currentMenu.style.top = `${y}px`;

      const rect = this.currentMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.currentMenu.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.currentMenu.style.top = `${y - rect.height}px`;
      }
    }
  }
}

export const contextMenuManager = new ContextMenuManager();

export default contextMenuManager;
