import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { okaidia } from '@uiw/codemirror-theme-okaidia';
import { tags as t } from '@lezer/highlight';

interface ScreenCodeEditorProps {
  code: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export const ScreenCodeEditor: React.FC<ScreenCodeEditorProps> = ({ 
  code, 
  onChange,
  readOnly = false
}) => {
  const handleChange = (value: string) => {
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <Card className="border">
      <CardContent className="p-0 overflow-hidden">
        <CodeMirror
          value={code}
          height="500px"
          theme={okaidia}
          extensions={[python()]}
          onChange={handleChange}
          readOnly={readOnly}
          className="text-sm"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </CardContent>
    </Card>
  );
};