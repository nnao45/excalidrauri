import { useState, useEffect, useCallback } from "react";
import { FileItem } from "./types";
import { useTauriFS } from "./hooks/useTauriFS";
import { Sidebar } from "./components/Sidebar";
import { ExcalidrawCanvas } from "./components/ExcalidrawCanvas";
import { findFileByPath } from "./utils/fileTree";

function App() {
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const { listDir } = useTauriFS();

  const refreshFileTree = useCallback(async () => {
    setIsLoadingTree(true);
    setTreeError(null);
    try {
      const tree = await listDir();
      setFileTree(tree);
      setSelectedFile((prev) =>
        prev === null ? null : findFileByPath(tree, prev.path)
      );
    } catch (err) {
      setTreeError(String(err));
    } finally {
      setIsLoadingTree(false);
    }
  }, [listDir]);

  useEffect(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  const handleSelectFile = useCallback((item: FileItem) => {
    if (!item.isFolder) {
      setSelectedFile(item);
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-logo">✏️</span>
          <span className="app-title">excalidrauri</span>
        </div>
        {isLoadingTree && (
          <span className="app-status">読み込み中...</span>
        )}
        {treeError && (
          <span className="app-error">エラー: {treeError}</span>
        )}
      </header>

      <div className="app-body">
        <Sidebar
          fileTree={fileTree}
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
          onRefresh={refreshFileTree}
        />
        <main className="app-main">
          <ExcalidrawCanvas selectedFile={selectedFile} />
        </main>
      </div>
    </div>
  );
}

export default App;
