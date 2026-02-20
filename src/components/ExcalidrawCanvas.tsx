import { useEffect, useState, useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { FileItem, CanvasData } from "../types";
import { useTauriFS } from "../hooks/useTauriFS";

interface ExcalidrawCanvasProps {
  selectedFile: FileItem | null;
}

const DEFAULT_CANVAS_DATA: CanvasData = {
  type: "excalidraw",
  version: 2,
  elements: [],
  appState: {
    viewBackgroundColor: "#ffffff",
    gridSize: null,
  },
  files: {},
};

export function ExcalidrawCanvas({ selectedFile }: ExcalidrawCanvasProps) {
  const [initialData, setInitialData] = useState<CanvasData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFileRef = useRef<string | null>(null);
  const { readCanvas, saveCanvas } = useTauriFS();

  useEffect(() => {
    if (!selectedFile) {
      setInitialData(null);
      setLoadError(null);
      return;
    }

    currentFileRef.current = selectedFile.path;
    setIsLoading(true);
    setLoadError(null);

    readCanvas(selectedFile.path)
      .then((content) => {
        if (currentFileRef.current !== selectedFile.path) return;
        try {
          const data = JSON.parse(content) as CanvasData;
          setInitialData(data);
        } catch {
          setInitialData(DEFAULT_CANVAS_DATA);
        }
      })
      .catch((err) => {
        if (currentFileRef.current !== selectedFile.path) return;
        setLoadError(String(err));
        setInitialData(DEFAULT_CANVAS_DATA);
      })
      .finally(() => {
        if (currentFileRef.current === selectedFile.path) {
          setIsLoading(false);
        }
      });

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [selectedFile?.path]);

  const handleChange = useCallback(
    (
      elements: readonly unknown[],
      appState: Record<string, unknown>,
      files: Record<string, unknown>
    ) => {
      if (!selectedFile) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      const filePath = selectedFile.path;
      saveTimerRef.current = setTimeout(async () => {
        if (currentFileRef.current !== filePath) return;

        const data: CanvasData = {
          type: "excalidraw",
          version: 2,
          elements: elements as unknown[],
          appState: {
            viewBackgroundColor:
              (appState.viewBackgroundColor as string) ?? "#ffffff",
            zoom: appState.zoom as { value: number } | undefined,
            scrollX: appState.scrollX as number | undefined,
            scrollY: appState.scrollY as number | undefined,
            gridSize: appState.gridSize as number | null | undefined,
          },
          files: files as Record<string, unknown>,
        };

        setIsSaving(true);
        try {
          await saveCanvas(filePath, JSON.stringify(data));
        } catch (err) {
          console.error("保存に失敗しました:", err);
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    },
    [selectedFile, saveCanvas]
  );

  if (!selectedFile) {
    return (
      <div className="canvas-placeholder">
        <div className="canvas-placeholder-content">
          <div className="canvas-placeholder-icon">✏️</div>
          <h2>excalidrauri</h2>
          <p>左サイドバーからキャンバスを選択するか、</p>
          <p>新しいキャンバスを作成してください。</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="canvas-placeholder">
        <div className="canvas-placeholder-content">
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  const displayName = selectedFile.name.endsWith(".excalidraw")
    ? selectedFile.name.slice(0, -".excalidraw".length)
    : selectedFile.name;

  return (
    <div className="canvas-container">
      <div className="canvas-toolbar">
        <span className="canvas-filename">{displayName}</span>
        {loadError && (
          <span className="canvas-error">読み込みエラー: {loadError}</span>
        )}
        {isSaving && <span className="canvas-saving">保存中...</span>}
      </div>
      <div className="canvas-excalidraw">
        <Excalidraw
          key={selectedFile.path}
          initialData={initialData ?? DEFAULT_CANVAS_DATA}
          onChange={
            handleChange as Parameters<typeof Excalidraw>[0]["onChange"]
          }
          UIOptions={{
            canvasActions: {
              export: false,
              loadScene: false,
            },
          }}
        />
      </div>
    </div>
  );
}
