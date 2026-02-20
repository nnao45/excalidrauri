export interface FileItem {
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileItem[];
}

export interface TrashItem {
  name: string;
  trashPath: string;
  originalPath: string;
  isFolder: boolean;
  trashedAt: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  item: FileItem | null;
  parentPath: string;
}

export interface CanvasData {
  type: "excalidraw";
  version: number;
  elements: unknown[];
  appState: {
    viewBackgroundColor?: string;
    zoom?: { value: number };
    scrollX?: number;
    scrollY?: number;
    gridSize?: number | null;
    [key: string]: unknown;
  };
  files: Record<string, unknown>;
}
