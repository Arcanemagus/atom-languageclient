// @flow

import {LanguageClientConnection, type DocumentFormattingParams, type DocumentRangeFormattingParams,
  type FormattingOptions, type ServerCapabilities, type TextEdit} from '../languageclient';
import Convert from '../convert';
import {CompositeDisposable} from 'atom';

export default class FormatCodeAdapter {
  _disposable: CompositeDisposable;
  _connection: LanguageClientConnection;

  static canAdapt(serverCapabilities: ServerCapabilities): boolean {
    return serverCapabilities.documentRangeFormattingProvider == true || serverCapabilities.documentFormattingProvider == true;
  }

  constructor(connection: LanguageClientConnection, capabilities: ServerCapabilities, grammarScopes: Array<string>) {
    this._disposable = new CompositeDisposable();
    this._connection = connection;
    this.registerCommands(capabilities, Convert.grammarScopesToTextEditorScopes(grammarScopes));
  }

  registerCommands(capabilities: ServerCapabilities, textEditorScopes: string) {
    if (capabilities.documentRangeFormattingProvider === true) {
      this._disposable.add(
        atom.commands.add(textEditorScopes, {'language:format-selection': this.formatSelection.bind(this)}));
    }
    if (capabilities.documentFormattingProvider === true) {
      this._disposable.add(
        atom.commands.add(textEditorScopes, {'language:format-file': this.formatDocument.bind(this)}));
    }
  }

  dispose(): void {
    this._disposable.dispose();
  }

  async formatDocument(): Promise<void> {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor == null) { return; }

    const textEdits = await this._connection.documentFormatting(FormatCodeAdapter.createDocumentFormattingParams(editor));
    textEdits.reverse();
    FormatCodeAdapter.applyTextEditsInTransaction(editor, textEdits);
  }

  static createDocumentFormattingParams(editor: atom$TextEditor): DocumentFormattingParams {
    return {
      textDocument: Convert.editorToTextDocumentIdentifier(editor),
      options: FormatCodeAdapter.getFormatOptions(editor),
    };
  }

  async formatSelection(): Promise<void> {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor == null) { return; }

    const textEdits = await this._connection.documentRangeFormatting(FormatCodeAdapter.createDocumentRangeFormattingParams(editor));
    textEdits.reverse();
    FormatCodeAdapter.applyTextEditsInTransaction(editor, textEdits);
  }

  static createDocumentRangeFormattingParams(editor: atom$TextEditor): DocumentRangeFormattingParams {
    return {
      textDocument: Convert.editorToTextDocumentIdentifier(editor),
      range: Convert.atomRangeToLSRange(editor.getSelectedBufferRange()),
      options: FormatCodeAdapter.getFormatOptions(editor),
    };
  }

  static applyTextEditsInTransaction(editor: atom$TextEditor, textEdits: Array<TextEdit>): void {
    editor.getBuffer().transact(() => this.applyTextEdits(editor, textEdits));
  }

  static applyTextEdits(editor: atom$TextEditor, textEdits: Array<TextEdit>): void {
    for (const textEdit of textEdits) {
      editor.setTextInBufferRange(Convert.lsRangeToAtomRange(textEdit.range), textEdit.newText);
    }
  }

  static getFormatOptions(editor: atom$TextEditor): FormattingOptions {
    return {
      tabSize: editor.getTabLength(),
      insertSpaces: editor.getSoftTabs(),
    };
  }
}
