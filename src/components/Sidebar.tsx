import { useState, useEffect, useCallback, useRef } from "react";
import { FileItem, ContextMenuState } from "../types";
import { useTauriFS } from "../hooks/useTauriFS";

interface SidebarProps {
  fileTree: FileItem[];
  selectedFile: FileItem | null;
  onSelectFile: (item: FileItem) => void;
  onRefresh: () => void;
}

interface TreeNodeProps {
  item: FileItem;
  depth: number;
  selectedFile: FileItem | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (item: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
}

function TreeNode({
  item,
  depth,
  selectedFile,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
}: TreeNodeProps) {
  const isExpanded = expandedFolders.has(item.path);
  const isSelected = selectedFile?.path === item.path;

  const handleClick = () => {
    if (item.isFolder) {
      onToggleFolder(item.path);
    } else {
      onSelectFile(item);
    }
  };

  const displayName = item.name.endsWith(".excalidraw")
    ? item.name.slice(0, -".excalidraw".length)
    : item.name;

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, item)}
        title={displayName}
      >
        <span className="tree-node-icon">
          {item.isFolder ? (isExpanded ? "▾" : "▸") : "◻"}
        </span>
        <span className="tree-node-label">{displayName}</span>
      </div>

      {item.isFolder && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <TreeNode
              key={child.path}
              item={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
              onContextMenu={onContextMenu}
            />
          ))}
          {item.children.length === 0 && (
            <div
              className="tree-node-empty"
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
            >
              空のフォルダ
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onNewCanvas: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onRename: (item: FileItem) => void;
  onDelete: (item: FileItem) => void;
}

function ContextMenu({
  menu,
  onClose,
  onNewCanvas,
  onNewFolder,
  onRename,
  onDelete,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const targetPath = menu.item?.path ?? "";
  const parentPath = menu.item?.isFolder ? targetPath : menu.parentPath;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ top: menu.y, left: menu.x }}
    >
      <button
        className="context-menu-item"
        onClick={() => {
          onNewCanvas(parentPath);
          onClose();
        }}
      >
        ＋ 新規キャンバス
      </button>
      <button
        className="context-menu-item"
        onClick={() => {
          onNewFolder(parentPath);
          onClose();
        }}
      >
        ＋ 新規フォルダ
      </button>
      {menu.item && (
        <>
          <div className="context-menu-separator" />
          <button
            className="context-menu-item"
            onClick={() => {
              onRename(menu.item!);
              onClose();
            }}
          >
            名前変更
          </button>
          <button
            className="context-menu-item danger"
            onClick={() => {
              onDelete(menu.item!);
              onClose();
            }}
          >
            削除
          </button>
        </>
      )}
    </div>
  );
}

export function Sidebar({
  fileTree,
  selectedFile,
  onSelectFile,
  onRefresh,
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const { createCanvas, createFolder, deleteItem, renameItem } = useTauriFS();

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: FileItem) => {
      e.preventDefault();
      e.stopPropagation();

      const parentPath = item.isFolder
        ? item.path
        : item.path.includes("/")
          ? item.path.substring(0, item.path.lastIndexOf("/"))
          : "";

      setContextMenu({ x: e.clientX, y: e.clientY, item, parentPath });
    },
    []
  );

  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item: null, parentPath: "" });
  }, []);

  const handleNewCanvas = useCallback(
    async (parentPath: string) => {
      const name = window.prompt("キャンバス名を入力してください:");
      if (!name?.trim()) return;
      const safeName = name.trim().replace(/[/\\?%*:|"<>]/g, "-");
      const canvasName = safeName.endsWith(".excalidraw")
        ? safeName
        : `${safeName}.excalidraw`;
      const fullPath = parentPath ? `${parentPath}/${canvasName}` : canvasName;
      try {
        await createCanvas(fullPath);
        onRefresh();
      } catch (err) {
        alert(`キャンバスの作成に失敗しました: ${err}`);
      }
    },
    [createCanvas, onRefresh]
  );

  const handleNewFolder = useCallback(
    async (parentPath: string) => {
      const name = window.prompt("フォルダ名を入力してください:");
      if (!name?.trim()) return;
      const safeName = name.trim().replace(/[/\\?%*:|"<>]/g, "-");
      const fullPath = parentPath ? `${parentPath}/${safeName}` : safeName;
      try {
        await createFolder(fullPath);
        onRefresh();
        setExpandedFolders((prev) => new Set([...prev, fullPath]));
      } catch (err) {
        alert(`フォルダの作成に失敗しました: ${err}`);
      }
    },
    [createFolder, onRefresh]
  );

  const handleRename = useCallback(
    async (item: FileItem) => {
      const displayName = item.name.endsWith(".excalidraw")
        ? item.name.slice(0, -".excalidraw".length)
        : item.name;
      const newName = window.prompt("新しい名前を入力してください:", displayName);
      if (!newName?.trim() || newName.trim() === displayName) return;

      const safeName = newName.trim().replace(/[/\\?%*:|"<>]/g, "-");
      const finalName =
        !item.isFolder && !safeName.endsWith(".excalidraw")
          ? `${safeName}.excalidraw`
          : safeName;

      const parentPath = item.path.includes("/")
        ? item.path.substring(0, item.path.lastIndexOf("/"))
        : "";
      const newPath = parentPath ? `${parentPath}/${finalName}` : finalName;

      try {
        await renameItem(item.path, newPath);
        onRefresh();
      } catch (err) {
        alert(`名前変更に失敗しました: ${err}`);
      }
    },
    [renameItem, onRefresh]
  );

  const handleDelete = useCallback(
    async (item: FileItem) => {
      const displayName = item.name.endsWith(".excalidraw")
        ? item.name.slice(0, -".excalidraw".length)
        : item.name;
      const label = item.isFolder ? `フォルダ "${displayName}"` : `キャンバス "${displayName}"`;
      if (!window.confirm(`${label} を削除しますか？`)) return;
      try {
        await deleteItem(item.path);
        onRefresh();
      } catch (err) {
        alert(`削除に失敗しました: ${err}`);
      }
    },
    [deleteItem, onRefresh]
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">キャンバス</span>
        <div className="sidebar-actions">
          <button
            className="icon-button"
            title="新規キャンバス"
            onClick={() => handleNewCanvas("")}
          >
            ✏️
          </button>
          <button
            className="icon-button"
            title="新規フォルダ"
            onClick={() => handleNewFolder("")}
          >
            📁
          </button>
          <button
            className="icon-button"
            title="更新"
            onClick={onRefresh}
          >
            ↺
          </button>
        </div>
      </div>

      <div className="sidebar-tree" onContextMenu={handleRootContextMenu}>
        {fileTree.length === 0 ? (
          <div className="sidebar-empty">
            <p>キャンバスがありません</p>
            <p>右クリックまたは上部ボタンで作成</p>
          </div>
        ) : (
          fileTree.map((item) => (
            <TreeNode
              key={item.path}
              item={item}
              depth={0}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              onToggleFolder={handleToggleFolder}
              onSelectFile={onSelectFile}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onNewCanvas={handleNewCanvas}
          onNewFolder={handleNewFolder}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}
    </aside>
  );
}
