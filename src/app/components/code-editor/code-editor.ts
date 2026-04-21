import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  input, output, effect, ViewEncapsulation,
} from '@angular/core';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { StreamLanguage } from '@codemirror/language';
import { csharp } from '@codemirror/legacy-modes/mode/clike';
import { oneDark } from '@codemirror/theme-one-dark';

export type CodeLanguage = 'typescript' | 'csharp';

const LIGHT_THEME = EditorView.theme({
  '&': { backgroundColor: '#fafafa', color: '#24292e' },
  '.cm-gutters': {
    backgroundColor: '#f0f0f0',
    borderRight: '1px solid #d0d0d0',
    color: '#888',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(0,0,0,0.04)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(0,0,0,0.06)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(0,100,255,0.15)' },
});

const BASE_THEME = EditorView.theme({
  '&': { maxHeight: '520px' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
    fontSize: '0.82rem',
    lineHeight: '1.65',
  },
  '&.cm-focused': { outline: 'none' },
});

@Component({
  selector: 'app-code-editor',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `<div #editorHost class="code-editor-host"></div>`,
  styleUrl: './code-editor.scss',
})
export class CodeEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;

  content  = input<string>('');
  language = input<CodeLanguage>('typescript');
  darkMode = input<boolean>(false);

  contentChange = output<string>();

  private editor?: EditorView;
  private langConf  = new Compartment();
  private themeConf = new Compartment();
  private externalUpdate = false;

  constructor() {
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

    effect(() => {
      const lang = this.language();
      if (!this.editor) return;
      this.editor.dispatch({ effects: this.langConf.reconfigure(this.langExtension(lang)) });
    });

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
          this.langConf.of(this.langExtension(this.language())),
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

  private langExtension(lang: CodeLanguage) {
    return lang === 'typescript'
      ? javascript({ typescript: true })
      : StreamLanguage.define(csharp);
  }
}
