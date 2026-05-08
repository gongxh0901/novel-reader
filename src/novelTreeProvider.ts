import * as vscode from 'vscode';
import { NovelEngine } from './novelEngine';

class NovelLineItem extends vscode.TreeItem {
  constructor(
    public readonly text: string,
    public readonly index: number,
  ) {
    super(text, vscode.TreeItemCollapsibleState.None);
    this.tooltip = text;
    this.description = '';
    this.contextValue = 'novelLine';
  }
}

class NovelHeaderItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = 'novelHeader';
  }
}

export class NovelTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private visible = true;

  constructor(private engine: NovelEngine) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  toggleVisibility(): boolean {
    this.visible = !this.visible;
    this.refresh();
    return this.visible;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.refresh();
  }

  get isVisible(): boolean {
    return this.visible;
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    if (!this.visible || !this.engine.loaded) {
      return [];
    }

    const page = this.engine.getCurrentPage();
    const items: vscode.TreeItem[] = [];

    for (let i = 0; i < page.lines.length; i++) {
      items.push(new NovelLineItem(page.lines[i], i));
    }

    return items;
  }
}
