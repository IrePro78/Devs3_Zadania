export interface DocumentFragment {
  id: string;
  content: string;
  title?: string;
  start?: number;
  end?: number;
}

export interface DocumentStructure {
  type: 'conversations' | 'document' | 'text';
  fragments: DocumentFragment[];
} 