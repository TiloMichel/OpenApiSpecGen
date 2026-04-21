import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  input, output, effect, computed, inject, ViewEncapsulation,
} from '@angular/core';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { StreamLanguage } from '@codemirror/language';
import { yaml as yamlMode } from '@codemirror/legacy-modes/mode/yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import * as jsYaml from 'js-yaml';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

type Lang = 'json' | 'yaml';

const LIGHT_THEME = EditorView.theme({
  '&': { backgroundColor: 'var(--mat-sys-surface-variant)' },
  '.cm-gutters': {
    backgroundColor: 'var(--mat-sys-surface-container)',
    borderRight: '1px solid var(--mat-sys-outline-variant)',
    color: 'var(--mat-sys-on-surface-variant)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--mat-sys-primary) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--mat-sys-primary) 10%, transparent)' },
  '.cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--mat-sys-primary) 20%, transparent)' },
});

const BASE_THEME = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
    fontSize: '0.78rem',
    lineHeight: '1.55',
  },
  '&.cm-focused': { outline: 'none' },
});

@Component({
  selector: 'app-spec-editor',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, MatSnackBarModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="spec-editor-wrapper">
      <div class="spec-editor-toolbar">
        <span class="lang-badge">{{ lang() }}</span>
        <button mat-icon-button matTooltip="Format document" (click)="format()">
          <mat-icon>auto_fix_high</mat-icon>
        </button>
      </div>
      <div #editorHost class="spec-editor-host"></div>
    </div>
  `,
  styleUrl: './spec-editor.scss',
})
export class SpecEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;

  content  = input<string>('');
  darkMode = input<boolean>(false);
  filename = input<string>('');

  contentChange = output<string>();

  private editor?: EditorView;
  private langConf  = new Compartment();
  private themeConf = new Compartment();
  private externalUpdate = false;
  private snackBar = inject(MatSnackBar);

  lang = computed<Lang>(() => {
    const name = this.filename().toLowerCase();
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'yaml';
    const trimmed = this.content().trimStart();
    return trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'yaml';
  });

  constructor() {
    // Sync external content changes into the editor
    effect(() => {
      const newContent = this.content();
      if (!this.editor) return;
      const cur = this.editor.state.doc.toString();
      if (cur !== newContent) {
        this.externalUpdate = true;
        this.editor.dispatch({ changes: { from: 0, to: cur.length, insert: newContent } });
        this.externalUpdate = false;
      }
    });

    // Reconfigure language when filename/content changes
    effect(() => {
      const l = this.lang();
      if (!this.editor) return;
      this.editor.dispatch({ effects: this.langConf.reconfigure(this.langExtension(l)) });
    });

    // Swap theme on dark mode toggle
    effect(() => {
      const dark = this.darkMode();
      if (!this.editor) return;
      this.editor.dispatch({
        effects: this.themeConf.reconfigure(dark ? oneDark : LIGHT_THEME),
      });
    });
  }

  ngAfterViewInit(): void {
    this.editor = new EditorView({
      state: EditorState.create({
        doc: this.content(),
        extensions: [
          basicSetup,
          BASE_THEME,
          this.langConf.of(this.langExtension(this.lang())),
          this.themeConf.of(this.darkMode() ? oneDark : LIGHT_THEME),
          EditorView.updateListener.of(update => {
            if (update.docChanged && !this.externalUpdate) {
              this.contentChange.emit(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: this.editorHost.nativeElement,
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  format(): void {
    if (!this.editor) return;
    const content = this.editor.state.doc.toString();
    try {
      const formatted = this.lang() === 'json'
        ? JSON.stringify(JSON.parse(content), null, 2)
        : jsYaml.dump(jsYaml.load(content) as object, { indent: 2, lineWidth: -1 });

      this.externalUpdate = true;
      this.editor.dispatch({
        changes: { from: 0, to: this.editor.state.doc.length, insert: formatted },
      });
      this.externalUpdate = false;
      this.contentChange.emit(formatted);
      this.snackBar.open('Formatted!', 'OK', { duration: 2000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.snackBar.open(`Format error: ${msg}`, 'OK', { duration: 4000 });
    }
  }

  private langExtension(lang: Lang) {
    return lang === 'json' ? json() : StreamLanguage.define(yamlMode);
  }
}
