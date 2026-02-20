import { invoke } from "@tauri-apps/api/core";
import { FileItem } from "../types";

export function useTauriFS() {
  const listDir = async (): Promise<FileItem[]> => {
    return invoke<FileItem[]>("list_dir", { path: "" });
  };

  const createFolder = async (path: string): Promise<void> => {
    return invoke("create_folder", { path });
  };

  const createCanvas = async (path: string): Promise<void> => {
    return invoke("create_canvas", { path });
  };

  const deleteItem = async (path: string): Promise<void> => {
    return invoke("delete_item", { path });
  };

  const renameItem = async (
    oldPath: string,
    newPath: string
  ): Promise<void> => {
    return invoke("rename_item", { oldPath, newPath });
  };

  const readCanvas = async (path: string): Promise<string> => {
    return invoke<string>("read_canvas", { path });
  };

  const saveCanvas = async (path: string, content: string): Promise<void> => {
    return invoke("save_canvas", { path, content });
  };

  const getBaseDirectory = async (): Promise<string> => {
    return invoke<string>("get_base_directory");
  };

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
