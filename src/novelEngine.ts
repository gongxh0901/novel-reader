import * as fs from 'fs';
import * as path from 'path';

export interface PageInfo {
  lines: string[];
  currentPage: number;
  totalPages: number;
  progress: string;
}

export class NovelEngine {
  private lines: string[] = [];
  private rawLines: string[] = [];
  private currentPage = 0;
  private linesPerPage = 3;
  private charsPerLine = 25;
  private filePath = '';
  private fileName = '';

  get loaded(): boolean {
    return this.lines.length > 0;
  }

  get totalPages(): number {
    return Math.ceil(this.lines.length / this.linesPerPage);
  }

  get page(): number {
    return this.currentPage;
  }

  get name(): string {
    return this.fileName;
  }

  setLinesPerPage(n: number): void {
    this.linesPerPage = Math.max(1, Math.min(50, n));
    if (this.currentPage >= this.totalPages) {
      this.currentPage = Math.max(0, this.totalPages - 1);
    }
  }

  setCharsPerLine(n: number): void {
    const oldChars = this.charsPerLine;
    this.charsPerLine = Math.max(5, Math.min(200, n));
    if (oldChars !== this.charsPerLine && this.rawLines.length > 0) {
      this.lines = this.wrapLines(this.rawLines);
      if (this.currentPage >= this.totalPages) {
        this.currentPage = Math.max(0, this.totalPages - 1);
      }
    }
  }

  private wrapLines(raw: string[]): string[] {
    const result: string[] = [];
    for (const line of raw) {
      if (line.length <= this.charsPerLine) {
        result.push(line);
      } else {
        for (let i = 0; i < line.length; i += this.charsPerLine) {
          result.push(line.substring(i, i + this.charsPerLine));
        }
      }
    }
    return result;
  }

  get path(): string {
    return this.filePath;
  }

  loadFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    this.rawLines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    this.lines = this.wrapLines(this.rawLines);
    this.filePath = filePath;
    this.fileName = path.basename(filePath, path.extname(filePath));
    this.currentPage = 0;
  }

  reloadFile(): boolean {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return false;
    }
    const savedPage = this.currentPage;
    const content = fs.readFileSync(this.filePath, 'utf-8');
    this.rawLines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    this.lines = this.wrapLines(this.rawLines);
    this.currentPage = Math.min(savedPage, Math.max(0, this.totalPages - 1));
    return true;
  }

  getCurrentPage(): PageInfo {
    if (!this.loaded) {
      return { lines: ['未加载小说文件'], currentPage: 0, totalPages: 0, progress: '0%' };
    }

    const start = this.currentPage * this.linesPerPage;
    const end = Math.min(start + this.linesPerPage, this.lines.length);
    const pageLines = this.lines.slice(start, end);
    const progress = ((this.currentPage + 1) / this.totalPages * 100).toFixed(1);

    return {
      lines: pageLines,
      currentPage: this.currentPage + 1,
      totalPages: this.totalPages,
      progress: `${progress}%`,
    };
  }

  nextPage(): PageInfo {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
    }
    return this.getCurrentPage();
  }

  prevPage(): PageInfo {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
    return this.getCurrentPage();
  }

  jumpToPage(page: number): PageInfo {
    this.currentPage = Math.max(0, Math.min(page - 1, this.totalPages - 1));
    return this.getCurrentPage();
  }

  getState(): { filePath: string; currentPage: number } {
    return { filePath: this.filePath, currentPage: this.currentPage };
  }

  restoreState(state: { filePath: string; currentPage: number }): void {
    if (state.filePath && fs.existsSync(state.filePath)) {
      this.loadFile(state.filePath);
      this.currentPage = Math.min(state.currentPage, this.totalPages - 1);
    }
  }
}
