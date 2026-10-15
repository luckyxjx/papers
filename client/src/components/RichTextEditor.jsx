import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { FontSize } from '../extensions/FontSize';
import {
  AlignLeft, AlignCenter, AlignRight,
  Highlighter, Strikethrough, Code, Quote, Minus,
  ChevronDown, Paperclip
} from 'lucide-react';

export default function RichTextEditor({
  content,
  onChange,
  editable = true,
  editorRef,
  onAttachClick,
  provider = null,
  user = null,
}) {
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);

  // Configure TipTap extensions
  const extensions = [
    StarterKit.configure({
      // Disable default undo/redo history when Yjs collaboration is active
      history: provider ? false : undefined,
      undoRedo: provider ? false : undefined,
      heading: {
        levels: [1, 2, 3],
      },
    }),
    Underline,
    TextStyle,
    FontSize,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder: 'Start writing your document…' }),
    Highlight.configure({ multicolor: false }),
    Link.configure({
      openOnClick: true,
      autolink: true,
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'doc-embedded-link',
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: {
        class: 'doc-embedded-image',
      },
    }),
    CharacterCount,
    ...(provider ? [
      Collaboration.configure({
        document: provider.document,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: user?.name || 'Anonymous',
          color: user?.avatarColor || user?.color || '#6366f1',
        },
      }),
    ] : []),
  ];

  const editor = useEditor({
    extensions,
    // When using Yjs collaboration, the shared document supplies the content.
    // Do not pass content if provider is present - let Yjs handle it entirely
    content: provider ? undefined : (content || ''),
    editable,
    onUpdate: ({ editor }) => {
      // Only call onChange for non-collaborative mode
      // In collaborative mode, Yjs handles all updates
      if (!provider) {
        onChange?.(editor.getJSON());
      }
    },
    editorProps: {
      attributes: {
        class: 'editor-prose-content',
      },
    },
  }, [provider]);

  // Expose editor instance to parent component via editorRef
  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  if (!editor) return null;

  const chars = editor.storage.characterCount?.characters() || 0;
  const words = editor.storage.characterCount?.words() || 0;

  return (
    <div className="editor-main-container">
      {/* Floating Centered Toolbar */}
      {editable && (
        <div className="editor-toolbar-section">
          <div className="editor-floating-toolbar">
            {/* Bold */}
            <button
              type="button"
              className={`toolbar-btn-mock ${editor.isActive('bold') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold (⌘B)"
            >
              <span className="font-bold">B</span>
            </button>

            {/* Italic */}
            <button
              type="button"
              className={`toolbar-btn-mock ${editor.isActive('italic') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic (⌘I)"
            >
              <span className="italic font-serif">I</span>
            </button>

            {/* Underline */}
            <button
              type="button"
              className={`toolbar-btn-mock ${editor.isActive('underline') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline (⌘U)"
            >
              <span className="underline">U</span>
            </button>

            <div className="toolbar-separator" />

            {/* Font Size Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="toolbar-btn-mock toolbar-btn-text"
                onClick={() => setShowFontSizeMenu(!showFontSizeMenu)}
                title="Font size"
                style={{ minWidth: '60px', justifyContent: 'space-between', paddingRight: '4px' }}
              >
                <span>Size</span>
                <ChevronDown size={12} />
              </button>

              {showFontSizeMenu && (
                <div 
                  className="font-size-dropdown"
                  onMouseLeave={() => setShowFontSizeMenu(false)}
                >
                  <button
                    className="font-size-item"
                    onClick={() => {
                      editor.chain().focus().unsetFontSize().run();
                      setShowFontSizeMenu(false);
                    }}
                  >
                    Default
                  </button>
                  <button
                    className="font-size-item"
                    onClick={() => {
                      editor.chain().focus().setFontSize('12px').run();
                      setShowFontSizeMenu(false);
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>Small (12px)</span>
                  </button>
                  <button
                    className="font-size-item"
                    onClick={() => {
                      editor.chain().focus().setFontSize('15px').run();
                      setShowFontSizeMenu(false);
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>Normal (15px)</span>
                  </button>
                  <button
                    className="font-size-item"
                    onClick={() => {
                      editor.chain().focus().setFontSize('18px').run();
                      setShowFontSizeMenu(false);
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>Large (18px)</span>
                  </button>
                  <button
                    className="font-size-item"
                    onClick={() => {
                      editor.chain().focus().setFontSize('24px').run();
                      setShowFontSizeMenu(false);
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>Huge (24px)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="toolbar-separator" />

            {/* H1 */}
            <button
              type="button"
              className={`toolbar-btn-mock ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title="Heading 1"
            >
              <span>H1</span>
            </button>

            {/* H2 */}
            <button
              type="button"
              className={`toolbar-btn-mock ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
            >
              <span>H2</span>
            </button>

            {/* H3 */}
            <button
              type="button"
              className={`toolbar-btn-mock ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Heading 3"
            >
              <span>H3</span>
            </button>

            <div className="toolbar-separator" />

            {/* • List */}
            <button
              type="button"
              className={`toolbar-btn-mock toolbar-btn-text ${editor.isActive('bulletList') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet List"
            >
              <span>• List</span>
            </button>

            {/* 1. List */}
            <button
              type="button"
              className={`toolbar-btn-mock toolbar-btn-text ${editor.isActive('orderedList') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Numbered List"
            >
              <span>1. List</span>
            </button>

            <div className="toolbar-separator" />

            {/* Undo */}
            <button
              type="button"
              className="toolbar-btn-mock"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (⌘Z)"
            >
              <span style={{ fontSize: 16 }}>↶</span>
            </button>

            {/* Redo */}
            <button
              type="button"
              className="toolbar-btn-mock"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (⌘Y)"
            >
              <span style={{ fontSize: 16 }}>↷</span>
            </button>

            {/* Attach / Insert Shortcut */}
            {onAttachClick && (
              <>
                <div className="toolbar-separator" />
                <button
                  type="button"
                  className="toolbar-btn-mock"
                  onClick={onAttachClick}
                  title="Attach or Insert file / image"
                >
                  <Paperclip size={14} />
                </button>
              </>
            )}

            {/* More tools toggle */}
            <button
              type="button"
              className={`toolbar-btn-mock ${showMoreTools ? 'is-active' : ''}`}
              onClick={() => setShowMoreTools(!showMoreTools)}
              title="More formatting tools"
            >
              <ChevronDown size={14} style={{ transform: showMoreTools ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
          </div>

          {/* Extended tools drawer when toggled */}
          {showMoreTools && (
            <div className="editor-secondary-toolbar">
              <button
                type="button"
                className={`secondary-tool-btn ${editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}`}
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                title="Align left"
              >
                <AlignLeft size={14} />
              </button>
              <button
                type="button"
                className={`secondary-tool-btn ${editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}`}
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                title="Align center"
              >
                <AlignCenter size={14} />
              </button>
              <button
                type="button"
                className={`secondary-tool-btn ${editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}`}
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                title="Align right"
              >
                <AlignRight size={14} />
              </button>

              <div className="secondary-tool-divider" />

              <button
                type="button"
                className={`secondary-tool-btn ${editor.isActive('highlight') ? 'is-active' : ''}`}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                title="Highlight"
              >
                <Highlighter size={14} />
              </button>
              <button
                type="button"
                className={`secondary-tool-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
              >
                <Strikethrough size={14} />
              </button>
              <button
                type="button"
                className={`secondary-tool-btn ${editor.isActive('code') ? 'is-active' : ''}`}
                onClick={() => editor.chain().focus().toggleCode().run()}
                title="Code inline"
              >
                <Code size={14} />
              </button>
              <button
                type="button"
                className={`secondary-tool-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Blockquote"
              >
                <Quote size={14} />
              </button>
              <button
                type="button"
                className="secondary-tool-btn"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Divider"
              >
                <Minus size={14} />
              </button>

              <div className="secondary-tool-stats">
                {words} words · {chars} chars
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor Canvas with Document Paper */}
      <div className="editor-canvas">
        <div className="editor-paper">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
