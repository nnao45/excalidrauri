import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileItem } from "../types";

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

  const getBaseDirectory = useCallback((): Promise<string> => {
    return invoke<string>("get_base_directory");
  }, []);

  return {
    listDir,
    createFolder,
    createCanvas,
    deleteItem,
    renameItem,
    readCanvas,
    saveCanvas,
    getBaseDirectory,
  };
}
