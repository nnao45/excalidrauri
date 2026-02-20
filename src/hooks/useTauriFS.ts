import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileItem, TrashItem } from "../types";

export function useTauriFS() {
  const listDir = useCallback((): Promise<FileItem[]> => {
    return invoke<FileItem[]>("list_dir", { path: "" });
  }, []);

  const createFolder = useCallback((path: string): Promise<void> => {
    return invoke("create_folder", { path });
  }, []);

  const createCanvas = useCallback((path: string): Promise<void> => {
    return invoke("create_canvas", { path });
  }, []);

  const deleteItem = useCallback((path: string): Promise<void> => {
    return invoke("delete_item", { path });
  }, []);

  const renameItem = useCallback(
    (oldPath: string, newPath: string): Promise<void> => {
      return invoke("rename_item", { oldPath, newPath });
    },
    []
  );

  const readCanvas = useCallback((path: string): Promise<string> => {
    return invoke<string>("read_canvas", { path });
  }, []);

  const saveCanvas = useCallback(
    (path: string, content: string): Promise<void> => {
      return invoke("save_canvas", { path, content });
    },
    []
  );

  const copyCanvas = useCallback(
    (sourcePath: string, destPath: string): Promise<void> => {
      return invoke("copy_canvas", { sourcePath, destPath });
    },
    []
  );

  const getBaseDirectory = useCallback((): Promise<string> => {
    return invoke<string>("get_base_directory");
  }, []);

  const trashItem = useCallback((path: string): Promise<void> => {
    return invoke("trash_item", { path });
  }, []);

  const listTrash = useCallback((): Promise<TrashItem[]> => {
    return invoke<TrashItem[]>("list_trash");
  }, []);

  const restoreItem = useCallback((trashPath: string): Promise<void> => {
    return invoke("restore_item", { trashPath });
  }, []);

  const deletePermanently = useCallback((trashPath: string): Promise<void> => {
    return invoke("delete_permanently", { trashPath });
  }, []);

  const emptyTrash = useCallback((): Promise<void> => {
    return invoke("empty_trash");
  }, []);

  const setItemIcon = useCallback((path: string, icon: string, color?: string): Promise<void> => {
    return invoke("set_item_icon", { path, icon, color: color || null });
  }, []);

  return {
    listDir,
    createFolder,
    createCanvas,
    deleteItem,
    renameItem,
    readCanvas,
    saveCanvas,
    copyCanvas,
    getBaseDirectory,
    trashItem,
    listTrash,
    restoreItem,
    deletePermanently,
    emptyTrash,
    setItemIcon,
  };
}
