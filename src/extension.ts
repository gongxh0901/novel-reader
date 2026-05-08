import * as vscode from 'vscode';
import * as fs from 'fs';
import { NovelEngine } from './novelEngine';
import { NovelTreeProvider } from './novelTreeProvider';

export function activate(context: vscode.ExtensionContext) {
  const engine = new NovelEngine();
  const treeProvider = new NovelTreeProvider(engine);

  const config = vscode.workspace.getConfiguration('novelReader');
  engine.setCharsPerLine(config.get<number>('charsPerLine', 25));
  engine.setLinesPerPage(config.get<number>('linesPerPage', 5));

  const configFilePath = config.get<string>('filePath', '');
  if (configFilePath) {
    try {
      engine.loadFile(configFilePath);
      const configPage = config.get<number>('currentPage', 1);
      engine.jumpToPage(configPage);
    } catch {
      // 忽略加载失败
    }
  }

  // 初始状态隐藏整个阅读面板
  let panelVisible = false;
  vscode.commands.executeCommand('setContext', 'novelReader.panelVisible', panelVisible);

  const treeView = vscode.window.createTreeView('novelReaderView', {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'novelReader.toggleVisibility';
  updateStatusBar(statusBarItem, engine, treeProvider);
  statusBarItem.hide();

  let savingPage = false;

  function saveState() {
    const page = engine.getCurrentPage();
    savingPage = true;
    vscode.workspace.getConfiguration('novelReader').update('currentPage', page.currentPage, vscode.ConfigurationTarget.Global)
      .then(() => { savingPage = false; }, () => { savingPage = false; });
  }

  function refreshAll() {
    treeProvider.refresh();
    updateStatusBar(statusBarItem, engine, treeProvider);
    saveState();
  }

  // 监听小说文件变化，自动重新加载
  let fileWatcher: fs.FSWatcher | undefined;

  function watchFile(filePath: string) {
    if (fileWatcher) {
      fileWatcher.close();
    }
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }
    fileWatcher = fs.watch(filePath, () => {
      if (engine.reloadFile()) {
        refreshAll();
      }
    });
  }

  if (engine.path) {
    watchFile(engine.path);
  }

  context.subscriptions.push(
    treeView,
    statusBarItem,
    { dispose: () => fileWatcher?.close() },

    vscode.commands.registerCommand('novelReader.nextPage', () => {
      if (!engine.loaded) {
        vscode.window.showWarningMessage('请先打开小说文件');
        return;
      }
      engine.nextPage();
      refreshAll();
    }),

    vscode.commands.registerCommand('novelReader.prevPage', () => {
      if (!engine.loaded) {
        vscode.window.showWarningMessage('请先打开小说文件');
        return;
      }
      engine.prevPage();
      refreshAll();
    }),

    vscode.commands.registerCommand('novelReader.toggleVisibility', () => {
      const visible = treeProvider.toggleVisibility();
      updateStatusBar(statusBarItem, engine, treeProvider);
      if (visible && engine.loaded) {
        treeView.reveal(undefined as unknown as vscode.TreeItem, { focus: false });
      }
    }),

    vscode.commands.registerCommand('novelReader.boss', () => {
      panelVisible = !panelVisible;
      vscode.commands.executeCommand('setContext', 'novelReader.panelVisible', panelVisible);
      if (panelVisible) {
        treeProvider.setVisible(true);
        statusBarItem.show();
        refreshAll();
      } else {
        statusBarItem.hide();
      }
    }),

    vscode.commands.registerCommand('novelReader.openFile', async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { '文本文件': ['txt', 'text', 'md'] },
        title: '选择小说文件',
      });

      if (fileUri && fileUri[0]) {
        try {
          engine.loadFile(fileUri[0].fsPath);
          watchFile(fileUri[0].fsPath);
          treeProvider.setVisible(true);
          refreshAll();
          vscode.window.showInformationMessage(`已加载: ${engine.name}`);
        } catch (e) {
          vscode.window.showErrorMessage(`加载失败: ${e}`);
        }
      }
    }),

    vscode.commands.registerCommand('novelReader.jumpToPage', async () => {
      if (!engine.loaded) {
        vscode.window.showWarningMessage('请先打开小说文件');
        return;
      }
      const page = engine.getCurrentPage();
      const input = await vscode.window.showInputBox({
        prompt: `输入页码 (1-${page.totalPages})`,
        value: String(page.currentPage),
        validateInput: (v) => {
          const n = parseInt(v);
          if (isNaN(n) || n < 1 || n > page.totalPages) {
            return `请输入 1-${page.totalPages} 之间的数字`;
          }
          return null;
        },
      });

      if (input) {
        engine.jumpToPage(parseInt(input));
        refreshAll();
      }
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('novelReader.charsPerLine')) {
        const newConfig = vscode.workspace.getConfiguration('novelReader');
        engine.setCharsPerLine(newConfig.get<number>('charsPerLine', 25));
        refreshAll();
      }
      if (e.affectsConfiguration('novelReader.linesPerPage')) {
        const newConfig = vscode.workspace.getConfiguration('novelReader');
        engine.setLinesPerPage(newConfig.get<number>('linesPerPage', 5));
        refreshAll();
      }
      if (e.affectsConfiguration('novelReader.filePath')) {
        const newConfig = vscode.workspace.getConfiguration('novelReader');
        const newPath = newConfig.get<string>('filePath', '');
        if (newPath) {
          try {
            engine.loadFile(newPath);
            watchFile(newPath);
            treeProvider.setVisible(true);
            refreshAll();
          } catch (e) {
            vscode.window.showErrorMessage(`加载失败: ${e}`);
          }
        }
      }
      if (e.affectsConfiguration('novelReader.currentPage') && !savingPage) {
        const newConfig = vscode.workspace.getConfiguration('novelReader');
        const newPage = newConfig.get<number>('currentPage', 1);
        if (engine.loaded) {
          engine.jumpToPage(newPage);
          treeProvider.refresh();
          updateStatusBar(statusBarItem, engine, treeProvider);
        }
      }
    }),
  );

}

function updateStatusBar(
  item: vscode.StatusBarItem,
  engine: NovelEngine,
  treeProvider: NovelTreeProvider,
): void {
  if (!engine.loaded) {
    item.text = '$(book) 小说阅读器';
    item.tooltip = '点击切换显示/隐藏';
    return;
  }

  const page = engine.getCurrentPage();
  const visIcon = treeProvider.isVisible ? '$(eye)' : '$(eye-closed)';
  item.text = `${visIcon} ${page.currentPage}/${page.totalPages}`;
  item.tooltip = `${engine.name} - ${page.progress} | 点击切换显示/隐藏`;
}

export function deactivate() {}
